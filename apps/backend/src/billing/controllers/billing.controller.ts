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
  Query,
  NotFoundException,
  Res,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
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
import { CacheService } from '@/common/cache/cache.service';

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
    private readonly cacheService: CacheService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(BillingController.name);
  }

  @Get('subscription/debug')
  @Roles(OrgRole.owner, OrgRole.admin)
  @ApiOperation({
    summary: 'Debug - Get full Stripe subscription details',
    description: 'Get complete Stripe subscription data including invoices for debugging',
  })
  async debugSubscription(@CurrentOrg() orgId: string) {
    try {
      const billingAccount = await this.billingService.getBillingAccount(orgId);
      if (!billingAccount) {
        return { message: 'No billing account found' };
      }

      const subscription = await this.prisma.subscription.findFirst({
        where: {
          billingAccount: {
            orgId,
          },
          status: {
            in: ['active', 'trialing', 'past_due', 'canceled'],
          },
        },
        include: {
          plan: true,
        },
      });

      if (!subscription) {
        return { message: 'No subscription found' };
      }

      // Get full Stripe subscription with expanded data
      const stripeSubscription = await this.stripeService.stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId,
        {
          expand: ['latest_invoice', 'latest_invoice.payment_intent', 'items.data.price'],
        },
      );

      // Get recent invoices
      const invoices = await this.stripeService.stripe.invoices.list({
        customer: billingAccount.stripeCustomerId,
        subscription: subscription.stripeSubscriptionId,
        limit: 10,
      });

      return {
        database: {
          subscription,
          billingAccount,
        },
        stripe: {
          subscription: stripeSubscription,
          invoices: invoices.data,
        },
      };
    } catch (error) {
      this.logger.error('Debug subscription failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
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

    // CRITICAL: Verify the billing account belongs to this organization
    if (billingAccount.orgId !== orgId) {
      throw new BadRequestException('Billing account does not belong to this organization');
    }

    const paymentMethods = await this.stripeService.getPaymentMethods(
      billingAccount.stripeCustomerId,
      orgId, // Pass orgId for additional verification
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
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '5',
    @Query('startingAfter') startingAfter?: string,
    @Query('endingBefore') endingBefore?: string,
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    try {
      // Parse pagination parameters
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 5));

      // Get billing account - don't auto-initialize for performance
      const billingAccount = await this.billingService.getBillingAccount(orgId);

      if (!billingAccount?.stripeCustomerId) {
        return {
          message: 'No billing history found',
          invoices: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0,
          },
        };
      }

      // CRITICAL: Verify the billing account belongs to this organization
      if (billingAccount.orgId !== orgId) {
        throw new BadRequestException('Billing account does not belong to this organization');
      }

      // Cursor-based path if cursors provided; else use page/limit strategy
      const useCursor = Boolean(startingAfter || endingBefore);
      const cacheKey = useCursor
        ? this.cacheService.buildKey(
            'billing-invoices-cursor',
            orgId,
            limitNum,
            startingAfter || 'none',
            endingBefore || 'none',
          )
        : this.cacheService.buildKey('billing-invoices', orgId, pageNum, limitNum);

      const invoicesResult = await this.cacheService.getOrSet(
        cacheKey,
        async () => {
          if (useCursor) {
            const cursorResult = await this.stripeService.getInvoicesByCursor(
              billingAccount.stripeCustomerId,
              limitNum,
              { startingAfter, endingBefore },
            );
            return {
              invoices: cursorResult.invoices,
              total: cursorResult.hasMore ? limitNum + 1 : cursorResult.invoices.length,
            };
          } else {
            return this.stripeService.getInvoicesWithPagination(
              billingAccount.stripeCustomerId,
              pageNum,
              limitNum,
            );
          }
        },
        120,
      );

      // Build response payload
      const payload = {
        message: 'Invoices retrieved successfully',
        invoices: invoicesResult.invoices.map((invoice) => ({
          id: invoice.id,
          date: new Date(invoice.created * 1000).toISOString(),
          description: `${
            (invoice as { description?: string })?.description ||
            (
              invoice as {
                lines?: { data?: Array<{ description?: string; period?: { start?: number } }> };
              }
            )?.lines?.data?.[0]?.description ||
            'Subscription'
          }${
            (invoice as { lines?: { data?: Array<{ period?: { start?: number } }> } })?.lines
              ?.data?.[0]?.period?.start
              ? ` - ${new Date(
                  ((invoice as { lines?: { data?: Array<{ period?: { start?: number } }> } })?.lines
                    ?.data?.[0]?.period?.start as number) * 1000,
                )
                  .toISOString()
                  .slice(0, 10)}`
              : ''
          }`,
          amount: invoice.amount_paid || invoice.amount_due,
          status: this.mapInvoiceStatus(invoice.status, invoice.status === 'paid'),
          invoiceUrl: invoice.hosted_invoice_url,
          downloadUrl: invoice.invoice_pdf,
        })),
        pagination: useCursor
          ? undefined
          : {
              page: pageNum,
              limit: limitNum,
              total: invoicesResult.total,
              totalPages: Math.ceil(invoicesResult.total / limitNum),
            },
      };

      // Lightweight ETag based on IDs and total
      try {
        const firstId = payload.invoices[0]?.id || 'none';
        const lastId = payload.invoices[payload.invoices.length - 1]?.id || 'none';
        const totalMarker = useCursor ? payload.invoices.length : payload.pagination?.total || 0;
        const etag = `W/"${orgId}:${useCursor ? 'cursor' : pageNum}:${limitNum}:${firstId}:${lastId}:${totalMarker}"`;

        if (res) {
          res.setHeader('Cache-Control', 'private, max-age=120');
          res.setHeader('ETag', etag);
        }

        if (req && req.headers['if-none-match'] === etag && res) {
          res.status(HttpStatus.NOT_MODIFIED);
          return;
        }
      } catch {
        // Ignore ETag parsing errors
      }

      return payload;
    } catch {
      return {
        message: 'No billing history found',
        invoices: [],
        pagination: {
          page: 1,
          limit: parseInt(limit, 10) || 5,
          total: 0,
          totalPages: 0,
        },
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

      // CRITICAL: Verify the billing account belongs to this organization
      if (billingAccount.orgId !== orgId) {
        throw new BadRequestException('Billing account does not belong to this organization');
      }

      const invoice = await this.stripeService.getInvoice(invoiceId);

      // Verify the invoice belongs to this customer
      if (invoice.customer !== billingAccount.stripeCustomerId) {
        throw new NotFoundException('Invoice not found');
      }

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

      // CRITICAL: Verify the billing account belongs to this organization
      if (billingAccount.orgId !== orgId) {
        throw new BadRequestException('Billing account does not belong to this organization');
      }

      // Verify the invoice belongs to this customer
      const invoice = await this.stripeService.getInvoice(invoiceId);
      if (invoice.customer !== billingAccount.stripeCustomerId) {
        throw new NotFoundException('Invoice not found');
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

      // CRITICAL: Verify the billing account belongs to this organization
      if (billingAccount.orgId !== orgId) {
        throw new BadRequestException('Billing account does not belong to this organization');
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

  @Post('process-pending-invoices')
  @Roles(OrgRole.owner)
  @ApiOperation({ summary: 'Process any pending invoices for the organization' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pending invoices processed',
  })
  async processPendingInvoices(
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
        throw new NotFoundException('No billing account found');
      }

      // CRITICAL: Verify the billing account belongs to this organization
      if (billingAccount.orgId !== orgId) {
        throw new BadRequestException('Billing account does not belong to this organization');
      }

      // Get all pending invoice items
      const pendingItems = await this.stripeService.stripe.invoiceItems.list({
        customer: billingAccount.stripeCustomerId,
        pending: true,
        limit: 100,
      });

      // Get all draft invoices
      const draftInvoices = await this.stripeService.stripe.invoices.list({
        customer: billingAccount.stripeCustomerId,
        status: 'draft',
        limit: 10,
      });

      // Get all open invoices
      const openInvoices = await this.stripeService.stripe.invoices.list({
        customer: billingAccount.stripeCustomerId,
        status: 'open',
        limit: 10,
      });

      const processed = {
        pendingItems: pendingItems.data.length,
        draftInvoices: [],
        openInvoices: [],
        errors: [],
      };

      // Process draft invoices
      for (const invoice of draftInvoices.data) {
        try {
          if (invoice.amount_due > 0) {
            // Finalize the invoice
            const finalized = await this.stripeService.stripe.invoices.finalizeInvoice(invoice.id, {
              auto_advance: true,
            });

            processed.draftInvoices.push({
              id: finalized.id,
              amount: finalized.amount_due,
              status: finalized.status,
            });

            // Try to pay if still open
            if (finalized.status === 'open' && finalized.amount_due > 0) {
              try {
                const paid = await this.stripeService.stripe.invoices.pay(finalized.id);
                processed.draftInvoices[processed.draftInvoices.length - 1].status = paid.status;
              } catch (payError) {
                processed.errors.push({
                  invoice: finalized.id,
                  error: payError instanceof Error ? payError.message : 'Payment failed',
                });
              }
            }
          }
        } catch (error) {
          processed.errors.push({
            invoice: invoice.id,
            error: error instanceof Error ? error.message : 'Processing failed',
          });
        }
      }

      // Process open invoices
      for (const invoice of openInvoices.data) {
        try {
          // Safely detect if payment_intent exists without relying on Stripe's type expansion
          const invoiceObj: unknown = invoice as unknown;
          const hasPaymentIntent =
            typeof invoiceObj === 'object' &&
            invoiceObj !== null &&
            'payment_intent' in invoiceObj &&
            Boolean((invoiceObj as { payment_intent?: unknown }).payment_intent);
          if (invoice.amount_due > 0 && !hasPaymentIntent) {
            const paid = await this.stripeService.stripe.invoices.pay(invoice.id);
            processed.openInvoices.push({
              id: paid.id,
              amount: paid.amount_paid,
              status: paid.status,
            });
          }
        } catch (error) {
          processed.errors.push({
            invoice: invoice.id,
            error: error instanceof Error ? error.message : 'Payment failed',
          });
        }
      }

      // If there are pending items but no invoices, create one
      if (pendingItems.data.length > 0 && draftInvoices.data.length === 0) {
        try {
          const newInvoice = await this.stripeService.stripe.invoices.create({
            customer: billingAccount.stripeCustomerId,
            auto_advance: true,
          });

          processed.draftInvoices.push({
            id: newInvoice.id,
            amount: newInvoice.amount_due,
            status: newInvoice.status,
            created: true,
          });
        } catch (error) {
          processed.errors.push({
            action: 'create_invoice',
            error: error instanceof Error ? error.message : 'Failed to create invoice',
          });
        }
      }

      return {
        message: 'Processed pending invoices',
        processed,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to process pending invoices: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
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
