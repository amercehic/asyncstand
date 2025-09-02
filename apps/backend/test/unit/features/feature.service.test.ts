import { Test, TestingModule } from '@nestjs/testing';
import { FeatureService } from '@/features/feature.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { FeatureOverride } from '@prisma/client';
import { createMockPrismaService } from '@/test/utils/mocks/prisma.mock';
import { createMockLoggerService } from '@/test/utils/mocks/services.mock';
import { TestHelpers } from '@/test/utils/test-helpers';

describe('FeatureService', () => {
  let service: FeatureService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockLogger: ReturnType<typeof createMockLoggerService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockLogger = createMockLoggerService();

    // Mock NODE_ENV
    process.env.NODE_ENV = 'development';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<FeatureService>(FeatureService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isFeatureEnabled', () => {
    const featureKey = 'test-feature';
    const orgId = TestHelpers.generateRandomString();
    const userId = TestHelpers.generateRandomString();

    it('should return false when feature not found', async () => {
      mockPrisma.feature.findUnique.mockResolvedValue(null);

      const result = await service.isFeatureEnabled(featureKey, orgId, userId);

      expect(result).toEqual({
        enabled: false,
        source: 'global',
        reason: 'Feature not found',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(`Feature ${featureKey} not found`);
    });

    it('should return false when feature globally disabled', async () => {
      const mockFeature = {
        id: 'feature-id',
        key: featureKey,
        name: 'Test Feature',
        description: 'A test feature',
        isEnabled: false,
        environment: [],
        category: 'test',
        isPlanBased: false,
        requiresAdmin: false,
        rolloutType: null,
        rolloutValue: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.feature.findUnique.mockResolvedValue(mockFeature);

      const result = await service.isFeatureEnabled(featureKey, orgId, userId);

      expect(result).toEqual({
        enabled: false,
        source: 'global',
        reason: 'Feature globally disabled',
      });
    });

    it('should return false when not available in current environment', async () => {
      const mockFeature = {
        id: 'feature-id',
        key: featureKey,
        name: 'Test Feature',
        description: 'A test feature',
        isEnabled: true,
        environment: ['production'],
        category: 'test',
        isPlanBased: false,
        requiresAdmin: false,
        rolloutType: null,
        rolloutValue: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.feature.findUnique.mockResolvedValue(mockFeature);

      const result = await service.isFeatureEnabled(featureKey, orgId, userId);

      expect(result).toEqual({
        enabled: false,
        source: 'environment',
        reason: 'Not available in development environment',
      });
    });

    it('should return override value when organization override exists', async () => {
      const mockFeature = {
        id: 'feature-id',
        key: featureKey,
        name: 'Test Feature',
        description: 'A test feature',
        isEnabled: true,
        environment: ['development'],
        category: 'test',
        isPlanBased: false,
        requiresAdmin: false,
        rolloutType: null,
        rolloutValue: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockOverride = {
        id: 'override-id',
        orgId,
        featureKey,
        enabled: true,
        value: 'override-value',
        reason: 'Special override',
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.feature.findUnique.mockResolvedValue(mockFeature);
      mockPrisma.featureOverride.findUnique.mockResolvedValue(mockOverride);

      const result = await service.isFeatureEnabled(featureKey, orgId, userId);

      expect(result).toEqual({
        enabled: true,
        source: 'override',
        value: 'override-value',
        reason: 'Special override',
      });
    });

    it('should delete expired override and continue evaluation', async () => {
      const mockFeature = {
        id: 'feature-id',
        key: featureKey,
        name: 'Test Feature',
        description: 'A test feature',
        isEnabled: true,
        environment: ['development'],
        category: 'test',
        isPlanBased: false,
        requiresAdmin: false,
        rolloutType: null,
        rolloutValue: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const expiredOverride: FeatureOverride = {
        id: 'override-id',
        orgId,
        featureKey,
        enabled: true,
        value: null,
        reason: null,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.feature.findUnique.mockResolvedValue(mockFeature);
      mockPrisma.featureOverride.findUnique.mockResolvedValue(expiredOverride);

      const result = await service.isFeatureEnabled(featureKey, orgId, userId);

      expect(mockPrisma.featureOverride.delete).toHaveBeenCalledWith({
        where: { id: expiredOverride.id },
      });
      expect(result).toEqual({
        enabled: true,
        source: 'global',
      });
    });

    it('should return plan feature value when feature is plan-based', async () => {
      const mockFeature = {
        id: 'feature-id',
        key: featureKey,
        name: 'Test Feature',
        description: 'A test feature',
        isEnabled: true,
        environment: ['development'],
        category: 'test',
        isPlanBased: true,
        requiresAdmin: false,
        rolloutType: null,
        rolloutValue: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPlanFeature = {
        id: 'plan-feature-id',
        planId: 'plan-id',
        featureKey,
        enabled: true,
        value: 'plan-value',
      };

      const mockBillingAccount = {
        orgId,
        subscription: {
          planId: 'plan-id',
          plan: { id: 'plan-id' },
        },
      };

      mockPrisma.feature.findUnique.mockResolvedValue(mockFeature);
      mockPrisma.featureOverride.findUnique.mockResolvedValue(null);
      mockPrisma.billingAccount.findUnique.mockResolvedValue(mockBillingAccount);
      mockPrisma.planFeature.findUnique.mockResolvedValue(mockPlanFeature);

      const result = await service.isFeatureEnabled(featureKey, orgId, userId);

      expect(result).toEqual({
        enabled: true,
        source: 'plan',
        value: 'plan-value',
      });
    });

    it('should check percentage rollout correctly', async () => {
      const mockFeature = {
        id: 'feature-id',
        key: featureKey,
        name: 'Test Feature',
        description: 'A test feature',
        isEnabled: true,
        environment: ['development'],
        category: 'test',
        isPlanBased: false,
        requiresAdmin: false,
        rolloutType: 'percentage',
        rolloutValue: { percentage: 50 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.feature.findUnique.mockResolvedValue(mockFeature);
      mockPrisma.featureOverride.findUnique.mockResolvedValue(null);

      // Mock hash function to return predictable value
      jest
        .spyOn(service as typeof service & { hashString: (str: string) => number }, 'hashString')
        .mockReturnValue(25 as never); // 25% < 50%, should be enabled

      const result = await service.isFeatureEnabled(featureKey, orgId, userId);

      expect(result).toEqual({
        enabled: true,
        source: 'rollout',
      });
    });

    it('should check org list rollout correctly', async () => {
      const mockFeature = {
        id: 'feature-id',
        key: featureKey,
        name: 'Test Feature',
        description: 'A test feature',
        isEnabled: true,
        environment: ['development'],
        category: 'test',
        isPlanBased: false,
        requiresAdmin: false,
        rolloutType: 'org_list',
        rolloutValue: { orgIds: [orgId, 'other-org-id'] },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.feature.findUnique.mockResolvedValue(mockFeature);
      mockPrisma.featureOverride.findUnique.mockResolvedValue(null);

      const result = await service.isFeatureEnabled(featureKey, orgId, userId);

      expect(result).toEqual({
        enabled: true,
        source: 'rollout',
      });
    });

    it('should return true by default when all checks pass', async () => {
      const mockFeature = {
        id: 'feature-id',
        key: featureKey,
        name: 'Test Feature',
        description: 'A test feature',
        isEnabled: true,
        environment: ['development'],
        category: 'test',
        isPlanBased: false,
        requiresAdmin: false,
        rolloutType: null,
        rolloutValue: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.feature.findUnique.mockResolvedValue(mockFeature);
      mockPrisma.featureOverride.findUnique.mockResolvedValue(null);

      const result = await service.isFeatureEnabled(featureKey, orgId, userId);

      expect(result).toEqual({
        enabled: true,
        source: 'global',
      });
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.feature.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await service.isFeatureEnabled(featureKey, orgId, userId);

      expect(result).toEqual({
        enabled: false,
        source: 'global',
        reason: 'Error checking feature',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error checking feature ${featureKey}:`,
        expect.any(Error),
      );
    });
  });

  describe('getEnabledFeatures', () => {
    it('should return list of enabled features', async () => {
      const orgId = TestHelpers.generateRandomString();
      const mockFeatures = [
        {
          id: 'feature-1',
          key: 'feature-1',
          name: 'Feature 1',
          description: null,
          isEnabled: true,
          environment: [],
          category: 'test',
          isPlanBased: false,
          requiresAdmin: false,
          rolloutType: null,
          rolloutValue: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'feature-2',
          key: 'feature-2',
          name: 'Feature 2',
          description: null,
          isEnabled: true,
          environment: [],
          category: 'test',
          isPlanBased: false,
          requiresAdmin: false,
          rolloutType: null,
          rolloutValue: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.feature.findMany.mockResolvedValue(mockFeatures);

      // Mock isFeatureEnabled to return enabled for first feature, disabled for second
      const isFeatureEnabledSpy = jest.spyOn(service, 'isFeatureEnabled');
      isFeatureEnabledSpy
        .mockResolvedValueOnce({ enabled: true, source: 'global' })
        .mockResolvedValueOnce({ enabled: false, source: 'global' });

      const result = await service.getEnabledFeatures(orgId);

      expect(result).toEqual(['feature-1']);
      expect(mockPrisma.feature.findMany).toHaveBeenCalledWith({
        where: { isEnabled: true },
      });
    });
  });

  describe('checkQuota', () => {
    const orgId = TestHelpers.generateRandomString();

    it('should return quota exceeded when no subscription', async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(null);

      const result = await service.checkQuota(orgId, 'members');

      expect(result).toEqual({
        current: 0,
        limit: 0,
        exceeded: true,
      });
    });

    it('should check members quota correctly', async () => {
      const mockBillingAccount = {
        orgId,
        subscription: {
          plan: {
            memberLimit: 10,
          },
        },
      };

      mockPrisma.billingAccount.findUnique.mockResolvedValue(mockBillingAccount);
      mockPrisma.orgMember.count.mockResolvedValue(5);

      const result = await service.checkQuota(orgId, 'members');

      expect(result).toEqual({
        current: 5,
        limit: 10,
        exceeded: false,
      });
      expect(mockPrisma.orgMember.count).toHaveBeenCalledWith({
        where: { orgId, status: 'active' },
      });
    });

    it('should check teams quota correctly', async () => {
      const mockBillingAccount = {
        orgId,
        subscription: {
          plan: {
            teamLimit: 3,
          },
        },
      };

      mockPrisma.billingAccount.findUnique.mockResolvedValue(mockBillingAccount);
      mockPrisma.team.count.mockResolvedValue(3);

      const result = await service.checkQuota(orgId, 'teams');

      expect(result).toEqual({
        current: 3,
        limit: 3,
        exceeded: true,
      });
    });

    it('should check standups quota for current month', async () => {
      const mockBillingAccount = {
        orgId,
        subscription: {
          plan: {
            standupLimit: 100,
          },
        },
      };

      mockPrisma.billingAccount.findUnique.mockResolvedValue(mockBillingAccount);
      mockPrisma.standupInstance.count.mockResolvedValue(25);

      const result = await service.checkQuota(orgId, 'standups');

      expect(result).toEqual({
        current: 25,
        limit: 100,
        exceeded: false,
      });
      expect(mockPrisma.standupInstance.count).toHaveBeenCalledWith({
        where: {
          team: { orgId },
          targetDate: { gte: expect.any(Date) },
        },
      });
    });
  });

  describe('setFeatureOverride', () => {
    it('should create new override when none exists', async () => {
      const orgId = TestHelpers.generateRandomString();
      const featureKey = 'test-feature';
      const mockOverride = {
        id: 'override-id',
        orgId,
        featureKey,
        enabled: true,
        value: 'test-value',
        reason: 'test-reason',
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.featureOverride.upsert.mockResolvedValue(mockOverride);

      const result = await service.setFeatureOverride(orgId, featureKey, true, {
        value: 'test-value',
        reason: 'test-reason',
      });

      expect(result).toEqual(mockOverride);
      expect(mockPrisma.featureOverride.upsert).toHaveBeenCalledWith({
        where: { orgId_featureKey: { orgId, featureKey } },
        create: {
          orgId,
          featureKey,
          enabled: true,
          value: 'test-value',
          reason: 'test-reason',
        },
        update: {
          enabled: true,
          value: 'test-value',
          reason: 'test-reason',
        },
      });
    });
  });

  describe('removeFeatureOverride', () => {
    it('should delete feature override', async () => {
      const orgId = TestHelpers.generateRandomString();
      const featureKey = 'test-feature';

      await service.removeFeatureOverride(orgId, featureKey);

      expect(mockPrisma.featureOverride.delete).toHaveBeenCalledWith({
        where: { orgId_featureKey: { orgId, featureKey } },
      });
    });
  });
});
