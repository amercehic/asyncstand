import { Test, TestingModule } from '@nestjs/testing';
import { FeatureService } from '@/features/feature.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { Feature, PlanFeature } from '@prisma/client';

interface MockPrismaService {
  feature: {
    findUnique: jest.MockedFunction<PrismaService['feature']['findUnique']>;
    findMany: jest.MockedFunction<PrismaService['feature']['findMany']>;
    create: jest.MockedFunction<PrismaService['feature']['create']>;
    update: jest.MockedFunction<PrismaService['feature']['update']>;
    delete: jest.MockedFunction<PrismaService['feature']['delete']>;
  };
  planFeature: {
    findUnique: jest.MockedFunction<PrismaService['planFeature']['findUnique']>;
  };
  billingAccount: {
    findUnique: jest.MockedFunction<PrismaService['billingAccount']['findUnique']>;
  };
  orgMember: {
    count: jest.MockedFunction<PrismaService['orgMember']['count']>;
  };
  team: {
    count: jest.MockedFunction<PrismaService['team']['count']>;
  };
  standupInstance: {
    count: jest.MockedFunction<PrismaService['standupInstance']['count']>;
  };
  integration: {
    count: jest.MockedFunction<PrismaService['integration']['count']>;
  };
}

const createMockFeature = (overrides?: Partial<Feature>): Feature =>
  ({
    key: 'test-feature',
    name: 'Test Feature',
    description: 'Test feature description',
    isEnabled: true,
    environment: ['test'], // Use 'test' environment to match NODE_ENV
    category: 'test',
    isPlanBased: false,
    requiresAdmin: false,
    rolloutType: 'boolean',
    rolloutValue: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Feature;

const createMockPlanFeature = (overrides?: Partial<PlanFeature>): PlanFeature =>
  ({
    planId: 'plan-1',
    featureKey: 'test-feature',
    enabled: true,
    value: null,
    ...overrides,
  }) as PlanFeature;

const createMockBillingAccount = (overrides?: Record<string, unknown>) => ({
  id: '1',
  orgId: 'org-1',
  stripeCustomerId: 'cust-123',
  createdAt: new Date(),
  updatedAt: new Date(),
  billingEmail: 'billing@test.com',
  defaultPaymentMethod: 'pm_test',
  taxId: null,
  country: 'US',
  subscription: {
    id: 'sub-1',
    planId: 'plan-1',
    plan: {
      id: 'plan-1',
      memberLimit: 10,
      teamLimit: 5,
      standupLimit: 100,
      integrationLimit: 3,
      storageLimit: 1000,
    },
    ...(overrides?.subscription as Record<string, unknown>),
  },
  ...overrides,
});

describe('FeatureService', () => {
  let service: FeatureService;
  let mockPrismaService: MockPrismaService;

  beforeEach(async () => {
    const mockPrisma: MockPrismaService = {
      feature: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      planFeature: {
        findUnique: jest.fn(),
      },
      billingAccount: {
        findUnique: jest.fn(),
      },
      orgMember: {
        count: jest.fn(),
      },
      team: {
        count: jest.fn(),
      },
      standupInstance: {
        count: jest.fn(),
      },
      integration: {
        count: jest.fn(),
      },
    };

    const mockLogger = {
      setContext: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureService,
        {
          provide: PrismaService,
          useValue: mockPrisma as unknown as PrismaService,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<FeatureService>(FeatureService);
    mockPrismaService = module.get(PrismaService) as MockPrismaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isFeatureEnabled', () => {
    it('should return false when feature not found', async () => {
      mockPrismaService.feature.findUnique.mockResolvedValue(null);

      const result = await service.isFeatureEnabled('nonexistent');

      expect(result).toEqual({
        enabled: false,
        source: 'global',
        reason: 'Feature not found',
      });
    });

    it('should return false when feature is globally disabled', async () => {
      const mockFeature = createMockFeature({ isEnabled: false });
      mockPrismaService.feature.findUnique.mockResolvedValue(mockFeature);

      const result = await service.isFeatureEnabled('test-feature');

      expect(result).toEqual({
        enabled: false,
        source: 'global',
        reason: 'Feature globally disabled',
      });
    });

    it('should return false when environment does not match', async () => {
      const mockFeature = createMockFeature({ environment: ['production'] });
      mockPrismaService.feature.findUnique.mockResolvedValue(mockFeature);

      const result = await service.isFeatureEnabled('test-feature');

      expect(result).toEqual({
        enabled: false,
        source: 'environment',
        reason: 'Not available in test environment',
      });
    });

    it('should return true when feature is enabled globally', async () => {
      const mockFeature = createMockFeature();
      mockPrismaService.feature.findUnique.mockResolvedValue(mockFeature);

      const result = await service.isFeatureEnabled('test-feature');

      expect(result).toEqual({
        enabled: true,
        source: 'global',
      });
    });

    it('should check plan-based features', async () => {
      const mockFeature = createMockFeature({ isPlanBased: true });
      const mockPlanFeature = createMockPlanFeature({ enabled: true, value: 'premium' });
      const mockBillingAccount = createMockBillingAccount();

      mockPrismaService.feature.findUnique.mockResolvedValue(mockFeature);
      mockPrismaService.billingAccount.findUnique.mockResolvedValue(mockBillingAccount);
      mockPrismaService.planFeature.findUnique.mockResolvedValue(mockPlanFeature);

      const result = await service.isFeatureEnabled('test-feature', 'org-1');

      expect(result).toEqual({
        enabled: true,
        source: 'plan',
        value: 'premium',
      });
    });

    it('should return false for disabled plan-based feature', async () => {
      const mockFeature = createMockFeature({ isPlanBased: true });
      const mockPlanFeature = createMockPlanFeature({ enabled: false });
      const mockBillingAccount = createMockBillingAccount();

      mockPrismaService.feature.findUnique.mockResolvedValue(mockFeature);
      mockPrismaService.billingAccount.findUnique.mockResolvedValue(mockBillingAccount);
      mockPrismaService.planFeature.findUnique.mockResolvedValue(mockPlanFeature);

      const result = await service.isFeatureEnabled('test-feature', 'org-1');

      expect(result).toEqual({
        enabled: false,
        source: 'plan',
        value: undefined,
      });
    });

    describe('rollout functionality', () => {
      it('should handle percentage rollout - enabled', async () => {
        const mockFeature = createMockFeature({
          rolloutType: 'percentage',
          rolloutValue: { percentage: 100 },
        });
        mockPrismaService.feature.findUnique.mockResolvedValue(mockFeature);

        const result = await service.isFeatureEnabled('test-feature', 'org-1');

        expect(result).toEqual({
          enabled: true,
          source: 'rollout',
        });
      });

      it('should handle percentage rollout - disabled', async () => {
        const mockFeature = createMockFeature({
          rolloutType: 'percentage',
          rolloutValue: { percentage: 0 },
        });
        mockPrismaService.feature.findUnique.mockResolvedValue(mockFeature);

        const result = await service.isFeatureEnabled('test-feature', 'org-1');

        expect(result).toEqual({
          enabled: false,
          source: 'rollout',
        });
      });

      it('should handle org list rollout - enabled', async () => {
        const mockFeature = createMockFeature({
          rolloutType: 'org_list',
          rolloutValue: { orgIds: ['org-1', 'org-2'] },
        });
        mockPrismaService.feature.findUnique.mockResolvedValue(mockFeature);

        const result = await service.isFeatureEnabled('test-feature', 'org-1');

        expect(result).toEqual({
          enabled: true,
          source: 'rollout',
        });
      });

      it('should handle org list rollout - disabled', async () => {
        const mockFeature = createMockFeature({
          rolloutType: 'org_list',
          rolloutValue: { orgIds: ['org-2', 'org-3'] },
        });
        mockPrismaService.feature.findUnique.mockResolvedValue(mockFeature);

        const result = await service.isFeatureEnabled('test-feature', 'org-1');

        expect(result).toEqual({
          enabled: false,
          source: 'rollout',
        });
      });

      it('should handle user list rollout - enabled', async () => {
        const mockFeature = createMockFeature({
          rolloutType: 'user_list',
          rolloutValue: { userIds: ['user-1', 'user-2'] },
        });
        mockPrismaService.feature.findUnique.mockResolvedValue(mockFeature);

        const result = await service.isFeatureEnabled('test-feature', 'org-1', 'user-1');

        expect(result).toEqual({
          enabled: true,
          source: 'rollout',
        });
      });

      it('should handle user list rollout - disabled without userId', async () => {
        const mockFeature = createMockFeature({
          rolloutType: 'user_list',
          rolloutValue: { userIds: ['user-1', 'user-2'] },
        });
        mockPrismaService.feature.findUnique.mockResolvedValue(mockFeature);

        const result = await service.isFeatureEnabled('test-feature', 'org-1');

        expect(result).toEqual({
          enabled: false,
          source: 'rollout',
        });
      });
    });

    it('should handle errors gracefully', async () => {
      mockPrismaService.feature.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await service.isFeatureEnabled('test-feature');

      expect(result).toEqual({
        enabled: false,
        source: 'global',
        reason: 'Error checking feature',
      });
    });
  });

  describe('getEnabledFeatures', () => {
    it('should return enabled features for organization', async () => {
      const mockFeatures = [
        createMockFeature({ key: 'dashboard' }),
        createMockFeature({ key: 'teams' }),
      ];

      mockPrismaService.feature.findMany.mockResolvedValue(mockFeatures);

      // Mock the isFeatureEnabled call for each feature
      const isFeatureEnabledSpy = jest
        .spyOn(service, 'isFeatureEnabled')
        .mockResolvedValue({ enabled: true, source: 'global' });

      const result = await service.getEnabledFeatures('org1');

      expect(result).toEqual(['dashboard', 'teams']);
      expect(isFeatureEnabledSpy).toHaveBeenCalledTimes(2);
    });

    it('should filter out disabled features', async () => {
      const mockFeatures = [
        createMockFeature({ key: 'dashboard' }),
        createMockFeature({ key: 'teams' }),
      ];

      mockPrismaService.feature.findMany.mockResolvedValue(mockFeatures);

      const isFeatureEnabledSpy = jest
        .spyOn(service, 'isFeatureEnabled')
        .mockImplementation((key) => {
          if (key === 'dashboard') {
            return Promise.resolve({ enabled: true, source: 'global' });
          }
          return Promise.resolve({ enabled: false, source: 'plan' });
        });

      const result = await service.getEnabledFeatures('org1');

      expect(result).toEqual(['dashboard']);
      expect(isFeatureEnabledSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkQuota', () => {
    beforeEach(() => {
      mockPrismaService.billingAccount.findUnique.mockResolvedValue(createMockBillingAccount());
    });

    it('should check members quota', async () => {
      mockPrismaService.orgMember.count.mockResolvedValue(5);

      const result = await service.checkQuota('org-1', 'members');

      expect(result).toEqual({
        current: 5,
        limit: 10,
        exceeded: false,
      });
    });

    it('should detect when quota is exceeded', async () => {
      mockPrismaService.orgMember.count.mockResolvedValue(15);

      const result = await service.checkQuota('org-1', 'members');

      expect(result).toEqual({
        current: 15,
        limit: 10,
        exceeded: true,
      });
    });

    it('should check teams quota', async () => {
      mockPrismaService.team.count.mockResolvedValue(3);

      const result = await service.checkQuota('org-1', 'teams');

      expect(result).toEqual({
        current: 3,
        limit: 5,
        exceeded: false,
      });
    });

    it('should check standups quota', async () => {
      mockPrismaService.standupInstance.count.mockResolvedValue(50);

      const result = await service.checkQuota('org-1', 'standups');

      expect(result).toEqual({
        current: 50,
        limit: 100,
        exceeded: false,
      });
    });

    it('should check integrations quota', async () => {
      mockPrismaService.integration.count.mockResolvedValue(2);

      const result = await service.checkQuota('org-1', 'integrations');

      expect(result).toEqual({
        current: 2,
        limit: 3,
        exceeded: false,
      });
    });

    it('should check storage quota', async () => {
      const result = await service.checkQuota('org-1', 'storage');

      expect(result).toEqual({
        current: 0,
        limit: 1000,
        exceeded: false,
      });
    });

    it('should return exceeded when no subscription', async () => {
      mockPrismaService.billingAccount.findUnique.mockResolvedValue(null);

      const result = await service.checkQuota('org-1', 'members');

      expect(result).toEqual({
        current: 0,
        limit: 0,
        exceeded: true,
      });
    });
  });

  describe('Admin methods', () => {
    describe('listAllFeatures', () => {
      it('should return all features without category filter', async () => {
        const mockFeatures = [
          createMockFeature({ key: 'feature1', category: 'core' }),
          createMockFeature({ key: 'feature2', category: 'billing' }),
        ];
        mockPrismaService.feature.findMany.mockResolvedValue(mockFeatures);

        const result = await service.listAllFeatures();

        expect(result).toEqual(mockFeatures);
        expect(mockPrismaService.feature.findMany).toHaveBeenCalledWith({
          where: {},
          include: {
            planFeatures: {
              include: { plan: true },
            },
          },
          orderBy: { key: 'asc' },
        });
      });

      it('should filter features by category', async () => {
        const mockFeatures = [createMockFeature({ category: 'core' })];
        mockPrismaService.feature.findMany.mockResolvedValue(mockFeatures);

        await service.listAllFeatures('core');

        expect(mockPrismaService.feature.findMany).toHaveBeenCalledWith({
          where: { category: 'core' },
          include: {
            planFeatures: {
              include: { plan: true },
            },
          },
          orderBy: { key: 'asc' },
        });
      });
    });

    describe('createFeature', () => {
      it('should create a new feature', async () => {
        const createDto = {
          key: 'new-feature',
          name: 'New Feature',
          description: 'A new feature',
          isEnabled: true,
          environment: ['development'],
          category: 'test',
          isPlanBased: false,
          requiresAdmin: false,
          rolloutType: 'boolean' as const,
          rolloutValue: null,
        };
        const mockFeature = createMockFeature(createDto);
        mockPrismaService.feature.create.mockResolvedValue(mockFeature);

        const result = await service.createFeature(createDto);

        expect(result).toEqual(mockFeature);
        expect(mockPrismaService.feature.create).toHaveBeenCalledWith({
          data: createDto,
        });
      });

      it('should handle unique constraint violation', async () => {
        const createDto = {
          key: 'existing-feature',
          name: 'Existing Feature',
          description: 'An existing feature',
          isEnabled: true,
          environment: ['development'],
          category: 'test',
          isPlanBased: false,
          requiresAdmin: false,
          rolloutType: 'boolean' as const,
          rolloutValue: null,
        };
        const error = {
          code: 'P2002',
          meta: { target: ['key'] },
        };
        mockPrismaService.feature.create.mockRejectedValue(error);

        await expect(service.createFeature(createDto)).rejects.toThrow(
          "Feature with key 'existing-feature' already exists",
        );
      });
    });

    describe('updateFeature', () => {
      it('should update a feature', async () => {
        const updateDto = { name: 'Updated Feature', isEnabled: false };
        const updatedFeature = createMockFeature(updateDto);
        mockPrismaService.feature.update.mockResolvedValue(updatedFeature);

        const result = await service.updateFeature('test-feature', updateDto);

        expect(result).toEqual(updatedFeature);
        expect(mockPrismaService.feature.update).toHaveBeenCalledWith({
          where: { key: 'test-feature' },
          data: updateDto,
        });
      });
    });

    describe('deleteFeature', () => {
      it('should delete a feature', async () => {
        const deletedFeature = createMockFeature();
        mockPrismaService.feature.delete.mockResolvedValue(deletedFeature);

        const result = await service.deleteFeature('test-feature');

        expect(result).toEqual(deletedFeature);
        expect(mockPrismaService.feature.delete).toHaveBeenCalledWith({
          where: { key: 'test-feature' },
        });
      });
    });
  });
});
