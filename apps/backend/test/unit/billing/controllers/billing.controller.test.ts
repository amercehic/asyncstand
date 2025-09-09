import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingController } from '@/billing/controllers/billing.controller';
import { BillingService } from '@/billing/services/billing.service';
import { StripeService } from '@/billing/services/stripe.service';
import { DowngradeValidationService } from '@/billing/services/downgrade-validation.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { createMockLoggerService } from '@/test/utils/mocks/services.mock';
import { Plan, Subscription, BillingAccount, SubscriptionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import Stripe from 'stripe';

describe('BillingController', () => {
  let controller: BillingController;
  let mockBillingService: jest.Mocked<BillingService>;
  let mockStripeService: jest.Mocked<StripeService>;
  let mockDowngradeValidation: jest.Mocked<DowngradeValidationService>;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockLoggerService: ReturnType<typeof createMockLoggerService>;

  const mockBillingAccount: BillingAccount = {
    id: 'billing-account-1',
    orgId: 'org-1',
    stripeCustomerId: 'cus_123',
    billingEmail: 'billing@example.com',
    defaultPaymentMethod: null,
    taxId: null,
    country: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPlan: Plan = {
    id: 'plan-1',
    key: 'pro',
    name: 'Pro',
    displayName: 'Pro Plan',
    description: 'Professional plan',
    price: new Decimal(2999),
    interval: 'month',
    stripePriceId: 'price_123',
    isActive: true,
    sortOrder: 1,
    memberLimit: null,
    teamLimit: null,
    standupConfigLimit: null,
    standupLimit: null,
    storageLimit: null,
    integrationLimit: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSubscription: Subscription = {
    id: 'subscription-1',
    billingAccountId: 'billing-account-1',
    planId: 'plan-1',
    stripeSubscriptionId: 'sub_123',
    status: 'active' as SubscriptionStatus,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(),
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSubscriptionResponse = {
    id: 'subscription-1',
    organizationId: 'org-1',
    planId: 'plan-1',
    planKey: 'pro',
    status: SubscriptionStatus.active,
    stripeSubscriptionId: 'sub_123',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(),
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStripeSubscription = {
    id: 'sub_123',
    object: 'subscription',
    status: 'active',
    created: Date.now() / 1000,
    current_period_start: Date.now() / 1000,
    current_period_end: Date.now() / 1000 + 30 * 24 * 60 * 60,
    cancel_at_period_end: false,
    customer: 'cus_123',
    items: {
      object: 'list',
      data: [
        {
          id: 'si_123',
          object: 'subscription_item',
          created: Date.now() / 1000,
          subscription: 'sub_123',
          current_period_start: Date.now() / 1000,
          current_period_end: Date.now() / 1000 + 30 * 24 * 60 * 60,
        },
      ],
    },
    latest_invoice: null,
  } as unknown as Stripe.Subscription;

  beforeEach(async () => {
    mockBillingService = {
      initializeBillingForOrganization: jest.fn(),
      getBillingAccount: jest.fn(),
      getSubscription: jest.fn(),
      createSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      reactivateSubscription: jest.fn(),
    } as unknown as jest.Mocked<BillingService>;

    mockStripeService = {
      createSetupIntent: jest.fn(),
      getPaymentMethods: jest.fn(),
      stripe: {
        subscriptions: {
          retrieve: jest.fn(),
        },
        invoices: {
          list: jest.fn(),
        },
      },
    } as unknown as jest.Mocked<StripeService>;

    mockDowngradeValidation = {
      validateDowngrade: jest.fn(),
    } as unknown as jest.Mocked<DowngradeValidationService>;

    const createMockPrismaMethod = () => jest.fn();

    mockPrismaService = {
      subscription: {
        findFirst: createMockPrismaMethod(),
      },
      plan: {
        findMany: createMockPrismaMethod(),
        findFirst: createMockPrismaMethod(),
        findUnique: createMockPrismaMethod(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: mockBillingService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: DowngradeValidationService, useValue: mockDowngradeValidation },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    controller = module.get<BillingController>(BillingController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('debugSubscription', () => {
    it('should return debug info when subscription exists', async () => {
      const subscriptionWithPlan = { ...mockSubscription, plan: mockPlan };

      mockBillingService.getBillingAccount.mockResolvedValue(mockBillingAccount);
      (mockPrismaService.subscription.findFirst as jest.Mock).mockResolvedValue(
        subscriptionWithPlan,
      );
      (mockStripeService.stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue(
        mockStripeSubscription,
      );
      (mockStripeService.stripe.invoices.list as jest.Mock).mockResolvedValue({
        data: [{ id: 'in_123', status: 'paid' }],
      });

      const result = await controller.debugSubscription('org-1');

      expect(result).toEqual({
        database: {
          subscription: subscriptionWithPlan,
          billingAccount: mockBillingAccount,
        },
        stripe: {
          subscription: mockStripeSubscription,
          invoices: [{ id: 'in_123', status: 'paid' }],
        },
      });

      expect(mockStripeService.stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123', {
        expand: ['latest_invoice', 'latest_invoice.payment_intent', 'items.data.price'],
      });
    });

    it('should return message when no billing account found', async () => {
      mockBillingService.getBillingAccount.mockResolvedValue(null);

      const result = await controller.debugSubscription('org-1');

      expect(result).toEqual({ message: 'No billing account found' });
    });

    it('should return message when no subscription found', async () => {
      mockBillingService.getBillingAccount.mockResolvedValue(mockBillingAccount);
      (mockPrismaService.subscription.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await controller.debugSubscription('org-1');

      expect(result).toEqual({ message: 'No subscription found' });
    });

    it('should handle errors gracefully', async () => {
      mockBillingService.getBillingAccount.mockRejectedValue(new Error('Database error'));

      const result = await controller.debugSubscription('org-1');

      expect(result).toEqual({ error: 'Database error' });
      expect(mockLoggerService.error).toHaveBeenCalledWith('Debug subscription failed', {
        error: 'Database error',
      });
    });
  });

  describe('getCurrentSubscription', () => {
    it('should return subscription when it exists', async () => {
      mockBillingService.initializeBillingForOrganization.mockResolvedValue(mockBillingAccount);
      mockBillingService.getSubscription.mockResolvedValue(mockSubscriptionResponse);
      (mockPrismaService.plan.findUnique as jest.Mock).mockResolvedValue({ key: 'pro' });

      const result = await controller.getCurrentSubscription(
        'org-1',
        'user@example.com',
        'User Name',
      );

      expect(result).toEqual({
        message: 'Subscription retrieved successfully',
        plan: 'pro',
        subscription: mockSubscriptionResponse,
      });
      expect(mockBillingService.initializeBillingForOrganization).toHaveBeenCalledWith(
        'org-1',
        'user@example.com',
        'User Name',
      );
    });

    it('should return free plan message when no subscription exists', async () => {
      mockBillingService.initializeBillingForOrganization.mockResolvedValue(mockBillingAccount);
      mockBillingService.getSubscription.mockResolvedValue(null);

      const result = await controller.getCurrentSubscription(
        'org-1',
        'user@example.com',
        'User Name',
      );

      expect(result).toEqual({
        message: 'Organization is on free plan',
        plan: 'free',
        subscription: null,
      });
    });

    it('should use default name when userName is not provided', async () => {
      mockBillingService.initializeBillingForOrganization.mockResolvedValue(mockBillingAccount);
      mockBillingService.getSubscription.mockResolvedValue(mockSubscriptionResponse);
      (mockPrismaService.plan.findUnique as jest.Mock).mockResolvedValue({ key: 'pro' });

      await controller.getCurrentSubscription('org-1', 'user@example.com', null);

      expect(mockBillingService.initializeBillingForOrganization).toHaveBeenCalledWith(
        'org-1',
        'user@example.com',
        'Organization Owner',
      );
    });
  });

  describe('createSubscription', () => {
    const createDto = {
      planId: 'pro',
      paymentMethodId: 'pm_123',
    };

    it('should create subscription successfully', async () => {
      mockBillingService.createSubscription.mockResolvedValue(mockSubscriptionResponse);

      const result = await controller.createSubscription('org-1', createDto);

      expect(result).toEqual({
        message: 'Subscription created successfully',
        subscription: mockSubscriptionResponse,
      });
      expect(mockBillingService.createSubscription).toHaveBeenCalledWith('org-1', createDto);
    });

    it('should call billing service to create subscription', async () => {
      mockBillingService.createSubscription.mockResolvedValue(mockSubscriptionResponse);

      const result = await controller.createSubscription('org-1', createDto);

      expect(result).toEqual({
        message: 'Subscription created successfully',
        subscription: mockSubscriptionResponse,
      });
      expect(mockBillingService.createSubscription).toHaveBeenCalledWith('org-1', createDto);
    });

    it('should propagate service errors', async () => {
      mockBillingService.createSubscription.mockRejectedValue(
        new BadRequestException('Plan not found'),
      );

      await expect(controller.createSubscription('org-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateSubscription', () => {
    const updateDto = {
      planId: 'enterprise',
    };

    it('should update subscription successfully', async () => {
      const updatedSubscription = { ...mockSubscriptionResponse, planKey: 'enterprise' };
      mockBillingService.updateSubscription.mockResolvedValue(updatedSubscription);

      const result = await controller.updateSubscription('org-1', updateDto);

      expect(result).toEqual({
        message: 'Subscription updated successfully',
        subscription: updatedSubscription,
      });
      expect(mockBillingService.updateSubscription).toHaveBeenCalledWith('org-1', updateDto);
    });

    it('should propagate service errors', async () => {
      mockBillingService.updateSubscription.mockRejectedValue(
        new BadRequestException('Cannot downgrade due to usage constraints'),
      );

      await expect(controller.updateSubscription('org-1', updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription with default cancelAtPeriodEnd', async () => {
      const cancelledSubscription = { ...mockSubscriptionResponse, cancelAtPeriodEnd: true };
      mockBillingService.cancelSubscription.mockResolvedValue(cancelledSubscription);

      const result = await controller.cancelSubscription('org-1', {});

      expect(result).toEqual({
        message: 'Subscription will be canceled at period end',
        subscription: cancelledSubscription,
      });
      expect(mockBillingService.cancelSubscription).toHaveBeenCalledWith('org-1', true);
    });

    it('should cancel subscription immediately when specified', async () => {
      const cancelledSubscription = {
        ...mockSubscriptionResponse,
        status: SubscriptionStatus.canceled,
      };
      mockBillingService.cancelSubscription.mockResolvedValue(cancelledSubscription);

      const result = await controller.cancelSubscription('org-1', { immediate: true });

      expect(result).toEqual({
        message: 'Subscription canceled immediately',
        subscription: cancelledSubscription,
      });
      expect(mockBillingService.cancelSubscription).toHaveBeenCalledWith('org-1', false);
    });
  });

  describe('reactivateSubscription', () => {
    it('should reactivate subscription successfully', async () => {
      const reactivatedSubscription = { ...mockSubscriptionResponse, cancelAtPeriodEnd: false };
      mockBillingService.reactivateSubscription.mockResolvedValue(reactivatedSubscription);

      const result = await controller.reactivateSubscription('org-1');

      expect(result).toEqual({
        message: 'Subscription reactivated successfully',
        subscription: reactivatedSubscription,
      });
      expect(mockBillingService.reactivateSubscription).toHaveBeenCalledWith('org-1');
    });

    it('should propagate service errors', async () => {
      mockBillingService.reactivateSubscription.mockRejectedValue(
        new BadRequestException('Subscription is not canceled'),
      );

      await expect(controller.reactivateSubscription('org-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAvailablePlans', () => {
    it('should return available plans from database', async () => {
      const plans = [
        { ...mockPlan, key: 'free', name: 'Free' },
        { ...mockPlan, key: 'pro', name: 'Pro' },
        { ...mockPlan, key: 'enterprise', name: 'Enterprise' },
      ];

      (mockPrismaService.plan.findMany as jest.Mock).mockResolvedValue(plans);

      const result = await controller.getAvailablePlans();

      expect(result.message).toBe('Plans retrieved successfully');
      expect(result.plans).toHaveLength(3);
      expect(mockPrismaService.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully in debug endpoint', async () => {
      mockBillingService.getBillingAccount.mockRejectedValue(new Error('Service unavailable'));

      const result = await controller.debugSubscription('org-1');

      expect(result).toEqual({ error: 'Service unavailable' });
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    it('should propagate expected errors from services', async () => {
      const createDto = { planId: 'invalid', paymentMethodId: 'pm_123' };
      mockBillingService.createSubscription.mockRejectedValue(
        new NotFoundException('Plan not found'),
      );

      await expect(controller.createSubscription('org-1', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
