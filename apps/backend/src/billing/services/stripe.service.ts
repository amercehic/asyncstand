import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@/common/logger.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(StripeService.name);

    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-08-27.basil',
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

  /**
   * Update a subscription (change plan, cancel, etc.)
   */
  async updateSubscription(
    subscriptionId: string,
    updates: Stripe.SubscriptionUpdateParams,
  ): Promise<Stripe.Subscription> {
    this.logger.debug('Updating Stripe subscription', {
      subscriptionId,
      updates,
    });

    // Always expand latest_invoice to get invoice details for upgrades
    const subscription = await this.stripe.subscriptions.update(subscriptionId, {
      ...updates,
      expand: ['latest_invoice', 'latest_invoice.payment_intent'],
    });

    this.logger.debug('Updated Stripe subscription', {
      subscriptionId: subscription.id,
      status: subscription.status,
      latestInvoice: subscription.latest_invoice,
    });

    return subscription;
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
   */
  async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
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
   */
  async getInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
    this.logger.debug('Fetching invoices for customer', { customerId, limit });

    const invoices = await this.stripe.invoices.list({
      customer: customerId,
      limit,
      expand: ['data.lines'],
    });

    return invoices.data;
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
