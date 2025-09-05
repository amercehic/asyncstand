import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { StripeService } from '@/billing/services/stripe.service';
import { DowngradeValidationService } from '@/billing/services/downgrade-validation.service';
// import { UsageTrackingService } from './usage-tracking.service';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  SubscriptionResponseDto,
} from '@/billing/dto/subscription.dto';
import { Plan, Subscription, SubscriptionStatus, BillingAccount } from '@prisma/client';
import Stripe from 'stripe';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly downgradeValidation: DowngradeValidationService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(BillingService.name);
  }

  /**
   * Initialize billing for a new organization
   */
  async initializeBillingForOrganization(
    orgId: string,
    ownerEmail: string,
    ownerName: string,
  ): Promise<BillingAccount> {
    this.logger.debug('Initializing billing for organization', {
      orgId,
      ownerEmail,
    });

    // Check if billing account already exists
    const existingAccount = await this.prisma.billingAccount.findUnique({
      where: { orgId },
    });

    if (existingAccount) {
      this.logger.debug('Billing account already exists', { orgId });
      return existingAccount;
    }

    // Create Stripe customer
    const stripeCustomer = await this.stripeService.createOrGetCustomer(
      orgId,
      ownerEmail,
      ownerName,
    );

    // Create billing account
    const billingAccount = await this.prisma.billingAccount.create({
      data: {
        orgId,
        stripeCustomerId: stripeCustomer.id,
        billingEmail: ownerEmail,
      },
    });

    this.logger.debug('Created billing account', {
      orgId,
      billingAccountId: billingAccount.id,
      stripeCustomerId: stripeCustomer.id,
    });

    return billingAccount;
  }

  /**
   * Create a subscription (upgrade from free)
   */
  async createSubscription(
    orgId: string,
    createDto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    this.logger.debug('Creating subscription', { orgId, planId: createDto.planId });

    // Get billing account
    const billingAccount = await this.getBillingAccountInternal(orgId);

    // Get the plan - planId is actually the plan key (e.g., "starter", "professional")
    const plan = await this.prisma.plan.findUnique({
      where: { key: createDto.planId },
    });

    if (!plan) {
      throw new NotFoundException(`Plan ${createDto.planId} not found`);
    }

    if (!plan.stripePriceId) {
      throw new BadRequestException(`Plan ${plan.name} is not available for subscription`);
    }

    // Check if already has active subscription
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        billingAccountId: billingAccount.id,
        status: {
          in: ['active', 'trialing', 'past_due'],
        },
      },
    });

    if (existingSubscription) {
      throw new BadRequestException('Organization already has an active subscription');
    }

    // Create Stripe subscription
    const stripeSubscription = await this.stripeService.createSubscription(
      billingAccount.stripeCustomerId,
      plan.stripePriceId,
      createDto.paymentMethodId,
    );

    // Get period dates from subscription items
    const periodStart = stripeSubscription.items.data[0]?.current_period_start;
    const periodEnd = stripeSubscription.items.data[0]?.current_period_end;

    // Create subscription record
    let subscription = await this.prisma.subscription.create({
      data: {
        billingAccountId: billingAccount.id,
        planId: plan.id,
        stripeSubscriptionId: stripeSubscription.id,
        status: this.mapStripeSubscriptionStatus(stripeSubscription.status),
        currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : new Date(),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    });

    this.logger.debug('Created subscription', {
      orgId,
      subscriptionId: subscription.id,
      stripeSubscriptionId: stripeSubscription.id,
      planName: plan.name,
      status: subscription.status,
    });

    // If the Stripe subscription status is active but our record shows incomplete, update it
    if (stripeSubscription.status === 'active' && subscription.status === 'incomplete') {
      subscription = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'active' },
      });

      this.logger.debug('Updated subscription status to active', {
        subscriptionId: subscription.id,
      });
    }

    return await this.formatSubscriptionResponse(subscription, plan);
  }

  /**
   * Get current subscription for an organization
   */
  async getSubscription(orgId: string): Promise<SubscriptionResponseDto | null> {
    const billingAccount = await this.prisma.billingAccount.findUnique({
      where: { orgId },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!billingAccount?.subscription) {
      return null;
    }

    return await this.formatSubscriptionResponse(
      billingAccount.subscription,
      billingAccount.subscription.plan,
    );
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    orgId: string,
    updateDto: UpdateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    this.logger.debug('Updating subscription', { orgId, updates: updateDto });

    const subscription = await this.getCurrentSubscription(orgId);
    const updates: Record<string, unknown> = {};

    // Handle plan change
    if (updateDto.planId) {
      // Get current plan for comparison (need key, not just ID)
      const currentPlan = await this.prisma.plan.findUnique({
        where: { id: subscription.planId },
      });

      if (!currentPlan) {
        throw new NotFoundException('Current plan not found');
      }

      // Compare plan keys instead of mixing key and ID
      if (updateDto.planId !== currentPlan.key) {
        const newPlan = await this.prisma.plan.findUnique({
          where: { key: updateDto.planId },
        });

        if (!newPlan) {
          throw new NotFoundException(`Plan ${updateDto.planId} not found`);
        }

        if (!newPlan.stripePriceId) {
          throw new BadRequestException(`Plan ${newPlan.name} is not available for subscription`);
        }

        const currentPriceCents = Number(currentPlan.price);
        const newPriceCents = Number(newPlan.price);

        this.logger.debug('Processing plan change', {
          orgId,
          currentPlan: currentPlan.key,
          newPlan: newPlan.key,
          currentPrice: currentPriceCents,
          newPrice: newPriceCents,
          isUpgrade: newPriceCents > currentPriceCents,
          subscriptionId: subscription.stripeSubscriptionId,
        });

        // If it's a downgrade, validate it's allowed
        if (Number(newPlan.price) < Number(currentPlan.price)) {
          const validation = await this.downgradeValidation.validateDowngrade(orgId, newPlan);
          if (!validation.canDowngrade) {
            throw new BadRequestException({
              message: 'Cannot downgrade due to usage constraints',
              errors: validation.blockers,
            });
          }

          this.logger.debug('Downgrade validation passed', {
            orgId,
            fromPlan: currentPlan.key,
            toPlan: newPlan.key,
            warnings: validation.warnings.length,
          });
        }

        // Update Stripe subscription
        const stripeSubscription = await this.stripeService.getSubscription(
          subscription.stripeSubscriptionId,
        );
        this.logger.debug('Updating Stripe subscription for plan change', {
          orgId,
          subscriptionId: subscription.stripeSubscriptionId,
          currentPlan: currentPlan.key,
          newPlan: newPlan.key,
          currentPrice: currentPlan.price,
          newPrice: newPlan.price,
          itemId: stripeSubscription.items.data[0]?.id,
          proration: 'create_prorations',
        });

        // Determine if this is an upgrade or downgrade
        const isUpgrade = Number(newPlan.price) > Number(currentPlan.price);

        // For upgrades, we want to charge immediately with prorations
        // For downgrades, we apply at the end of the billing period
        const updateParams: Stripe.SubscriptionUpdateParams = {
          items: [
            {
              id: stripeSubscription.items.data[0].id,
              price: newPlan.stripePriceId,
            },
          ],
          // always_invoice: Creates an invoice immediately for any prorations
          // create_prorations: Creates prorations but doesn't invoice until next cycle
          proration_behavior: isUpgrade ? 'always_invoice' : 'create_prorations',
          ...(isUpgrade ? { proration_date: Math.floor(Date.now() / 1000) } : {}),
        };

        // For upgrades, omit payment_behavior to let Stripe collect automatically
        // For downgrades, allow incomplete to prevent payment failures from blocking the change
        if (!isUpgrade) {
          updateParams.payment_behavior = 'allow_incomplete';
        }

        const updatedStripeSubscription = await this.stripeService.updateSubscription(
          subscription.stripeSubscriptionId,
          updateParams,
        );

        const currentPeriodStart = (updatedStripeSubscription as { current_period_start?: number })
          .current_period_start;
        const currentPeriodEnd = (updatedStripeSubscription as { current_period_end?: number })
          .current_period_end;

        this.logger.debug('Stripe subscription updated successfully', {
          orgId,
          subscriptionId: subscription.stripeSubscriptionId,
          status: updatedStripeSubscription.status,
          currentPeriodStart: currentPeriodStart
            ? new Date(currentPeriodStart * 1000).toISOString()
            : null,
          currentPeriodEnd: currentPeriodEnd
            ? new Date(currentPeriodEnd * 1000).toISOString()
            : null,
        });

        updates.planId = newPlan.id;

        // Update status from Stripe response
        if (updatedStripeSubscription.status) {
          updates.status = updatedStripeSubscription.status;
        }

        // If subscription was cancelled but user is upgrading, reactivate it
        if (subscription.cancelAtPeriodEnd) {
          this.logger.debug('Reactivating cancelled subscription due to plan upgrade', {
            orgId,
            subscriptionId: subscription.id,
            oldPlan: currentPlan.key,
            newPlan: newPlan.key,
          });

          // Reactivate in Stripe
          await this.stripeService.updateSubscription(subscription.stripeSubscriptionId, {
            cancel_at_period_end: false,
          });

          updates.cancelAtPeriodEnd = false;
        }
      }
    }

    // Handle status updates
    if (updateDto.status) {
      updates.status = updateDto.status;
    }

    // Update database
    const updatedSubscription = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: updates,
      include: {
        plan: true,
      },
    });

    this.logger.debug('Updated subscription', {
      orgId,
      subscriptionId: subscription.id,
      updates,
    });

    return await this.formatSubscriptionResponse(updatedSubscription, updatedSubscription.plan);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    orgId: string,
    cancelAtPeriodEnd = true,
  ): Promise<SubscriptionResponseDto> {
    this.logger.debug('Canceling subscription', { orgId, cancelAtPeriodEnd });

    const subscription = await this.getCurrentSubscription(orgId);

    // Cancel in Stripe
    await this.stripeService.cancelSubscription(
      subscription.stripeSubscriptionId,
      cancelAtPeriodEnd,
    );

    // Update database
    const updatedSubscription = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd,
        ...(cancelAtPeriodEnd ? {} : { status: 'canceled' }),
      },
      include: {
        plan: true,
      },
    });

    this.logger.debug('Canceled subscription', {
      orgId,
      subscriptionId: subscription.id,
      cancelAtPeriodEnd,
    });

    return await this.formatSubscriptionResponse(updatedSubscription, updatedSubscription.plan);
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(orgId: string): Promise<SubscriptionResponseDto> {
    this.logger.debug('Reactivating subscription', { orgId });

    const subscription = await this.getCurrentSubscription(orgId);

    if (!subscription.cancelAtPeriodEnd) {
      throw new BadRequestException('Subscription is not canceled');
    }

    // Reactivate in Stripe
    await this.stripeService.updateSubscription(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // Update database
    const updatedSubscription = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: false,
        status: 'active',
      },
      include: {
        plan: true,
      },
    });

    this.logger.debug('Reactivated subscription', {
      orgId,
      subscriptionId: subscription.id,
    });

    return await this.formatSubscriptionResponse(updatedSubscription, updatedSubscription.plan);
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.debug('Handling Stripe webhook event', {
      type: event.type,
      eventId: event.id,
    });

    switch (event.type) {
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        this.logger.debug('Unhandled webhook event type', { type: event.type });
        break;
    }
  }

  /**
   * Get billing account for organization (public method)
   */
  async getBillingAccount(orgId: string): Promise<BillingAccount> {
    return this.getBillingAccountInternal(orgId);
  }

  // Private helper methods

  private async getBillingAccountInternal(orgId: string): Promise<BillingAccount> {
    const billingAccount = await this.prisma.billingAccount.findUnique({
      where: { orgId },
    });

    if (!billingAccount) {
      throw new NotFoundException(`No billing account found for organization ${orgId}`);
    }

    return billingAccount;
  }

  private async getCurrentSubscription(orgId: string): Promise<Subscription> {
    const billingAccount = await this.getBillingAccountInternal(orgId);

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        billingAccountId: billingAccount.id,
        status: {
          in: ['active', 'trialing', 'past_due', 'canceled'],
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException(`No subscription found for organization ${orgId}`);
    }

    return subscription;
  }

  private async formatSubscriptionResponse(
    subscription: Subscription,
    plan?: Plan,
  ): Promise<SubscriptionResponseDto> {
    // Get the billing account if we need the org ID
    const billingAccount = await this.prisma.billingAccount.findUnique({
      where: { id: subscription.billingAccountId },
    });

    // Get the plan if not provided
    if (!plan) {
      plan = await this.prisma.plan.findUnique({
        where: { id: subscription.planId },
      });
    }

    return {
      id: subscription.id,
      organizationId: billingAccount?.orgId || '',
      planId: subscription.planId,
      planKey: plan?.key,
      status: subscription.status,
      stripeSubscriptionId: subscription.stripeSubscriptionId || '',
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  private mapStripeSubscriptionStatus(
    stripeStatus: Stripe.Subscription.Status,
  ): SubscriptionStatus {
    const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
      active: 'active',
      canceled: 'canceled',
      incomplete: 'incomplete',
      incomplete_expired: 'incomplete_expired',
      past_due: 'past_due',
      trialing: 'trialing',
      unpaid: 'unpaid',
      paused: 'paused',
    };

    return statusMap[stripeStatus] || 'incomplete';
  }

  // Webhook handlers

  private async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: stripeSubscription.id },
    });

    if (!subscription) {
      this.logger.warn('Received webhook for unknown subscription', {
        stripeSubscriptionId: stripeSubscription.id,
      });
      return;
    }

    // Get period dates from subscription items
    const periodStart = stripeSubscription.items.data[0]?.current_period_start;
    const periodEnd = stripeSubscription.items.data[0]?.current_period_end;

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: this.mapStripeSubscriptionStatus(stripeSubscription.status),
        currentPeriodStart: periodStart ? new Date(periodStart * 1000) : undefined,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    });

    this.logger.debug('Updated subscription from webhook', {
      subscriptionId: subscription.id,
      status: stripeSubscription.status,
    });
  }

  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: stripeSubscription.id },
    });

    if (!subscription) {
      this.logger.warn('Received deletion webhook for unknown subscription', {
        stripeSubscriptionId: stripeSubscription.id,
      });
      return;
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'canceled',
        cancelAtPeriodEnd: false,
      },
    });

    this.logger.debug('Marked subscription as canceled from webhook', {
      subscriptionId: subscription.id,
    });
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    this.logger.debug('Payment succeeded', {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      amount: invoice.amount_paid,
    });

    // Record successful payment event
    // Could update payment history, send confirmation emails, etc.
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    this.logger.warn('Payment failed', {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      amount: invoice.amount_due,
    });

    // Handle failed payment
    // Could send notification emails, update subscription status, etc.
  }
}
