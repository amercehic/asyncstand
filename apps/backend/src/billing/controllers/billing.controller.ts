import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  UseGuards,
  HttpStatus,
  Param,
  NotFoundException,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '@/auth/guards/roles.guard';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { BillingService } from '@/billing/services/billing.service';
import { StripeService } from '@/billing/services/stripe.service';
import { DowngradeValidationService } from '@/billing/services/downgrade-validation.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  SubscriptionResponseDto,
} from '@/billing/dto/subscription.dto';
import { OrgRole } from '@prisma/client';
import { Audit } from '@/common/audit/audit.decorator';
import { AuditCategory, AuditSeverity } from '@/common/audit/types';

@ApiTags('Billing')
@ApiBearerAuth('JWT-auth')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly stripeService: StripeService,
    private readonly downgradeValidation: DowngradeValidationService,
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(BillingController.name);
  }

  @Get('subscription')
  @Roles(OrgRole.owner, OrgRole.admin)
  @ApiOperation({
    summary: 'Get current subscription',
    description: 'Retrieve the current subscription details for the organization',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current subscription details',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No subscription found (free plan)',
  })
  async getCurrentSubscription(
    @CurrentOrg() orgId: string,
    @CurrentUser('email') userEmail: string,
    @CurrentUser('name') userName: string,
  ) {
    // Initialize billing if it doesn't exist
    await this.billingService.initializeBillingForOrganization(
      orgId,
      userEmail,
      userName || 'Organization Owner',
    );

    const subscription = await this.billingService.getSubscription(orgId);

    if (!subscription) {
      return {
        message: 'Organization is on free plan',
        plan: 'free',
        subscription: null,
      };
    }

    // Get the plan key from the subscription
    const plan = await this.prisma.plan.findUnique({
      where: { id: subscription.planId },
      select: { key: true },
    });

    return {
      message: 'Subscription retrieved successfully',
      subscription,
      plan: plan?.key || 'unknown',
    };
  }

  @Post('subscription')
  @Roles(OrgRole.owner)
  @Audit({
    action: 'billing.subscription_created',
    category: AuditCategory.BILLING,
    severity: AuditSeverity.HIGH,
  })
  @ApiOperation({
    summary: 'Create subscription',
    description: 'Upgrade organization from free plan to paid subscription',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Subscription created successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid subscription request or already has active subscription',
  })
  async createSubscription(@CurrentOrg() orgId: string, @Body() createDto: CreateSubscriptionDto) {
    const subscription = await this.billingService.createSubscription(orgId, createDto);

    return {
      message: 'Subscription created successfully',
      subscription,
    };
  }

  @Put('subscription')
  @Roles(OrgRole.owner)
  @Audit({
    action: 'billing.subscription_updated',
    category: AuditCategory.BILLING,
    severity: AuditSeverity.MEDIUM,
  })
  @ApiOperation({
    summary: 'Update subscription',
    description: 'Update subscription plan or settings',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription updated successfully',
    type: SubscriptionResponseDto,
  })
  async updateSubscription(@CurrentOrg() orgId: string, @Body() updateDto: UpdateSubscriptionDto) {
    this.logger.debug('🎯 BillingController: Received update subscription request', {
      orgId,
      updateDto,
      planId: updateDto.planId,
      status: updateDto.status,
    });

    const subscription = await this.billingService.updateSubscription(orgId, updateDto);

    this.logger.debug('✅ BillingController: Subscription updated successfully', {
      subscriptionId: subscription.id,
      planKey: subscription.planKey,
    });

    return {
      message: 'Subscription updated successfully',
      subscription,
    };
  }

  @Delete('subscription')
  @Roles(OrgRole.owner)
  @Audit({
    action: 'billing.subscription_canceled',
    category: AuditCategory.BILLING,
    severity: AuditSeverity.HIGH,
  })
  @ApiOperation({
    summary: 'Cancel subscription',
    description: 'Cancel the current subscription (will downgrade to free at period end)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription canceled successfully',
    type: SubscriptionResponseDto,
  })
  async cancelSubscription(@CurrentOrg() orgId: string, @Body() body?: { immediate?: boolean }) {
    const cancelAtPeriodEnd = !body?.immediate;
    const subscription = await this.billingService.cancelSubscription(orgId, cancelAtPeriodEnd);

    return {
      message: `Subscription ${cancelAtPeriodEnd ? 'will be canceled at period end' : 'canceled immediately'}`,
      subscription,
    };
  }

  @Post('subscription/reactivate')
  @Roles(OrgRole.owner)
  @Audit({
    action: 'billing.subscription_reactivated',
    category: AuditCategory.BILLING,
    severity: AuditSeverity.MEDIUM,
  })
  @ApiOperation({
    summary: 'Reactivate subscription',
    description: 'Reactivate a cancelled subscription',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription reactivated successfully',
    type: SubscriptionResponseDto,
  })
  async reactivateSubscription(@CurrentOrg() orgId: string) {
    const subscription = await this.billingService.reactivateSubscription(orgId);

    return {
      message: 'Subscription reactivated successfully',
      subscription,
    };
  }

  @Post('setup-intent')
  @Roles(OrgRole.owner)
  @ApiOperation({
    summary: 'Create setup intent',
    description: 'Create a Stripe setup intent for collecting payment method',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Setup intent created successfully',
  })
  async createSetupIntent(@CurrentOrg() orgId: string, @CurrentUser('email') userEmail: string) {
    // Initialize billing if it doesn't exist
    const billingAccount = await this.billingService.initializeBillingForOrganization(
      orgId,
      userEmail,
      'Organization Owner', // TODO: Get actual user name
    );

    const setupIntent = await this.stripeService.createSetupIntent(billingAccount.stripeCustomerId);

    return {
      message: 'Setup intent created successfully',
      clientSecret: setupIntent.client_secret,
    };
  }

  @Get('payment-methods')
  @Roles(OrgRole.owner, OrgRole.admin)
  @ApiOperation({
    summary: 'Get payment methods',
    description: 'Retrieve all payment methods for the organization',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment methods retrieved successfully',
  })
  async getPaymentMethods(
    @CurrentOrg() orgId: string,
    @CurrentUser('email') userEmail: string,
    @CurrentUser('name') userName: string,
  ) {
    // Initialize billing if it doesn't exist
    const billingAccount = await this.billingService.initializeBillingForOrganization(
      orgId,
      userEmail,
      userName || 'Organization Owner',
    );

    const paymentMethods = await this.stripeService.getPaymentMethods(
      billingAccount.stripeCustomerId,
    );

    return {
      message: 'Payment methods retrieved successfully',
      paymentMethods: paymentMethods.map((pm) => ({
        id: pm.id,
        type: pm.type,
        card: pm.card
          ? {
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
            }
          : null,
        isDefault: false, // TODO: Determine default payment method
      })),
    };
  }

  @Get('plans')
  @ApiOperation({
    summary: 'Get available plans',
    description: 'Retrieve all available billing plans',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Plans retrieved successfully',
  })
  async getAvailablePlans() {
    // Try to fetch from database first
    const dbPlans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    if (dbPlans.length > 0) {
      // Return plans from database
      const plans = dbPlans.map((plan) => ({
        id: plan.key,
        name: plan.name,
        price: Number(plan.price),
        currency: 'eur',
        interval: plan.interval,
        features: this.getPlanFeatures(plan.key),
        limits: {
          teams: plan.teamLimit || -1,
          members: plan.memberLimit || -1,
          standupConfigs: plan.standupConfigLimit || -1,
          standupsPerMonth: plan.standupLimit || -1,
        },
      }));

      return {
        message: 'Plans retrieved successfully',
        plans,
      };
    }

    // Fallback to default plans if none configured in database yet
    return {
      message: 'Plans retrieved successfully (using defaults - configure in admin portal)',
      plans: [
        {
          id: 'free',
          name: 'Free',
          price: 0,
          currency: 'eur',
          interval: 'month',
          features: [
            '1 team',
            '5 team members',
            '1 standup configuration',
            '5 standups per month',
            'Slack integration',
            'Basic reporting',
          ],
          limits: {
            teams: 1,
            members: 5,
            standupConfigs: 1,
            standupsPerMonth: 5,
          },
        },
        {
          id: 'pro',
          name: 'Pro',
          price: 2900, // €29.00 in cents
          currency: 'eur',
          interval: 'month',
          features: [
            'Unlimited teams',
            'Unlimited team members',
            'Unlimited standup configurations',
            'Unlimited standups',
            'Slack integration',
            'Advanced reporting',
            'Priority support',
          ],
          limits: {
            teams: -1, // Unlimited
            members: -1,
            standupConfigs: -1,
            standupsPerMonth: -1,
          },
        },
      ],
    };
  }

  @Get('downgrade-validation/:planKey')
  @Roles(OrgRole.owner, OrgRole.admin)
  @ApiOperation({
    summary: 'Validate downgrade feasibility',
    description: 'Check if organization can downgrade to specified plan',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Downgrade validation result',
  })
  async validateDowngrade(@CurrentOrg() orgId: string, @Param('planKey') planKey: string) {
    const targetPlan = await this.prisma.plan.findUnique({
      where: { key: planKey },
    });

    if (!targetPlan) {
      throw new NotFoundException(`Plan ${planKey} not found`);
    }

    const validation = await this.downgradeValidation.validateDowngrade(orgId, targetPlan);

    return {
      message: 'Downgrade validation completed',
      canDowngrade: validation.canDowngrade,
      warnings: validation.warnings,
      blockers: validation.blockers,
    };
  }

  @Get('invoices')
  @Roles(OrgRole.owner, OrgRole.admin)
  @ApiOperation({
    summary: 'Get billing invoices',
    description: 'Retrieve billing history and invoices for the organization',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoices retrieved successfully',
  })
  async getInvoices(
    @CurrentOrg() orgId: string,
    @CurrentUser('email') userEmail: string,
    @CurrentUser('name') userName: string,
  ) {
    try {
      // Initialize billing if it doesn't exist
      await this.billingService.initializeBillingForOrganization(
        orgId,
        userEmail,
        userName || 'Organization Owner',
      );

      const billingAccount = await this.billingService.getBillingAccount(orgId);
      if (!billingAccount?.stripeCustomerId) {
        return {
          message: 'No billing history found',
          invoices: [],
        };
      }

      const invoices = await this.stripeService.getInvoices(billingAccount.stripeCustomerId);

      return {
        message: 'Invoices retrieved successfully',
        invoices: invoices.map((invoice) => ({
          id: invoice.id,
          date: new Date(invoice.created * 1000).toISOString(),
          description: `${invoice.lines.data[0]?.description || 'Subscription'} - ${invoice.lines.data[0]?.period?.start ? new Date(invoice.lines.data[0].period.start * 1000).toLocaleDateString() : ''}`,
          amount: invoice.amount_paid || invoice.amount_due,
          status: this.mapInvoiceStatus(invoice.status, invoice.status === 'paid'),
          invoiceUrl: invoice.hosted_invoice_url,
          downloadUrl: invoice.invoice_pdf,
        })),
      };
    } catch {
      return {
        message: 'No billing history found',
        invoices: [],
      };
    }
  }

  @Get('invoices/:invoiceId/download')
  @Roles(OrgRole.owner, OrgRole.admin)
  @ApiOperation({
    summary: 'Download invoice PDF',
    description: 'Download invoice as PDF file',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice PDF downloaded successfully',
  })
  async downloadInvoice(
    @CurrentOrg() orgId: string,
    @Param('invoiceId') invoiceId: string,
    @Res() res: Response,
    @CurrentUser('email') userEmail: string,
    @CurrentUser('name') userName: string,
  ) {
    try {
      // Initialize billing if it doesn't exist
      await this.billingService.initializeBillingForOrganization(
        orgId,
        userEmail,
        userName || 'Organization Owner',
      );

      const billingAccount = await this.billingService.getBillingAccount(orgId);
      if (!billingAccount?.stripeCustomerId) {
        throw new NotFoundException('No billing account found');
      }

      const invoice = await this.stripeService.getInvoice(invoiceId);

      if (!invoice.invoice_pdf) {
        throw new BadRequestException('Invoice PDF not available');
      }

      // Redirect to Stripe's invoice PDF URL
      return res.redirect(invoice.invoice_pdf);
    } catch {
      throw new NotFoundException('Invoice not found');
    }
  }

  @Post('invoices/:invoiceId/retry')
  @Roles(OrgRole.owner, OrgRole.admin)
  @ApiOperation({
    summary: 'Retry failed payment',
    description: 'Retry payment for a failed invoice',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment retry initiated successfully',
  })
  async retryPayment(
    @CurrentOrg() orgId: string,
    @Param('invoiceId') invoiceId: string,
    @CurrentUser('email') userEmail: string,
    @CurrentUser('name') userName: string,
  ) {
    try {
      // Initialize billing if it doesn't exist
      await this.billingService.initializeBillingForOrganization(
        orgId,
        userEmail,
        userName || 'Organization Owner',
      );

      const billingAccount = await this.billingService.getBillingAccount(orgId);
      if (!billingAccount?.stripeCustomerId) {
        throw new NotFoundException('No billing account found');
      }

      // Attempt to pay the invoice
      const result = await this.stripeService.retryInvoicePayment(invoiceId);

      return {
        message: 'Payment retry initiated successfully',
        success: result.status === 'paid',
        status: result.status,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to retry payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @Post('payment-methods')
  @Roles(OrgRole.owner)
  @ApiOperation({
    summary: 'Add payment method',
    description: 'Add a new payment method for the organization',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Payment method added successfully',
  })
  async addPaymentMethod(
    @CurrentOrg() orgId: string,
    @Body() body: { paymentMethodId: string; setAsDefault?: boolean },
    @CurrentUser('email') userEmail: string,
    @CurrentUser('name') userName: string,
  ) {
    try {
      // Initialize billing if it doesn't exist
      await this.billingService.initializeBillingForOrganization(
        orgId,
        userEmail,
        userName || 'Organization Owner',
      );

      const billingAccount = await this.billingService.getBillingAccount(orgId);
      if (!billingAccount?.stripeCustomerId) {
        throw new NotFoundException('No billing account found');
      }

      // Attach payment method to customer
      await this.stripeService.attachPaymentMethod(
        body.paymentMethodId,
        billingAccount.stripeCustomerId,
      );

      // Set as default if requested
      if (body.setAsDefault) {
        await this.stripeService.setDefaultPaymentMethod(
          billingAccount.stripeCustomerId,
          body.paymentMethodId,
        );
      }

      // Get the updated payment method details
      const paymentMethod = await this.stripeService.getPaymentMethod(body.paymentMethodId);

      return {
        message: 'Payment method added successfully',
        paymentMethod: {
          id: paymentMethod.id,
          type: paymentMethod.type,
          card: paymentMethod.card
            ? {
                brand: paymentMethod.card.brand,
                last4: paymentMethod.card.last4,
                expMonth: paymentMethod.card.exp_month,
                expYear: paymentMethod.card.exp_year,
              }
            : null,
          isDefault: body.setAsDefault || false,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to add payment method: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @Delete('payment-methods/:paymentMethodId')
  @Roles(OrgRole.owner, OrgRole.admin)
  @ApiOperation({
    summary: 'Remove payment method',
    description: 'Remove a payment method from the organization',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment method removed successfully',
  })
  async removePaymentMethod(@Param('paymentMethodId') paymentMethodId: string) {
    try {
      // Detach payment method from Stripe
      await this.stripeService.detachPaymentMethod(paymentMethodId);

      return {
        message: 'Payment method removed successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to remove payment method: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private getPlanFeatures(planKey: string): string[] {
    const featureMap: Record<string, string[]> = {
      free: [
        '1 team',
        '5 team members',
        '1 standup configuration',
        '5 standups per month',
        'Slack integration',
        'Basic reporting',
      ],
      pro: [
        'Unlimited teams',
        'Unlimited team members',
        'Unlimited standup configurations',
        'Unlimited standups',
        'Slack integration',
        'Advanced reporting',
        'Priority support',
      ],
    };
    return featureMap[planKey] || [];
  }

  private mapInvoiceStatus(
    stripeStatus: string | null,
    paid: boolean,
  ): 'paid' | 'failed' | 'pending' | 'refunded' {
    if (paid) return 'paid';
    if (stripeStatus === 'open') return 'pending';
    if (stripeStatus === 'paid') return 'paid';
    if (stripeStatus === 'void') return 'failed';
    if (stripeStatus === 'uncollectible') return 'failed';
    return 'pending';
  }
}
