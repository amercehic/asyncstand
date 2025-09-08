import { Test, TestingModule } from '@nestjs/testing';
import { UsageController } from '@/billing/controllers/usage.controller';
import { UsageTrackingService } from '@/billing/services/usage-tracking.service';
import { PlanEnforcementService } from '@/billing/services/plan-enforcement.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { createMockLoggerService } from '@/test/utils/mocks/services.mock';

describe('UsageController', () => {
  let controller: UsageController;
  let mockUsageTrackingService: jest.Mocked<UsageTrackingService>;
  let mockPlanEnforcementService: jest.Mocked<PlanEnforcementService>;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockLoggerService: ReturnType<typeof createMockLoggerService>;

  const mockCurrentUsage = {
    orgId: 'org-1',
    teams: {
      used: 2,
      limit: 5,
      available: 3,
      percentage: 40,
      nearLimit: false,
      overLimit: false,
    },
    members: {
      used: 8,
      limit: 10,
      available: 2,
      percentage: 80,
      nearLimit: true,
      overLimit: false,
    },
    standupConfigs: {
      used: 3,
      limit: null,
      available: null,
      percentage: 0,
      nearLimit: false,
      overLimit: false,
    },
    standupsThisMonth: {
      used: 25,
      limit: 50,
      available: 25,
      percentage: 50,
      nearLimit: false,
      overLimit: false,
    },
    nextResetDate: new Date('2023-12-31'),
    planName: 'Pro',
    isFreePlan: false,
  };

  const mockBillingPeriod = {
    orgId: 'org-1',
    periodStart: new Date('2023-12-01'),
    periodEnd: new Date('2023-12-31'),
    daysUntilReset: 15,
    isInTrial: false,
  };

  const mockUsageWarnings = {
    warnings: [
      {
        type: 'members',
        message: 'You are approaching your member limit',
        severity: 'warning' as const,
      },
    ],
  };

  beforeEach(async () => {
    mockUsageTrackingService = {
      getCurrentUsage: jest.fn(),
      getBillingPeriod: jest.fn(),
      canPerformAction: jest.fn(),
    } as unknown as jest.Mocked<UsageTrackingService>;

    mockPlanEnforcementService = {
      getUsageWarnings: jest.fn(),
      needsUpgrade: jest.fn(),
    } as unknown as jest.Mocked<PlanEnforcementService>;

    mockPrismaService = {} as unknown as jest.Mocked<PrismaService>;
    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsageController],
      providers: [
        { provide: UsageTrackingService, useValue: mockUsageTrackingService },
        { provide: PlanEnforcementService, useValue: mockPlanEnforcementService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    controller = module.get<UsageController>(UsageController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentUsage', () => {
    it('should return current usage statistics', async () => {
      mockUsageTrackingService.getCurrentUsage.mockResolvedValue(mockCurrentUsage);

      const result = await controller.getCurrentUsage('org-1');

      expect(result).toEqual({
        message: 'Usage statistics retrieved successfully',
        usage: mockCurrentUsage,
      });
      expect(mockUsageTrackingService.getCurrentUsage).toHaveBeenCalledWith('org-1');
    });

    it('should propagate service errors', async () => {
      mockUsageTrackingService.getCurrentUsage.mockRejectedValue(new Error('Service error'));

      await expect(controller.getCurrentUsage('org-1')).rejects.toThrow('Service error');
    });
  });

  describe('getBillingPeriod', () => {
    it('should return billing period information', async () => {
      mockUsageTrackingService.getBillingPeriod.mockResolvedValue(mockBillingPeriod);

      const result = await controller.getBillingPeriod('org-1');

      expect(result).toEqual({
        message: 'Billing period retrieved successfully',
        billingPeriod: mockBillingPeriod,
      });
      expect(mockUsageTrackingService.getBillingPeriod).toHaveBeenCalledWith('org-1');
    });

    it('should propagate service errors', async () => {
      mockUsageTrackingService.getBillingPeriod.mockRejectedValue(new Error('Database error'));

      await expect(controller.getBillingPeriod('org-1')).rejects.toThrow('Database error');
    });
  });

  describe('getUsageWarnings', () => {
    it('should return usage warnings', async () => {
      mockPlanEnforcementService.getUsageWarnings.mockResolvedValue(mockUsageWarnings);

      const result = await controller.getUsageWarnings('org-1');

      expect(result).toEqual({
        message: 'Usage warnings retrieved successfully',
        warnings: mockUsageWarnings.warnings,
      });
      expect(mockPlanEnforcementService.getUsageWarnings).toHaveBeenCalledWith('org-1');
    });

    it('should handle empty warnings', async () => {
      const emptyWarnings = {
        warnings: [],
      };
      mockPlanEnforcementService.getUsageWarnings.mockResolvedValue(emptyWarnings);

      const result = await controller.getUsageWarnings('org-1');

      expect(result).toEqual({
        message: 'Usage warnings retrieved successfully',
        warnings: [],
      });
    });
  });

  describe('checkLimits', () => {
    it('should return comprehensive limits check when upgrade not needed', async () => {
      mockUsageTrackingService.getCurrentUsage.mockResolvedValue(mockCurrentUsage);
      mockPlanEnforcementService.getUsageWarnings.mockResolvedValue(mockUsageWarnings);
      mockPlanEnforcementService.needsUpgrade.mockResolvedValue(false);

      const result = await controller.checkLimits('org-1');

      expect(result).toEqual({
        message: 'Limits check completed',
        usage: mockCurrentUsage,
        warnings: mockUsageWarnings.warnings,
        needsUpgrade: false,
        recommendations: ['You are within all plan limits'],
      });

      expect(mockUsageTrackingService.getCurrentUsage).toHaveBeenCalledWith('org-1');
      expect(mockPlanEnforcementService.getUsageWarnings).toHaveBeenCalledWith('org-1');
      expect(mockPlanEnforcementService.needsUpgrade).toHaveBeenCalledWith('org-1');
    });

    it('should return upgrade recommendation when needed', async () => {
      mockUsageTrackingService.getCurrentUsage.mockResolvedValue(mockCurrentUsage);
      mockPlanEnforcementService.getUsageWarnings.mockResolvedValue(mockUsageWarnings);
      mockPlanEnforcementService.needsUpgrade.mockResolvedValue(true);

      const result = await controller.checkLimits('org-1');

      expect(result).toEqual({
        message: 'Limits check completed',
        usage: mockCurrentUsage,
        warnings: mockUsageWarnings.warnings,
        needsUpgrade: true,
        recommendations: ['Consider upgrading to Pro plan for unlimited access'],
      });
    });

    it('should handle service errors during limits check', async () => {
      mockUsageTrackingService.getCurrentUsage.mockResolvedValue(mockCurrentUsage);
      mockPlanEnforcementService.getUsageWarnings.mockRejectedValue(
        new Error('Warning service error'),
      );
      mockPlanEnforcementService.needsUpgrade.mockResolvedValue(false);

      await expect(controller.checkLimits('org-1')).rejects.toThrow('Warning service error');
    });
  });

  describe('canPerformAction', () => {
    it('should return allowed when action is permitted', async () => {
      const actionResult = {
        allowed: true,
        upgradeRequired: false,
      };
      mockUsageTrackingService.canPerformAction.mockResolvedValue(actionResult);

      const result = await controller.canPerformAction('org-1', 'create_team');

      expect(result).toEqual({
        message: 'Action permission checked',
        action: 'create_team',
        allowed: true,
        upgradeRequired: false,
      });
      expect(mockUsageTrackingService.canPerformAction).toHaveBeenCalledWith(
        'org-1',
        'create_team',
      );
    });

    it('should return denied when action exceeds limits', async () => {
      const actionResult = {
        allowed: false,
        reason: 'Team limit exceeded',
        upgradeRequired: true,
      };
      mockUsageTrackingService.canPerformAction.mockResolvedValue(actionResult);

      const result = await controller.canPerformAction('org-1', 'create_team');

      expect(result).toEqual({
        message: 'Action permission checked',
        action: 'create_team',
        allowed: false,
        reason: 'Team limit exceeded',
        upgradeRequired: true,
      });
    });

    it('should handle all valid action types', async () => {
      const validActions = [
        'create_team',
        'invite_member',
        'create_standup_config',
        'create_standup',
      ];

      const actionResult = { allowed: true, upgradeRequired: false };
      mockUsageTrackingService.canPerformAction.mockResolvedValue(actionResult);

      for (const action of validActions) {
        const result = await controller.canPerformAction('org-1', action);

        expect((result as { message: string; action: string }).message).toBe(
          'Action permission checked',
        );
        expect((result as { message: string; action: string }).action).toBe(action);
        expect(result.allowed).toBe(true);
        expect(mockUsageTrackingService.canPerformAction).toHaveBeenCalledWith('org-1', action);
      }

      expect(mockUsageTrackingService.canPerformAction).toHaveBeenCalledTimes(validActions.length);
    });

    it('should reject invalid action types', async () => {
      const result = await controller.canPerformAction('org-1', 'invalid_action');

      expect(result).toEqual({
        allowed: false,
        reason:
          'Invalid action: invalid_action. Valid actions: create_team, invite_member, create_standup_config, create_standup',
        upgradeRequired: false,
      });
      expect(mockUsageTrackingService.canPerformAction).not.toHaveBeenCalled();
    });

    it('should handle empty action string', async () => {
      const result = await controller.canPerformAction('org-1', '');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid action');
      expect(mockUsageTrackingService.canPerformAction).not.toHaveBeenCalled();
    });

    it('should handle special characters in action', async () => {
      const result = await controller.canPerformAction('org-1', 'create-team');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid action: create-team');
      expect(mockUsageTrackingService.canPerformAction).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should propagate service errors from getCurrentUsage', async () => {
      mockUsageTrackingService.getCurrentUsage.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(controller.getCurrentUsage('org-1')).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should propagate service errors from getBillingPeriod', async () => {
      mockUsageTrackingService.getBillingPeriod.mockRejectedValue(
        new Error('Billing service unavailable'),
      );

      await expect(controller.getBillingPeriod('org-1')).rejects.toThrow(
        'Billing service unavailable',
      );
    });

    it('should propagate service errors from getUsageWarnings', async () => {
      mockPlanEnforcementService.getUsageWarnings.mockRejectedValue(
        new Error('Plan enforcement error'),
      );

      await expect(controller.getUsageWarnings('org-1')).rejects.toThrow('Plan enforcement error');
    });
  });

  describe('concurrent requests handling', () => {
    it('should handle multiple concurrent getCurrentUsage requests', async () => {
      mockUsageTrackingService.getCurrentUsage.mockResolvedValue(mockCurrentUsage);

      const requests = Array(5)
        .fill(null)
        .map(() => controller.getCurrentUsage('org-1'));
      const results = await Promise.all(requests);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.message).toBe('Usage statistics retrieved successfully');
        expect(result.usage).toEqual(mockCurrentUsage);
      });
      expect(mockUsageTrackingService.getCurrentUsage).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed action permission checks concurrently', async () => {
      mockUsageTrackingService.canPerformAction.mockResolvedValue({
        allowed: true,
        upgradeRequired: false,
      });

      const actions = ['create_team', 'invite_member', 'create_standup'];
      const requests = actions.map((action) => controller.canPerformAction('org-1', action));
      const results = await Promise.all(requests);

      expect(results).toHaveLength(3);
      results.forEach((result, index: number) => {
        expect((result as { message: string; action: string }).message).toBe(
          'Action permission checked',
        );
        expect((result as { message: string; action: string }).action).toBe(actions[index]);
        expect(result.allowed).toBe(true);
      });
    });
  });
});
