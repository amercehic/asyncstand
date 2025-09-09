import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BillingService } from '@/billing/services/billing.service';
import { StripeService } from '@/billing/services/stripe.service';
import { DowngradeValidationService } from '@/billing/services/downgrade-validation.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { createMockLoggerService } from '@/test/utils/mocks/services.mock';
import { Plan, Subscription, SubscriptionStatus, BillingAccount } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import Stripe from 'stripe';

describe('BillingService', () => {
  let service: BillingService;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockStripeService: jest.Mocked<StripeService>;
  let mockDowngradeValidation: jest.Mocked<DowngradeValidationService>;
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

  const mockStripeCustomer = {
    id: 'cus_123',
    object: 'customer',
    created: Date.now() / 1000,
    email: 'billing@example.com',
    livemode: false,
    metadata: { organizationId: 'org-1' },
  } as unknown as Stripe.Customer;

  const mockStripeSubscription: Stripe.Subscription = {
    id: 'sub_123',
    object: 'subscription',
    status: 'active',
    created: Date.now() / 1000,
    current_period_start: Date.now() / 1000,
    current_period_end: Date.now() / 1000 + 30 * 24 * 60 * 60, // 30 days from now
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
  } as unknown as Stripe.Subscription;

  beforeEach(async () => {
    const createMockPrismaMethod = () => jest.fn();

    mockPrismaService = {
      billingAccount: {
        create: createMockPrismaMethod(),
        findUnique: createMockPrismaMethod(),
        update: createMockPrismaMethod(),
      },
      organization: {
        findUnique: createMockPrismaMethod(),
      },
      plan: {
        findUnique: createMockPrismaMethod(),
      },
      subscription: {
        create: createMockPrismaMethod(),
        findFirst: createMockPrismaMethod(),
        update: createMockPrismaMethod(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    mockStripeService = {
      createOrGetCustomer: jest.fn(),
      createSubscription: jest.fn(),
      getSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
    } as unknown as jest.Mocked<StripeService>;

    mockDowngradeValidation = {
      validateDowngrade: jest.fn(),
    } as unknown as jest.Mocked<DowngradeValidationService>;

    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: DowngradeValidationService, useValue: mockDowngradeValidation },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeBillingForOrganization', () => {
    it('should return existing billing account if it exists', async () => {
      (mockPrismaService.billingAccount.findUnique as jest.Mock).mockResolvedValue(
        mockBillingAccount,
      );

      const result = await service.initializeBillingForOrganization(
        'org-1',
        'owner@example.com',
        'Owner',
      );

      expect(result).toEqual(mockBillingAccount);
      expect(mockPrismaService.billingAccount.findUnique).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
      });
      expect(mockStripeService.createOrGetCustomer).not.toHaveBeenCalled();
    });

    it('should create new billing account if none exists', async () => {
      (mockPrismaService.billingAccount.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.organization.findUnique as jest.Mock).mockResolvedValue({
        id: 'org-1',
        name: 'Test Organization',
      });
      mockStripeService.createOrGetCustomer.mockResolvedValue(mockStripeCustomer);
      (mockPrismaService.billingAccount.create as jest.Mock).mockResolvedValue(mockBillingAccount);

      const result = await service.initializeBillingForOrganization(
        'org-1',
        'owner@example.com',
        'Owner',
      );

      expect(result).toEqual(mockBillingAccount);
      expect(mockStripeService.createOrGetCustomer).toHaveBeenCalledWith(
        'org-1',
        'owner@example.com',
        'Test Organization',
      );
      expect(mockPrismaService.billingAccount.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-1',
          stripeCustomerId: 'cus_123',
          billingEmail: 'owner@example.com',
        },
      });
    });

    it('should use owner name as customer name if organization not found', async () => {
      (mockPrismaService.billingAccount.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.organization.findUnique as jest.Mock).mockResolvedValue(null);
      mockStripeService.createOrGetCustomer.mockResolvedValue(mockStripeCustomer);
      (mockPrismaService.billingAccount.create as jest.Mock).mockResolvedValue(mockBillingAccount);

      await service.initializeBillingForOrganization('org-1', 'owner@example.com', 'Owner');

      expect(mockStripeService.createOrGetCustomer).toHaveBeenCalledWith(
        'org-1',
        'owner@example.com',
        'Owner',
      );
    });
  });

  describe('createSubscription', () => {
    const createDto = {
      planId: 'pro',
      paymentMethodId: 'pm_123',
    };

    beforeEach(() => {
      (mockPrismaService.billingAccount.findUnique as jest.Mock).mockResolvedValue(
        mockBillingAccount,
      );
    });

    it('should throw NotFoundException if plan not found', async () => {
      (mockPrismaService.plan.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createSubscription('org-1', createDto)).rejects.toThrow(
        new NotFoundException('Plan pro not found'),
      );
    });

    it('should throw BadRequestException if plan has no Stripe price ID', async () => {
      const planWithoutPrice = { ...mockPlan, stripePriceId: null };
      (mockPrismaService.plan.findUnique as jest.Mock).mockResolvedValue(planWithoutPrice);

      await expect(service.createSubscription('org-1', createDto)).rejects.toThrow(
        new BadRequestException('Plan Pro is not available for subscription'),
      );
    });

    it('should throw BadRequestException if organization already has active subscription', async () => {
      (mockPrismaService.plan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (mockPrismaService.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);

      await expect(service.createSubscription('org-1', createDto)).rejects.toThrow(
        new BadRequestException('Organization already has an active subscription'),
      );
    });

    it('should create subscription successfully', async () => {
      (mockPrismaService.plan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (mockPrismaService.subscription.findFirst as jest.Mock).mockResolvedValue(null);
      mockStripeService.createSubscription.mockResolvedValue(mockStripeSubscription);
      (mockPrismaService.subscription.create as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.createSubscription('org-1', createDto);

      expect(mockStripeService.createSubscription).toHaveBeenCalledWith(
        'cus_123',
        'price_123',
        'pm_123',
      );
      expect(mockPrismaService.subscription.create).toHaveBeenCalledWith({
        data: {
          billingAccountId: 'billing-account-1',
          planId: 'plan-1',
          stripeSubscriptionId: 'sub_123',
          status: 'active',
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
          cancelAtPeriodEnd: false,
        },
      });
      expect(result).toMatchObject({
        id: 'subscription-1',
        organizationId: 'org-1',
        planId: 'plan-1',
        planKey: 'pro',
        status: 'active',
        stripeSubscriptionId: 'sub_123',
      });
    });

    it('should update subscription status to active if Stripe shows active', async () => {
      const incompleteSubscription = {
        ...mockSubscription,
        status: 'incomplete' as SubscriptionStatus,
      };

      (mockPrismaService.plan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (mockPrismaService.subscription.findFirst as jest.Mock).mockResolvedValue(null);
      mockStripeService.createSubscription.mockResolvedValue(mockStripeSubscription);
      (mockPrismaService.subscription.create as jest.Mock).mockResolvedValue(
        incompleteSubscription,
      );
      (mockPrismaService.subscription.update as jest.Mock).mockResolvedValue(mockSubscription);

      await service.createSubscription('org-1', createDto);

      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: 'subscription-1' },
        data: { status: 'active' },
      });
    });
  });

  describe('getSubscription', () => {
    it('should return null if no billing account exists', async () => {
      (mockPrismaService.billingAccount.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getSubscription('org-1');

      expect(result).toBeNull();
    });

    it('should return null if no subscription exists', async () => {
      (mockPrismaService.billingAccount.findUnique as jest.Mock).mockResolvedValue({
        ...mockBillingAccount,
        subscription: null,
      });

      const result = await service.getSubscription('org-1');

      expect(result).toBeNull();
    });

    it('should return formatted subscription response', async () => {
      (mockPrismaService.billingAccount.findUnique as jest.Mock).mockResolvedValue({
        ...mockBillingAccount,
        subscription: {
          ...mockSubscription,
          plan: mockPlan,
        },
      });

      const result = await service.getSubscription('org-1');

      expect(result).toMatchObject({
        id: 'subscription-1',
        organizationId: 'org-1',
        planId: 'plan-1',
        planKey: 'pro',
        status: 'active',
        stripeSubscriptionId: 'sub_123',
      });
    });
  });

  describe('updateSubscription', () => {
    const updateDto = { planId: 'enterprise', status: 'active' as SubscriptionStatus };

    beforeEach(() => {
      (mockPrismaService.billingAccount.findUnique as jest.Mock).mockResolvedValue(
        mockBillingAccount,
      );
      (mockPrismaService.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);
    });

    it('should handle plan change with upgrade', async () => {
      const currentPlan = mockPlan;
      const newPlan = { ...mockPlan, key: 'enterprise', price: new Decimal(4999) };

      (mockPrismaService.plan.findUnique as jest.Mock)
        .mockResolvedValueOnce(currentPlan) // current plan lookup
        .mockResolvedValueOnce(newPlan); // new plan lookup

      mockStripeService.getSubscription.mockResolvedValue(mockStripeSubscription);
      mockStripeService.updateSubscription.mockResolvedValue(mockStripeSubscription);
      (mockPrismaService.subscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        plan: newPlan,
      });

      const result = await service.updateSubscription('org-1', updateDto);

      expect(mockStripeService.updateSubscription).toHaveBeenCalledWith(
        'sub_123',
        expect.objectContaining({
          proration_behavior: 'always_invoice', // upgrade
          proration_date: expect.any(Number),
        }),
      );
      expect(result.planKey).toBe('enterprise');
    });

    it('should handle plan change with downgrade validation', async () => {
      const currentPlan = { ...mockPlan, key: 'enterprise', price: new Decimal(4999) };
      const newPlan = { ...mockPlan, key: 'pro', price: new Decimal(2999) };

      (mockPrismaService.plan.findUnique as jest.Mock)
        .mockResolvedValueOnce(currentPlan)
        .mockResolvedValueOnce(newPlan);

      mockDowngradeValidation.validateDowngrade.mockResolvedValue({
        canDowngrade: true,
        blockers: [],
        warnings: [],
      });

      mockStripeService.getSubscription.mockResolvedValue(mockStripeSubscription);
      mockStripeService.updateSubscription.mockResolvedValue(mockStripeSubscription);
      (mockPrismaService.subscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        plan: newPlan,
      });

      await service.updateSubscription('org-1', { planId: 'pro' });

      expect(mockDowngradeValidation.validateDowngrade).toHaveBeenCalledWith('org-1', newPlan);
      expect(mockStripeService.updateSubscription).toHaveBeenCalledWith(
        'sub_123',
        expect.objectContaining({
          proration_behavior: 'create_prorations', // downgrade
          payment_behavior: 'allow_incomplete',
        }),
      );
    });

    it('should throw BadRequestException if downgrade validation fails', async () => {
      const currentPlan = { ...mockPlan, key: 'enterprise', price: new Decimal(4999) };
      const newPlan = { ...mockPlan, key: 'pro', price: new Decimal(2999) };

      (mockPrismaService.plan.findUnique as jest.Mock)
        .mockResolvedValueOnce(currentPlan)
        .mockResolvedValueOnce(newPlan);

      mockDowngradeValidation.validateDowngrade.mockResolvedValue({
        canDowngrade: false,
        blockers: [
          {
            type: 'members' as const,
            current: 15,
            newLimit: 10,
            message: 'Too many team members',
          },
        ],
        warnings: [],
      });

      await expect(service.updateSubscription('org-1', { planId: 'pro' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reactivate cancelled subscription when upgrading', async () => {
      const cancelledSubscription = { ...mockSubscription, cancelAtPeriodEnd: true };
      const currentPlan = mockPlan;
      const newPlan = { ...mockPlan, key: 'enterprise', price: new Decimal(4999) };

      (mockPrismaService.subscription.findFirst as jest.Mock).mockResolvedValue(
        cancelledSubscription,
      );
      (mockPrismaService.plan.findUnique as jest.Mock)
        .mockResolvedValueOnce(currentPlan)
        .mockResolvedValueOnce(newPlan);

      mockStripeService.getSubscription.mockResolvedValue(mockStripeSubscription);
      mockStripeService.updateSubscription.mockResolvedValue(mockStripeSubscription);
      (mockPrismaService.subscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        plan: newPlan,
      });

      await service.updateSubscription('org-1', { planId: 'enterprise' });

      expect(mockStripeService.updateSubscription).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: false,
      });
    });
  });

  describe('cancelSubscription', () => {
    beforeEach(() => {
      (mockPrismaService.billingAccount.findUnique as jest.Mock).mockResolvedValue(
        mockBillingAccount,
      );
      (mockPrismaService.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);
    });

    it('should cancel subscription at period end by default', async () => {
      (mockPrismaService.subscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
        cancelAtPeriodEnd: true,
      });

      await service.cancelSubscription('org-1');

      expect(mockStripeService.cancelSubscription).toHaveBeenCalledWith('sub_123', true);
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: 'subscription-1' },
        data: { cancelAtPeriodEnd: true },
        include: { plan: true },
      });
    });

    it('should cancel subscription immediately when specified', async () => {
      (mockPrismaService.subscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
        status: 'canceled' as SubscriptionStatus,
        cancelAtPeriodEnd: false,
      });

      await service.cancelSubscription('org-1', false);

      expect(mockStripeService.cancelSubscription).toHaveBeenCalledWith('sub_123', false);
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: 'subscription-1' },
        data: { cancelAtPeriodEnd: false, status: 'canceled' },
        include: { plan: true },
      });
    });
  });

  describe('reactivateSubscription', () => {
    beforeEach(() => {
      (mockPrismaService.billingAccount.findUnique as jest.Mock).mockResolvedValue(
        mockBillingAccount,
      );
    });

    it('should throw BadRequestException if subscription is not cancelled', async () => {
      (mockPrismaService.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);

      await expect(service.reactivateSubscription('org-1')).rejects.toThrow(
        new BadRequestException('Subscription is not canceled'),
      );
    });

    it('should reactivate cancelled subscription', async () => {
      const cancelledSubscription = { ...mockSubscription, cancelAtPeriodEnd: true };
      (mockPrismaService.subscription.findFirst as jest.Mock).mockResolvedValue(
        cancelledSubscription,
      );
      (mockPrismaService.subscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      });

      await service.reactivateSubscription('org-1');

      expect(mockStripeService.updateSubscription).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: false,
      });
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: 'subscription-1' },
        data: { cancelAtPeriodEnd: false, status: 'active' },
        include: { plan: true },
      });
    });
  });

  describe('handleWebhookEvent', () => {
    it('should handle subscription.updated webhook', async () => {
      const event = {
        id: 'evt_123',
        type: 'customer.subscription.updated',
        data: { object: mockStripeSubscription },
      } as Stripe.Event;

      (mockPrismaService.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);

      await service.handleWebhookEvent(event);

      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: 'subscription-1' },
        data: {
          status: 'active',
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
          cancelAtPeriodEnd: false,
        },
      });
    });

    it('should handle subscription.deleted webhook', async () => {
      const event = {
        id: 'evt_123',
        type: 'customer.subscription.deleted',
        data: { object: mockStripeSubscription },
      } as Stripe.Event;

      (mockPrismaService.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);

      await service.handleWebhookEvent(event);

      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: 'subscription-1' },
        data: { status: 'canceled', cancelAtPeriodEnd: false },
      });
    });

    it('should warn when webhook is for unknown subscription', async () => {
      const event = {
        id: 'evt_123',
        type: 'customer.subscription.updated',
        data: { object: mockStripeSubscription },
      } as Stripe.Event;

      (mockPrismaService.subscription.findFirst as jest.Mock).mockResolvedValue(null);

      await service.handleWebhookEvent(event);

      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'Received webhook for unknown subscription',
        { stripeSubscriptionId: 'sub_123' },
      );
    });
  });

  describe('getBillingAccount', () => {
    it('should return billing account if it exists', async () => {
      (mockPrismaService.billingAccount.findUnique as jest.Mock).mockResolvedValue(
        mockBillingAccount,
      );

      const result = await service.getBillingAccount('org-1');

      expect(result).toEqual(mockBillingAccount);
    });

    it('should throw NotFoundException if billing account does not exist', async () => {
      (mockPrismaService.billingAccount.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getBillingAccount('org-1')).rejects.toThrow(
        new NotFoundException('No billing account found for organization org-1'),
      );
    });
  });
});
