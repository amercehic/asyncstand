import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@/common/logger.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  public readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(StripeService.name);

    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    // Use keep-alive HTTP client to reduce latency on repeated calls
    this.stripe = new Stripe(secretKey, {
      httpClient: Stripe.createNodeHttpClient(),
      timeout: 15000,
    });
  }

  /**
   * Create or retrieve a Stripe customer for an organization
   */
  async createOrGetCustomer(
    organizationId: string,
    email: string,
    name: string,
  ): Promise<Stripe.Customer> {
    this.logger.debug('Creating or retrieving Stripe customer', {
      organizationId,
      email,
    });

    // Check if customer already exists for this specific organization
    // First, search by organization metadata
    const existingCustomers = await this.stripe.customers.search({
      query: `metadata["organizationId"]:"${organizationId}"`,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      const customer = existingCustomers.data[0];
      this.logger.debug('Found existing Stripe customer for organization', {
        customerId: customer.id,
        organizationId,
      });
      return customer;
    }

    // Create new customer
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: {
        organizationId,
      },
    });

    this.logger.debug('Created new Stripe customer', {
      customerId: customer.id,
      organizationId,
    });

    return customer;
  }

  /**
   * Create a subscription for a customer
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    paymentMethodId?: string,
  ): Promise<Stripe.Subscription> {
    this.logger.debug('Creating Stripe subscription', {
      customerId,
      priceId,
      hasPaymentMethod: !!paymentMethodId,
    });

    const subscriptionData: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card'],
      },
      expand: ['latest_invoice.payment_intent'],
    };

    if (paymentMethodId) {
      subscriptionData.default_payment_method = paymentMethodId;
      // If we have a payment method, attempt to immediately process payment
      subscriptionData.payment_behavior = 'allow_incomplete';
    }

    const subscription = await this.stripe.subscriptions.create(subscriptionData);

    this.logger.debug('Created Stripe subscription', {
      subscriptionId: subscription.id,
      customerId,
      status: subscription.status,
    });

    // If subscription is incomplete and we have a payment method, try to confirm the payment
    if (subscription.status === 'incomplete' && paymentMethodId) {
      const invoice = subscription.latest_invoice as Stripe.Invoice;
      // Using type assertion as Stripe's Invoice type definition may not include expanded payment_intent
      const invoiceWithIntent = invoice as Stripe.Invoice & {
        payment_intent?: Stripe.PaymentIntent;
      };
      const paymentIntent = invoiceWithIntent?.payment_intent;

      if (paymentIntent && paymentIntent.status === 'requires_payment_method') {
        try {
          // Attach payment method to the payment intent and confirm
          await this.stripe.paymentIntents.confirm(paymentIntent.id, {
            payment_method: paymentMethodId,
          });

          // Retrieve the updated subscription
          const updatedSubscription = await this.stripe.subscriptions.retrieve(subscription.id, {
            expand: ['latest_invoice.payment_intent'],
          });

          this.logger.debug('Payment confirmed for subscription', {
            subscriptionId: updatedSubscription.id,
            status: updatedSubscription.status,
          });

          return updatedSubscription;
        } catch (error) {
          this.logger.warn('Failed to confirm payment for subscription', {
            subscriptionId: subscription.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return subscription;
  }

  // src/billing/services/stripe.service.ts
  async updateSubscription(
    subscriptionId: string,
    updates: Stripe.SubscriptionUpdateParams,
  ): Promise<Stripe.Subscription> {
    this.logger.debug('Updating Stripe subscription', { subscriptionId, updates });

    // Capture timestamp to find any invoices created by this update call
    const updateStartedAt = Math.floor(Date.now() / 1000);

    // Keep caller’s proration_behavior exactly as sent (e.g., 'always_invoice' for upgrades).
    const sub = await this.stripe.subscriptions.update(subscriptionId, {
      ...updates,
      expand: ['latest_invoice', 'latest_invoice.payment_intent'],
    });

    this.logger.debug('Stripe updated subscription', {
      subscriptionId: sub.id,
      status: sub.status,
      latestInvoiceId:
        typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id,
    });

    // If caller asked for 'always_invoice', Stripe should have created an invoice with prorations.
    const isAlwaysInvoice = updates.proration_behavior === 'always_invoice';
    if (isAlwaysInvoice && sub.latest_invoice) {
      // Normalize invoice object
      let invoice: Stripe.Invoice =
        typeof sub.latest_invoice === 'string'
          ? await this.stripe.invoices.retrieve(sub.latest_invoice, { expand: ['payment_intent'] })
          : (sub.latest_invoice as Stripe.Invoice);

      // Finalize if Stripe left it as draft
      if (invoice.status === 'draft' && invoice.amount_due > 0) {
        try {
          invoice = await this.stripe.invoices.finalizeInvoice(invoice.id, {
            expand: ['payment_intent'],
          });
          this.logger.debug('Finalized invoice after upgrade', {
            invoiceId: invoice.id,
            status: invoice.status,
          });
        } catch (err) {
          this.logger.error('Failed to finalize upgrade invoice', {
            invoiceId: invoice.id,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      // If it’s open and there’s money due, try to pay it (uses the customer’s default PM)
      if (invoice.status === 'open' && invoice.amount_due > 0) {
        try {
          const paid = await this.stripe.invoices.pay(invoice.id);
          this.logger.debug('Paid upgrade invoice', {
            invoiceId: paid.id,
            status: paid.status,
            amountPaid: paid.amount_paid,
          });
        } catch (err) {
          // Non-fatal — Stripe will retry, and your webhooks will update state
          this.logger.warn('Could not auto-pay upgrade invoice', {
            invoiceId: invoice.id,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    }

    // Fallback: Stripe sometimes doesn't attach the new proration invoice to latest_invoice immediately.
    // Search for a recent subscription_update invoice for this subscription and finalize/pay it if needed.
    if (isAlwaysInvoice) {
      try {
        const recentInvoices = await this.stripe.invoices.list({
          subscription: subscriptionId,
          limit: 5,
          created: { gte: updateStartedAt - 120 },
          expand: ['data.payment_intent'],
        });

        const candidate = recentInvoices.data.find(
          (inv) => inv.billing_reason === 'subscription_update',
        );

        if (candidate && candidate.amount_due > 0) {
          let invoice = candidate;
          if (invoice.status === 'draft') {
            try {
              invoice = await this.stripe.invoices.finalizeInvoice(invoice.id, {
                expand: ['payment_intent'],
              });
              this.logger.debug('Finalized proration invoice (fallback)', {
                invoiceId: invoice.id,
                status: invoice.status,
              });
            } catch (err) {
              this.logger.error('Failed to finalize proration invoice (fallback)', {
                invoiceId: invoice.id,
                error: err instanceof Error ? err.message : 'Unknown error',
              });
            }
          }

          if (invoice.status === 'open') {
            try {
              const paid = await this.stripe.invoices.pay(invoice.id);
              this.logger.debug('Paid proration invoice (fallback)', {
                invoiceId: paid.id,
                status: paid.status,
                amountPaid: paid.amount_paid,
              });
            } catch (err) {
              this.logger.warn('Could not auto-pay proration invoice (fallback)', {
                invoiceId: invoice.id,
                error: err instanceof Error ? err.message : 'Unknown error',
              });
            }
          }
        }
      } catch (err) {
        this.logger.warn('Failed to search/pay proration invoice (fallback)', {
          subscriptionId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Return a fresh subscription snapshot (with expanded latest invoice/PI)
    return await this.stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice', 'latest_invoice.payment_intent'],
    });
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true,
  ): Promise<Stripe.Subscription> {
    this.logger.debug('Canceling Stripe subscription', {
      subscriptionId,
      cancelAtPeriodEnd,
    });

    const subscription = await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });

    this.logger.debug('Canceled Stripe subscription', {
      subscriptionId: subscription.id,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    return subscription;
  }

  /**
   * Create a setup intent for collecting payment method
   */
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    this.logger.debug('Creating setup intent', { customerId });

    const setupIntent = await this.stripe.setupIntents.create({
      customer: customerId,
      usage: 'off_session',
    });

    return setupIntent;
  }

  /**
   * Get customer's payment methods
   * @param customerId - The Stripe customer ID
   * @param organizationId - The organization ID for verification (optional but recommended)
   */
  async getPaymentMethods(
    customerId: string,
    organizationId?: string,
  ): Promise<Stripe.PaymentMethod[]> {
    // If organizationId provided, verify the customer belongs to it
    if (organizationId) {
      const customer = await this.stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        this.logger.error('Customer is deleted', {
          customerId,
          organizationId,
        });
        return [];
      }

      // Type guard to ensure customer is not deleted
      const activeCustomer = customer as Stripe.Customer;
      if (!activeCustomer.metadata || activeCustomer.metadata.organizationId !== organizationId) {
        this.logger.error('Customer organization mismatch', {
          customerId,
          expectedOrgId: organizationId,
          actualOrgId: activeCustomer.metadata?.organizationId,
        });
        return [];
      }
    }

    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return paymentMethods.data;
  }

  /**
   * Construct webhook event from raw body and signature
   */
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required for webhook verification');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      this.logger.error('Webhook signature verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Retrieve a subscription from Stripe
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Retrieve a customer from Stripe
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    const customer = await this.stripe.customers.retrieve(customerId);

    if (customer.deleted) {
      throw new Error('Customer has been deleted');
    }

    return customer as Stripe.Customer;
  }

  /**
   * Get invoices for a customer
   * @param customerId - The Stripe customer ID
   * @param limit - Maximum number of invoices to return
   * @param organizationId - The organization ID for verification (optional but recommended)
   */
  async getInvoices(
    customerId: string,
    limit: number = 10,
    organizationId?: string,
  ): Promise<Stripe.Invoice[]> {
    this.logger.debug('Fetching invoices for customer', { customerId, limit, organizationId });

    // If organizationId provided, verify the customer belongs to it
    if (organizationId) {
      const customer = await this.stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        this.logger.error('Customer is deleted', {
          customerId,
          organizationId,
        });
        return [];
      }

      // Type guard to ensure customer is not deleted
      const activeCustomer = customer as Stripe.Customer;
      if (!activeCustomer.metadata || activeCustomer.metadata.organizationId !== organizationId) {
        this.logger.error('Customer organization mismatch', {
          customerId,
          expectedOrgId: organizationId,
          actualOrgId: activeCustomer.metadata?.organizationId,
        });
        return [];
      }
    }

    const invoices = await this.stripe.invoices.list({
      customer: customerId,
      limit,
      expand: ['data.lines'],
    });

    return invoices.data;
  }

  /**
   * Get invoices with pagination
   * @param customerId - The Stripe customer ID
   * @param page - Page number (1-based)
   * @param limit - Number of invoices per page
   * @param organizationId - The organization ID for verification (optional)
   */
  async getInvoicesWithPagination(
    customerId: string,
    page: number = 1,
    limit: number = 5,
    organizationId?: string,
  ): Promise<{ invoices: Stripe.Invoice[]; total: number }> {
    this.logger.debug('Fetching invoices with pagination', {
      customerId,
      page,
      limit,
      organizationId,
    });

    // Fetch only what we need to render the requested page to minimize latency
    // Page 1: exactly `limit` invoices; Page N: up to N*limit (capped at 100)
    let fetchLimit: number = Math.min(page * limit, 100);
    if (fetchLimit < limit) fetchLimit = limit;

    const invoicesResult = await this.stripe.invoices.list({
      customer: customerId,
      limit: fetchLimit,
      // Don't expand lines since we don't need them for the listing
    });

    const allInvoices = invoicesResult.data;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const pageInvoices = allInvoices.slice(startIndex, endIndex);

    // Use has_more from Stripe to determine if there are more invoices beyond what we fetched
    let total = allInvoices.length;
    if (invoicesResult.has_more) {
      // If Stripe says there are more, estimate total based on what we know
      total = Math.max(allInvoices.length + 1, page * limit + 1);
    }

    return {
      invoices: pageInvoices,
      total,
    };
  }

  /**
   * Get invoices using cursor-based pagination for optimal performance
   */
  async getInvoicesByCursor(
    customerId: string,
    limit: number = 5,
    options?: { startingAfter?: string; endingBefore?: string },
  ): Promise<{
    invoices: Stripe.Invoice[];
    hasMore: boolean;
    nextCursor?: string;
    prevCursor?: string;
  }> {
    this.logger.debug('Fetching invoices by cursor', {
      customerId,
      limit,
      startingAfter: options?.startingAfter,
      endingBefore: options?.endingBefore,
    });

    const listParams: Stripe.InvoiceListParams = {
      customer: customerId,
      limit,
    };

    if (options?.startingAfter) listParams.starting_after = options.startingAfter;
    if (options?.endingBefore) listParams.ending_before = options.endingBefore;

    const result = await this.stripe.invoices.list(listParams);
    const data = result.data;

    const nextCursor = result.has_more && data.length > 0 ? data[data.length - 1].id : undefined;
    const prevCursor = data.length > 0 ? data[0].id : undefined;

    return {
      invoices: data,
      hasMore: result.has_more,
      nextCursor,
      prevCursor,
    };
  }

  /**
   * Get a specific invoice
   */
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    this.logger.debug('Fetching invoice', { invoiceId });

    return await this.stripe.invoices.retrieve(invoiceId, {
      expand: ['lines'],
    });
  }

  /**
   * Get the latest invoice by ID or from subscription
   */
  async getLatestInvoice(invoiceIdOrSubscriptionId: string): Promise<Stripe.Invoice | null> {
    try {
      // First try to retrieve it as an invoice ID
      if (invoiceIdOrSubscriptionId.startsWith('in_')) {
        return await this.getInvoice(invoiceIdOrSubscriptionId);
      }

      // Otherwise, get the latest invoice from subscription
      const subscription = await this.getSubscription(invoiceIdOrSubscriptionId);
      if (subscription.latest_invoice) {
        const invoiceId =
          typeof subscription.latest_invoice === 'string'
            ? subscription.latest_invoice
            : subscription.latest_invoice.id;
        return await this.getInvoice(invoiceId);
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get latest invoice', {
        idOrSubscription: invoiceIdOrSubscriptionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Finalize a draft invoice
   */
  async finalizeInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    this.logger.debug('Finalizing invoice', { invoiceId });

    return await this.stripe.invoices.finalizeInvoice(invoiceId, {
      expand: ['payment_intent'],
    });
  }

  /**
   * Pay an invoice immediately
   */
  async payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    this.logger.debug('Paying invoice', { invoiceId });

    return await this.stripe.invoices.pay(invoiceId, {
      expand: ['payment_intent'],
    });
  }

  /**
   * Retry payment for a failed invoice
   */
  async retryInvoicePayment(invoiceId: string): Promise<Stripe.Invoice> {
    this.logger.debug('Retrying invoice payment', { invoiceId });

    // First, retrieve the invoice to check its status
    const invoice = await this.getInvoice(invoiceId);

    if (invoice.status === 'paid') {
      throw new Error('Invoice is already paid');
    }

    if (invoice.status === 'draft') {
      // Finalize the draft invoice first
      await this.stripe.invoices.finalizeInvoice(invoiceId);
    }

    // Attempt to pay the invoice
    const paidInvoice = await this.stripe.invoices.pay(invoiceId, {
      expand: ['payment_intent'],
    });

    this.logger.debug('Invoice payment retry completed', {
      invoiceId,
      paid: paidInvoice.status === 'paid',
      status: paidInvoice.status,
    });

    return paidInvoice;
  }

  /**
   * Attach a payment method to a customer
   */
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string,
  ): Promise<Stripe.PaymentMethod> {
    this.logger.debug('Attaching payment method to customer', { paymentMethodId, customerId });

    return await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  }

  /**
   * Detach a payment method from a customer
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    this.logger.debug('Detaching payment method', { paymentMethodId });

    return await this.stripe.paymentMethods.detach(paymentMethodId);
  }

  /**
   * Set default payment method for a customer
   */
  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<Stripe.Customer> {
    this.logger.debug('Setting default payment method', { customerId, paymentMethodId });

    return (await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })) as Stripe.Customer;
  }

  /**
   * Get a specific payment method
   */
  async getPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    this.logger.debug('Fetching payment method', { paymentMethodId });

    return await this.stripe.paymentMethods.retrieve(paymentMethodId);
  }
}
