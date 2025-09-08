import { Test, TestingModule } from '@nestjs/testing';
import {
  DowngradeValidationService,
  ValidationError,
} from '@/billing/services/downgrade-validation.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { createMockLoggerService } from '@/test/utils/mocks/services.mock';
import { Plan } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('DowngradeValidationService', () => {
  let service: DowngradeValidationService;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockLoggerService: ReturnType<typeof createMockLoggerService>;

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
    teamLimit: 1,
    standupConfigLimit: 2,
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

  const mockBasicPlan: Plan = {
    id: 'plan-basic',
    key: 'basic',
    name: 'Basic',
    displayName: 'Basic Plan',
    description: 'Basic plan',
    price: new Decimal(999),
    interval: 'month',
    stripePriceId: 'price_basic',
    isActive: true,
    sortOrder: 0.5,
    memberLimit: 10,
    teamLimit: 3,
    standupConfigLimit: 5,
    standupLimit: 100,
    storageLimit: null,
    integrationLimit: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const createMockPrismaMethod = () => jest.fn();

    mockPrismaService = {
      team: {
        count: createMockPrismaMethod(),
      },
      orgMember: {
        count: createMockPrismaMethod(),
      },
      standupConfig: {
        count: createMockPrismaMethod(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DowngradeValidationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<DowngradeValidationService>(DowngradeValidationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateDowngrade', () => {
    it('should allow downgrade when all limits are satisfied', async () => {
      // Mock current usage that is within the target plan limits
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(1); // within basic plan limit of 3
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(8); // within basic plan limit of 10
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(3); // within basic plan limit of 5

      const result = await service.validateDowngrade('org-1', mockBasicPlan);

      expect(result).toEqual({
        canDowngrade: true,
        warnings: [],
        blockers: [],
      });

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Validating downgrade', {
        orgId: 'org-1',
        targetPlan: 'basic',
      });
    });

    it('should allow downgrade when target plan has unlimited resources', async () => {
      // Mock high current usage
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(10);
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(50);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(20);

      const result = await service.validateDowngrade('org-1', mockProPlan);

      expect(result).toEqual({
        canDowngrade: true,
        warnings: [],
        blockers: [],
      });
    });

    it('should block downgrade when team count exceeds limit', async () => {
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(5); // exceeds free plan limit of 1
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(3);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(1);

      const result = await service.validateDowngrade('org-1', mockFreePlan);

      expect(result.canDowngrade).toBe(false);
      expect(result.blockers).toHaveLength(1);
      expect(result.blockers[0]).toEqual({
        type: 'teams',
        current: 5,
        newLimit: 1,
        message:
          'You have 5 teams but the Free allows only 1. Please delete 4 team(s) before downgrading.',
      } satisfies ValidationError);
    });

    it('should block downgrade when member count exceeds limit', async () => {
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(1);
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(15); // exceeds basic plan limit of 10
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(2);

      const result = await service.validateDowngrade('org-1', mockBasicPlan);

      expect(result.canDowngrade).toBe(false);
      expect(result.blockers).toHaveLength(1);
      expect(result.blockers[0]).toEqual({
        type: 'members',
        current: 15,
        newLimit: 10,
        message:
          'You have 15 team members but the Basic allows only 10. Please remove 5 member(s) before downgrading.',
      } satisfies ValidationError);
    });

    it('should block downgrade when standup config count exceeds limit', async () => {
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(1);
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(3);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(8); // exceeds basic plan limit of 5

      const result = await service.validateDowngrade('org-1', mockBasicPlan);

      expect(result.canDowngrade).toBe(false);
      expect(result.blockers).toHaveLength(1);
      expect(result.blockers[0]).toEqual({
        type: 'standupConfigs',
        current: 8,
        newLimit: 5,
        message:
          'You have 8 standup configurations but the Basic allows only 5. Please delete 3 configuration(s) before downgrading.',
      } satisfies ValidationError);
    });

    it('should block downgrade with multiple violations', async () => {
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(2); // exceeds free plan limit of 1
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(8); // exceeds free plan limit of 5
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(5); // exceeds free plan limit of 2

      const result = await service.validateDowngrade('org-1', mockFreePlan);

      expect(result.canDowngrade).toBe(false);
      expect(result.blockers).toHaveLength(3);

      // Check team blocker
      expect(result.blockers[0]).toMatchObject({
        type: 'teams',
        current: 2,
        newLimit: 1,
      });

      // Check member blocker
      expect(result.blockers[1]).toMatchObject({
        type: 'members',
        current: 8,
        newLimit: 5,
      });

      // Check standup config blocker
      expect(result.blockers[2]).toMatchObject({
        type: 'standupConfigs',
        current: 5,
        newLimit: 2,
      });
    });

    it('should handle edge case where limits are exactly met', async () => {
      // Set usage exactly at the limits
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(3); // exactly at basic plan limit of 3
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(10); // exactly at basic plan limit of 10
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(5); // exactly at basic plan limit of 5

      const result = await service.validateDowngrade('org-1', mockBasicPlan);

      expect(result.canDowngrade).toBe(true);
      expect(result.blockers).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle plan with zero limits', async () => {
      const restrictivePlan: Plan = {
        ...mockFreePlan,
        teamLimit: 0,
        memberLimit: 0,
        standupConfigLimit: 0,
      };

      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(0);
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(0);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(0);

      const result = await service.validateDowngrade('org-1', restrictivePlan);

      // With zero limits and zero usage, downgrade should be allowed
      expect(result.canDowngrade).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });

    it('should log validation result', async () => {
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(1);
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(3);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(1);

      await service.validateDowngrade('org-1', mockBasicPlan);

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Downgrade validation result', {
        orgId: 'org-1',
        targetPlan: 'basic',
        canDowngrade: true,
        blockersCount: 0,
        warningsCount: 0,
      });
    });

    it('should handle Prisma query errors', async () => {
      (mockPrismaService.team.count as jest.Mock).mockRejectedValue(new Error('Database error'));
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(3);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(1);

      await expect(service.validateDowngrade('org-1', mockBasicPlan)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('private methods behavior', () => {
    // Since private methods can't be tested directly, we test their behavior through the public interface

    it('should call correct Prisma queries for counting resources', async () => {
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(2);
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(5);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(3);

      await service.validateDowngrade('org-1', mockBasicPlan);

      expect(mockPrismaService.team.count).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
      });

      expect(mockPrismaService.orgMember.count).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
      });

      expect(mockPrismaService.standupConfig.count).toHaveBeenCalledWith({
        where: {
          team: {
            orgId: 'org-1',
          },
        },
      });
    });

    it('should execute all count queries in parallel', async () => {
      let teamCountResolved = false;
      let memberCountResolved = false;
      let standupConfigResolved = false;

      (mockPrismaService.team.count as jest.Mock).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        teamCountResolved = true;
        return 1;
      });

      (mockPrismaService.orgMember.count as jest.Mock).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        memberCountResolved = true;
        return 3;
      });

      (mockPrismaService.standupConfig.count as jest.Mock).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        standupConfigResolved = true;
        return 2;
      });

      const startTime = Date.now();
      await service.validateDowngrade('org-1', mockBasicPlan);
      const endTime = Date.now();

      // If executed sequentially, it would take ~30ms, but in parallel should be ~10ms
      expect(endTime - startTime).toBeLessThan(25);
      expect(teamCountResolved).toBe(true);
      expect(memberCountResolved).toBe(true);
      expect(standupConfigResolved).toBe(true);
    });
  });

  describe('interface contracts', () => {
    it('should return ValidationError objects with correct structure', async () => {
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(5);
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(10);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(8);

      const result = await service.validateDowngrade('org-1', mockFreePlan);

      result.blockers.forEach((blocker) => {
        expect(blocker).toHaveProperty('type');
        expect(blocker).toHaveProperty('current');
        expect(blocker).toHaveProperty('newLimit');
        expect(blocker).toHaveProperty('message');

        expect(typeof blocker.type).toBe('string');
        expect(typeof blocker.current).toBe('number');
        expect(typeof blocker.newLimit).toBe('number');
        expect(typeof blocker.message).toBe('string');

        expect(['teams', 'members', 'standupConfigs', 'standupsPerMonth']).toContain(blocker.type);
      });
    });

    it('should return DowngradeValidationResult with correct structure', async () => {
      (mockPrismaService.team.count as jest.Mock).mockResolvedValue(1);
      (mockPrismaService.orgMember.count as jest.Mock).mockResolvedValue(3);
      (mockPrismaService.standupConfig.count as jest.Mock).mockResolvedValue(1);

      const result = await service.validateDowngrade('org-1', mockBasicPlan);

      expect(result).toHaveProperty('canDowngrade');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('blockers');

      expect(typeof result.canDowngrade).toBe('boolean');
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.blockers)).toBe(true);
    });
  });
});
