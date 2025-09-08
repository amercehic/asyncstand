import { Test, TestingModule } from '@nestjs/testing';
import { UsageTrackingService } from '@/billing/services/usage-tracking.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { createMockLoggerService } from '@/test/utils/mocks/services.mock';
import { Plan, BillingAccount, Subscription } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('UsageTrackingService', () => {
  let service: UsageTrackingService;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockLoggerService: ReturnType<typeof createMockLoggerService>;

  const mockOrganization = {
    id: 'org-1',
    name: 'Test Organization',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date(),
  };

  const mockFreePlan: Plan = {
    id: 'plan-free',
    key: 'free',
    name: 'Free',
    displayName: 'Free Plan',
    description: 'Free plan',
    price: new Decimal(0),
    interval: 'month',
    stripePriceId: null,
    isActive: true,
    sortOrder: 0,
    memberLimit: 5,
    teamLimit: 2,
    standupConfigLimit: 5,
    standupLimit: 50,
    storageLimit: null,
    integrationLimit: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProPlan: Plan = {
    id: 'plan-pro',
    key: 'pro',
    name: 'Pro',
    displayName: 'Pro Plan',
    description: 'Professional plan',
    price: new Decimal(2999),
    interval: 'month',
    stripePriceId: 'price_123',
    isActive: true,
    sortOrder: 1,
    memberLimit: null, // unlimited
    teamLimit: null, // unlimited
    standupConfigLimit: null, // unlimited
    standupLimit: null, // unlimited
    storageLimit: null,
    integrationLimit: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBillingAccount: BillingAccount = {
    id: 'billing-1',
    orgId: 'org-1',
    stripeCustomerId: 'cus_123',
    billingEmail: 'billing@example.com',
    defaultPaymentMethod: null,
    taxId: null,
    country: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSubscription: Subscription = {
    id: 'sub-1',
    billingAccountId: 'billing-1',
    planId: 'plan-pro',
    stripeSubscriptionId: 'stripe_sub_123',
    status: 'active',
    currentPeriodStart: new Date('2023-12-01'),
    currentPeriodEnd: new Date('2023-12-31'),
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const createMockPrismaMethod = () => jest.fn();

    mockPrismaService = {
      organization: {
        findUnique: createMockPrismaMethod(),
      },
      plan: {
        findFirst: createMockPrismaMethod(),
      },
      team: {
        count: createMockPrismaMethod(),
      },
      orgMember: {
        count: createMockPrismaMethod(),
      },
      standupConfig: {
        count: createMockPrismaMethod(),
      },
      standupInstance: {
        count: createMockPrismaMethod(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageTrackingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<UsageTrackingService>(UsageTrackingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentUsage', () => {
    it('should throw error if organization not found', async () => {
      (mockPrismaService.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getCurrentUsage('org-1')).rejects.toThrow(
        'Organization org-1 not found',
      );
    });

    it('should calculate usage for organization with subscription', async () => {
      const orgWithSubscription = {
        ...mockOrganization,
        billingAccount: {
          ...mockBillingAccount,
          subscription: {
            ...mockSubscription,
            plan: mockProPlan,
          },
        },
      };

      (mockPrismaService.organization.findUnique as jest.Mock).mockResolvedValue(
        orgWithSubscription,
      );
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(3);
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(8);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(2);
      (mockPrismaService.standupInstance.count as jest.Mock).mockResolvedValue(25);

      const result = await service.getCurrentUsage('org-1');

      expect(result).toEqual({
        orgId: 'org-1',
        teams: {
          used: 3,
          limit: null,
          available: null,
          percentage: 0,
          nearLimit: false,
          overLimit: false,
        },
        members: {
          used: 8,
          limit: null,
          available: null,
          percentage: 0,
          nearLimit: false,
          overLimit: false,
        },
        standupConfigs: {
          used: 2,
          limit: null,
          available: null,
          percentage: 0,
          nearLimit: false,
          overLimit: false,
        },
        standupsThisMonth: {
          used: 25,
          limit: null,
          available: null,
          percentage: 0,
          nearLimit: false,
          overLimit: false,
        },
        nextResetDate: new Date('2023-12-31'),
        planName: 'Pro',
        isFreePlan: false,
      });

      expect(mockPrismaService.standupInstance.count).toHaveBeenCalledWith({
        where: {
          team: { orgId: 'org-1' },
          createdAt: {
            gte: new Date('2023-12-01'),
            lt: new Date('2023-12-31'),
          },
        },
      });
    });

    it('should calculate usage for free plan organization without subscription', async () => {
      const orgWithoutSubscription = {
        ...mockOrganization,
        billingAccount: null,
      };

      (mockPrismaService.organization.findUnique as jest.Mock).mockResolvedValue(
        orgWithoutSubscription,
      );
      (mockPrismaService.plan.findFirst as jest.Mock).mockResolvedValue(mockFreePlan);
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(1);
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(3);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(2);
      (mockPrismaService.standupInstance.count as jest.Mock).mockResolvedValue(10);

      const result = await service.getCurrentUsage('org-1');

      expect(result).toEqual({
        orgId: 'org-1',
        teams: {
          used: 1,
          limit: 2,
          available: 1,
          percentage: 50,
          nearLimit: false,
          overLimit: false,
        },
        members: {
          used: 3,
          limit: 5,
          available: 2,
          percentage: 60,
          nearLimit: false,
          overLimit: false,
        },
        standupConfigs: {
          used: 2,
          limit: 5,
          available: 3,
          percentage: 40,
          nearLimit: false,
          overLimit: false,
        },
        standupsThisMonth: {
          used: 10,
          limit: 50,
          available: 40,
          percentage: 20,
          nearLimit: false,
          overLimit: false,
        },
        nextResetDate: expect.any(Date),
        planName: 'Free',
        isFreePlan: true,
      });

      expect(mockPrismaService.plan.findFirst).toHaveBeenCalledWith({
        where: { key: 'free' },
      });
    });

    it('should use default free plan limits if no free plan found in database', async () => {
      const orgWithoutSubscription = {
        ...mockOrganization,
        billingAccount: null,
      };

      (mockPrismaService.organization.findUnique as jest.Mock).mockResolvedValue(
        orgWithoutSubscription,
      );
      (mockPrismaService.plan.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(3); // over limit
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(6); // over limit
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(6); // over limit
      (mockPrismaService.standupInstance.count as jest.Mock).mockResolvedValue(60); // over limit

      const result = await service.getCurrentUsage('org-1');

      expect(result.teams.overLimit).toBe(true);
      expect(result.members.overLimit).toBe(true);
      expect(result.standupConfigs.overLimit).toBe(true);
      expect(result.standupsThisMonth.overLimit).toBe(true);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'No free plan found in database, using default limits',
      );
    });

    it('should mark usage as near limit when at 80%', async () => {
      const orgWithoutSubscription = {
        ...mockOrganization,
        billingAccount: null,
      };

      (mockPrismaService.organization.findUnique as jest.Mock).mockResolvedValue(
        orgWithoutSubscription,
      );
      (mockPrismaService.plan.findFirst as jest.Mock).mockResolvedValue(mockFreePlan);
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(2); // 2/2 = 100%
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(4); // 4/5 = 80%
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(4); // 4/5 = 80%
      (mockPrismaService.standupInstance.count as jest.Mock).mockResolvedValue(40); // 40/50 = 80%

      const result = await service.getCurrentUsage('org-1');

      expect(result.teams.nearLimit).toBe(true);
      expect(result.teams.overLimit).toBe(true);
      expect(result.members.nearLimit).toBe(true);
      expect(result.standupConfigs.nearLimit).toBe(true);
      expect(result.standupsThisMonth.nearLimit).toBe(true);
    });
  });

  describe('getBillingPeriod', () => {
    it('should throw error if organization not found', async () => {
      (mockPrismaService.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getBillingPeriod('org-1')).rejects.toThrow(
        'Organization org-1 not found',
      );
    });

    it('should use subscription billing period when subscription exists', async () => {
      const orgWithSubscription = {
        ...mockOrganization,
        billingAccount: {
          ...mockBillingAccount,
          subscription: mockSubscription,
        },
      };

      (mockPrismaService.organization.findUnique as jest.Mock).mockResolvedValue(
        orgWithSubscription,
      );

      const result = await service.getBillingPeriod('org-1');

      expect(result).toEqual({
        orgId: 'org-1',
        periodStart: new Date('2023-12-01'),
        periodEnd: new Date('2023-12-31'),
        daysUntilReset: expect.any(Number),
        isInTrial: false,
      });
    });

    it('should use registration-based monthly period when no subscription', async () => {
      const orgWithoutSubscription = {
        ...mockOrganization,
        createdAt: new Date('2023-01-15'), // created on 15th
        billingAccount: null,
      };

      (mockPrismaService.organization.findUnique as jest.Mock).mockResolvedValue(
        orgWithoutSubscription,
      );

      // Mock current date to be in February
      const mockCurrentDate = new Date('2023-02-20');
      jest.useFakeTimers();
      jest.setSystemTime(mockCurrentDate);

      const result = await service.getBillingPeriod('org-1');

      expect(result.orgId).toBe('org-1');
      expect(result.isInTrial).toBe(true);
      expect(result.periodStart.getDate()).toBe(15); // Should start on the 15th
      expect(result.periodEnd.getDate()).toBe(15); // Should end on the 15th of next month

      jest.useRealTimers();
      jest.restoreAllMocks();
    });
  });

  describe('canPerformAction', () => {
    beforeEach(() => {
      const orgWithoutSubscription = {
        ...mockOrganization,
        billingAccount: null,
      };

      (mockPrismaService.organization.findUnique as jest.Mock).mockResolvedValue(
        orgWithoutSubscription,
      );
      (mockPrismaService.plan.findFirst as jest.Mock).mockResolvedValue(mockFreePlan);
    });

    it('should allow create_team when under limit', async () => {
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(1);
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(3);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(2);
      (mockPrismaService.standupInstance.count as jest.Mock).mockResolvedValue(10);

      const result = await service.canPerformAction('org-1', 'create_team');

      expect(result).toEqual({
        allowed: true,
        upgradeRequired: false,
      });
    });

    it('should deny create_team when over limit', async () => {
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(2); // at limit
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(3);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(2);
      (mockPrismaService.standupInstance.count as jest.Mock).mockResolvedValue(10);

      const result = await service.canPerformAction('org-1', 'create_team');

      expect(result).toEqual({
        allowed: false,
        reason: 'Free plan includes 1 team. Upgrade to create more teams.',
        upgradeRequired: true,
      });
    });

    it('should deny invite_member when over limit', async () => {
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(1);
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(5); // at limit
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(2);
      (mockPrismaService.standupInstance.count as jest.Mock).mockResolvedValue(10);

      const result = await service.canPerformAction('org-1', 'invite_member');

      expect(result).toEqual({
        allowed: false,
        reason: 'Free plan includes 5 members. Upgrade for unlimited members.',
        upgradeRequired: true,
      });
    });

    it('should deny create_standup_config when over limit', async () => {
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(1);
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(3);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(5); // at limit
      (mockPrismaService.standupInstance.count as jest.Mock).mockResolvedValue(10);

      const result = await service.canPerformAction('org-1', 'create_standup_config');

      expect(result).toEqual({
        allowed: false,
        reason: 'Free plan includes 1 standup configuration. Upgrade for unlimited configs.',
        upgradeRequired: true,
      });
    });

    it('should deny create_standup when over monthly limit', async () => {
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(1);
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(3);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(2);
      (mockPrismaService.standupInstance.count as jest.Mock).mockResolvedValue(50); // at limit

      const result = await service.canPerformAction('org-1', 'create_standup');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('monthly standup limit');
      expect(result.upgradeRequired).toBe(true);
    });

    it('should allow unknown action types', async () => {
      const result = await service.canPerformAction(
        'org-1',
        'unknown_action' as Parameters<typeof service.canPerformAction>[1],
      );

      expect(result).toEqual({
        allowed: true,
        upgradeRequired: false,
      });
    });
  });

  describe('recordUsage', () => {
    it('should log usage event', async () => {
      const metadata = { teamId: 'team-1' };

      await service.recordUsage('org-1', 'team_created', metadata);

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Recording usage event', {
        orgId: 'org-1',
        eventType: 'team_created',
        metadata,
      });
    });

    it('should handle usage event without metadata', async () => {
      await service.recordUsage('org-1', 'member_added');

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Recording usage event', {
        orgId: 'org-1',
        eventType: 'member_added',
        metadata: undefined,
      });
    });
  });

  describe('private helper methods', () => {
    // Test the behavior through public methods since private methods aren't directly accessible

    describe('buildUsageLimit', () => {
      it('should correctly calculate usage percentages and limits through getCurrentUsage', async () => {
        const orgWithoutSubscription = {
          ...mockOrganization,
          billingAccount: null,
        };

        (mockPrismaService.organization.findUnique as jest.Mock).mockResolvedValue(
          orgWithoutSubscription,
        );
        (mockPrismaService.plan.findFirst as jest.Mock).mockResolvedValue(mockFreePlan);
        (mockPrismaService.team.count as jest.Mock).mockResolvedValue(1); // 1/2 = 50%
        (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(4); // 4/5 = 80%
        (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(5); // 5/5 = 100%
        (mockPrismaService.standupInstance.count as jest.Mock).mockResolvedValue(60); // 60/50 = 120% (over limit)

        const result = await service.getCurrentUsage('org-1');

        // 50% usage
        expect(result.teams.percentage).toBe(50);
        expect(result.teams.available).toBe(1);
        expect(result.teams.nearLimit).toBe(false);
        expect(result.teams.overLimit).toBe(false);

        // 80% usage (near limit)
        expect(result.members.percentage).toBe(80);
        expect(result.members.available).toBe(1);
        expect(result.members.nearLimit).toBe(true);
        expect(result.members.overLimit).toBe(false);

        // 100% usage (at limit)
        expect(result.standupConfigs.percentage).toBe(100);
        expect(result.standupConfigs.available).toBe(0);
        expect(result.standupConfigs.nearLimit).toBe(true);
        expect(result.standupConfigs.overLimit).toBe(true);

        // Over limit
        expect(result.standupsThisMonth.percentage).toBe(100); // Capped at 100%
        expect(result.standupsThisMonth.available).toBe(0);
        expect(result.standupsThisMonth.nearLimit).toBe(true);
        expect(result.standupsThisMonth.overLimit).toBe(true);
      });
    });

    describe('getMonthlyPeriodStart', () => {
      it('should handle period calculation correctly for organizations without subscription', async () => {
        const orgWithoutSubscription = {
          ...mockOrganization,
          createdAt: new Date('2023-01-15'), // created on 15th
          billingAccount: null,
        };

        (mockPrismaService.organization.findUnique as jest.Mock).mockResolvedValue(
          orgWithoutSubscription,
        );
        (mockPrismaService.plan.findFirst as jest.Mock).mockResolvedValue(mockFreePlan);
        (mockPrismaService.team.count as jest.Mock).mockResolvedValue(0);
        (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(0);
        (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(0);
        (mockPrismaService.standupInstance.count as jest.Mock).mockResolvedValue(0);

        // The getCurrentUsage method calls getBillingPeriod internally,
        // which tests the monthly period calculation
        const result = await service.getCurrentUsage('org-1');

        expect(result.nextResetDate).toBeInstanceOf(Date);
        expect(result.nextResetDate.getDate()).toBe(15); // Should reset on the 15th
      });
    });
  });
});
