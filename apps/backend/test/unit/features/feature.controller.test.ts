import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { FeatureController } from '@/features/feature.controller';
import { FeatureService } from '@/features/feature.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { FeatureOverride } from '@prisma/client';
import { createMockPrismaService } from '@/test/utils/mocks/prisma.mock';
import { TestHelpers } from '@/test/utils/test-helpers';

describe('FeatureController', () => {
  let controller: FeatureController;
  let mockFeatureService: jest.Mocked<FeatureService>;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  const mockAuthenticatedUser = {
    id: TestHelpers.generateRandomString(),
    email: 'test@example.com',
    name: 'Test User',
    isSuperAdmin: false,
    orgId: TestHelpers.generateRandomString(),
    role: 'member',
  };

  const mockSuperAdminUser = {
    ...mockAuthenticatedUser,
    isSuperAdmin: true,
    role: 'owner',
  };

  beforeEach(async () => {
    mockFeatureService = {
      getEnabledFeatures: jest.fn(),
      isFeatureEnabled: jest.fn(),
      checkQuota: jest.fn(),
      setFeatureOverride: jest.fn(),
      removeFeatureOverride: jest.fn(),
    } as unknown as jest.Mocked<FeatureService>;

    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeatureController],
      providers: [
        { provide: FeatureService, useValue: mockFeatureService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<FeatureController>(FeatureController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEnabledFeatures', () => {
    it('should return enabled features for organization', async () => {
      const enabledFeatures = ['feature-1', 'feature-2'];
      mockFeatureService.getEnabledFeatures.mockResolvedValue(enabledFeatures);

      const result = await controller.getEnabledFeatures(mockAuthenticatedUser);

      expect(result).toEqual({ features: enabledFeatures });
      expect(mockFeatureService.getEnabledFeatures).toHaveBeenCalledWith(
        mockAuthenticatedUser.orgId,
      );
    });
  });

  describe('checkFeature', () => {
    it('should return feature check result', async () => {
      const featureKey = 'test-feature';
      const featureResult = { enabled: true, source: 'global' as const };
      mockFeatureService.isFeatureEnabled.mockResolvedValue(featureResult);

      const result = await controller.checkFeature(mockAuthenticatedUser, featureKey);

      expect(result).toEqual(featureResult);
      expect(mockFeatureService.isFeatureEnabled).toHaveBeenCalledWith(
        featureKey,
        mockAuthenticatedUser.orgId,
        mockAuthenticatedUser.id,
      );
    });
  });

  describe('checkQuota', () => {
    it('should return quota information', async () => {
      const quotaResult = { current: 5, limit: 10, exceeded: false };
      mockFeatureService.checkQuota.mockResolvedValue(quotaResult);

      const result = await controller.checkQuota(mockAuthenticatedUser, 'members');

      expect(result).toEqual(quotaResult);
      expect(mockFeatureService.checkQuota).toHaveBeenCalledWith(
        mockAuthenticatedUser.orgId,
        'members',
      );
    });

    it('should handle different quota types', async () => {
      const quotaTypes: Array<'members' | 'teams' | 'standups' | 'storage' | 'integrations'> = [
        'members',
        'teams',
        'standups',
        'storage',
        'integrations',
      ];

      for (const quotaType of quotaTypes) {
        const quotaResult = { current: 1, limit: 10, exceeded: false };
        mockFeatureService.checkQuota.mockResolvedValue(quotaResult);

        await controller.checkQuota(mockAuthenticatedUser, quotaType);

        expect(mockFeatureService.checkQuota).toHaveBeenCalledWith(
          mockAuthenticatedUser.orgId,
          quotaType,
        );
      }
    });
  });

  describe('listFeatures', () => {
    it('should list all features without category filter', async () => {
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
      ];

      mockPrisma.feature.findMany.mockResolvedValue(mockFeatures);

      const result = await controller.listFeatures();

      expect(result).toEqual({ features: mockFeatures });
      expect(mockPrisma.feature.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          planFeatures: {
            include: { plan: true },
          },
          _count: {
            select: { orgOverrides: true },
          },
        },
        orderBy: { key: 'asc' },
      });
    });

    it('should list features with category filter', async () => {
      const category = 'billing';
      const mockFeatures = [];

      mockPrisma.feature.findMany.mockResolvedValue(mockFeatures);

      const result = await controller.listFeatures(category);

      expect(result).toEqual({ features: mockFeatures });
      expect(mockPrisma.feature.findMany).toHaveBeenCalledWith({
        where: { category },
        include: {
          planFeatures: {
            include: { plan: true },
          },
          _count: {
            select: { orgOverrides: true },
          },
        },
        orderBy: { key: 'asc' },
      });
    });
  });

  describe('createFeature', () => {
    it('should create a new feature', async () => {
      const createFeatureDto = {
        key: 'new-feature',
        name: 'New Feature',
        description: 'A new feature',
        isEnabled: true,
        environment: ['development'],
        category: 'test',
        isPlanBased: false,
        requiresAdmin: false,
        rolloutType: 'percentage',
        rolloutValue: { percentage: 50 },
      };

      const mockFeature = {
        id: 'feature-id',
        ...createFeatureDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.feature.create.mockResolvedValue(mockFeature);

      const result = await controller.createFeature(createFeatureDto);

      expect(result).toEqual({ feature: mockFeature });
      expect(mockPrisma.feature.create).toHaveBeenCalledWith({
        data: createFeatureDto,
      });
    });
  });

  describe('updateFeature', () => {
    it('should update an existing feature', async () => {
      const featureKey = 'existing-feature';
      const updateFeatureDto = {
        name: 'Updated Feature',
        isEnabled: false,
      };

      const mockUpdatedFeature = {
        id: 'feature-id',
        key: featureKey,
        name: 'Updated Feature',
        description: null,
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

      mockPrisma.feature.update.mockResolvedValue(mockUpdatedFeature);

      const result = await controller.updateFeature(featureKey, updateFeatureDto);

      expect(result).toEqual({ feature: mockUpdatedFeature });
      expect(mockPrisma.feature.update).toHaveBeenCalledWith({
        where: { key: featureKey },
        data: updateFeatureDto,
      });
    });
  });

  describe('setOverride', () => {
    it('should set feature override for specified org', async () => {
      const featureKey = 'test-feature';
      const targetOrgId = TestHelpers.generateRandomString();
      const overrideDto = {
        featureKey,
        orgId: targetOrgId,
        enabled: true,
        value: 'override-value',
        reason: 'Testing override',
      };

      const mockFeature = {
        id: 'feature-id',
        key: featureKey,
        name: 'Test Feature',
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
      };

      const mockOverride: FeatureOverride = {
        id: 'override-id',
        orgId: targetOrgId,
        featureKey,
        enabled: true,
        value: 'override-value',
        reason: 'Testing override',
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.feature.findUnique.mockResolvedValue(mockFeature);
      mockFeatureService.setFeatureOverride.mockResolvedValue(mockOverride);

      const result = await controller.setOverride(mockSuperAdminUser, overrideDto);

      expect(result).toEqual({ override: mockOverride });
      expect(mockPrisma.feature.findUnique).toHaveBeenCalledWith({
        where: { key: featureKey },
      });
      expect(mockFeatureService.setFeatureOverride).toHaveBeenCalledWith(
        targetOrgId,
        featureKey,
        true,
        {
          value: 'override-value',
          reason: 'Testing override',
          expiresAt: undefined,
        },
      );
    });

    it('should use current user org when no orgId specified', async () => {
      const featureKey = 'test-feature';
      const overrideDto = {
        featureKey,
        enabled: true,
      };

      const mockFeature = {
        id: 'feature-id',
        key: featureKey,
        name: 'Test Feature',
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
      };

      const mockOverride: FeatureOverride = {
        id: 'override-id',
        orgId: mockSuperAdminUser.orgId,
        featureKey,
        enabled: true,
        value: null,
        reason: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.feature.findUnique.mockResolvedValue(mockFeature);
      mockFeatureService.setFeatureOverride.mockResolvedValue(mockOverride);

      await controller.setOverride(mockSuperAdminUser, overrideDto);

      expect(mockFeatureService.setFeatureOverride).toHaveBeenCalledWith(
        mockSuperAdminUser.orgId,
        featureKey,
        true,
        {
          value: undefined,
          reason: undefined,
          expiresAt: undefined,
        },
      );
    });

    it('should throw error when feature not found', async () => {
      const featureKey = 'nonexistent-feature';
      const overrideDto = {
        featureKey,
        enabled: true,
      };

      mockPrisma.feature.findUnique.mockResolvedValue(null);

      await expect(controller.setOverride(mockSuperAdminUser, overrideDto)).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Feature not found', HttpStatus.NOT_FOUND),
      );
    });

    it('should handle expiration date parsing', async () => {
      const featureKey = 'test-feature';
      const expirationDate = '2024-12-31T23:59:59Z';
      const overrideDto = {
        featureKey,
        enabled: true,
        expiresAt: expirationDate,
      };

      const mockFeature = {
        id: 'feature-id',
        key: featureKey,
        name: 'Test Feature',
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
      };

      const mockOverride: FeatureOverride = {
        id: 'override-id',
        orgId: mockSuperAdminUser.orgId,
        featureKey,
        enabled: true,
        value: null,
        reason: null,
        expiresAt: new Date(expirationDate),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.feature.findUnique.mockResolvedValue(mockFeature);
      mockFeatureService.setFeatureOverride.mockResolvedValue(mockOverride);

      await controller.setOverride(mockSuperAdminUser, overrideDto);

      expect(mockFeatureService.setFeatureOverride).toHaveBeenCalledWith(
        mockSuperAdminUser.orgId,
        featureKey,
        true,
        {
          value: undefined,
          reason: undefined,
          expiresAt: new Date(expirationDate),
        },
      );
    });
  });

  describe('removeOverride', () => {
    it('should remove feature override', async () => {
      const orgId = TestHelpers.generateRandomString();
      const featureKey = 'test-feature';

      const result = await controller.removeOverride(orgId, featureKey);

      expect(result).toEqual({ message: 'Override removed successfully' });
      expect(mockFeatureService.removeFeatureOverride).toHaveBeenCalledWith(orgId, featureKey);
    });
  });

  describe('listOverrides', () => {
    it('should list all feature overrides for user org', async () => {
      const mockOverrides = [
        {
          id: 'override-1',
          orgId: mockSuperAdminUser.orgId,
          featureKey: 'feature-1',
          enabled: true,
          value: null,
          reason: null,
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          feature: {
            id: 'feature-1',
            key: 'feature-1',
            name: 'Feature 1',
          },
        },
      ];

      mockPrisma.featureOverride.findMany.mockResolvedValue(mockOverrides);

      const result = await controller.listOverrides(mockSuperAdminUser);

      expect(result).toEqual({ overrides: mockOverrides });
      expect(mockPrisma.featureOverride.findMany).toHaveBeenCalledWith({
        where: { orgId: mockSuperAdminUser.orgId },
        include: { feature: true },
      });
    });
  });
});
