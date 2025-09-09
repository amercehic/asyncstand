import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FeatureController } from '@/features/feature.controller';
import { FeatureService } from '@/features/feature.service';
import { CreateFeatureDto } from '@/features/dto/create-feature.dto';
import { UpdateFeatureDto } from '@/features/dto/update-feature.dto';

interface MockUser {
  id: string;
  email: string;
  orgId: string;
  role: string;
  isSuperAdmin: boolean;
}

const createMockUser = (overrides?: Partial<MockUser>): MockUser => ({
  id: 'user-1',
  email: 'test@test.com',
  orgId: 'org-1',
  role: 'owner',
  isSuperAdmin: false,
  ...overrides,
});

describe('FeatureController', () => {
  let controller: FeatureController;
  let mockFeatureService: jest.Mocked<FeatureService>;

  beforeEach(async () => {
    const mockService = {
      getEnabledFeatures: jest.fn(),
      isFeatureEnabled: jest.fn(),
      checkQuota: jest.fn(),
      listAllFeatures: jest.fn(),
      createFeature: jest.fn(),
      updateFeature: jest.fn(),
      deleteFeature: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeatureController],
      providers: [
        {
          provide: FeatureService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<FeatureController>(FeatureController);
    mockFeatureService = module.get(FeatureService) as jest.Mocked<FeatureService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getEnabledFeatures', () => {
    it('should return enabled features for user organization', async () => {
      const mockUser = createMockUser();
      const mockFeatures = ['dashboard', 'teams', 'standups'];

      mockFeatureService.getEnabledFeatures.mockResolvedValue(mockFeatures);

      const result = await controller.getEnabledFeatures(mockUser);

      expect(result).toEqual({ features: mockFeatures });
      expect(mockFeatureService.getEnabledFeatures).toHaveBeenCalledWith('org-1');
    });

    it('should return empty array when no features enabled', async () => {
      const mockUser = createMockUser();
      mockFeatureService.getEnabledFeatures.mockResolvedValue([]);

      const result = await controller.getEnabledFeatures(mockUser);

      expect(result).toEqual({ features: [] });
    });
  });

  describe('checkFeature', () => {
    it('should check if feature is enabled', async () => {
      const mockUser = createMockUser();
      const mockResult = { enabled: true, source: 'global' as const };

      mockFeatureService.isFeatureEnabled.mockResolvedValue(mockResult);

      const result = await controller.checkFeature(mockUser, 'dashboard');

      expect(result).toEqual(mockResult);
      expect(mockFeatureService.isFeatureEnabled).toHaveBeenCalledWith(
        'dashboard',
        'org-1',
        'user-1',
      );
    });

    it('should return disabled feature result', async () => {
      const mockUser = createMockUser();
      const mockResult = {
        enabled: false,
        source: 'plan' as const,
        reason: 'Not available in current plan',
      };

      mockFeatureService.isFeatureEnabled.mockResolvedValue(mockResult);

      const result = await controller.checkFeature(mockUser, 'premium-feature');

      expect(result).toEqual(mockResult);
    });

    it('should handle feature with rollout information', async () => {
      const mockUser = createMockUser();
      const mockResult = {
        enabled: true,
        source: 'rollout' as const,
        value: 'beta',
      };

      mockFeatureService.isFeatureEnabled.mockResolvedValue(mockResult);

      const result = await controller.checkFeature(mockUser, 'beta-feature');

      expect(result).toEqual(mockResult);
    });
  });

  describe('checkQuota', () => {
    it('should check quota for valid quota type', async () => {
      const mockUser = createMockUser();
      const mockResult = { current: 5, limit: 10, exceeded: false };

      mockFeatureService.checkQuota.mockResolvedValue(mockResult);

      const result = await controller.checkQuota(mockUser, 'members');

      expect(result).toEqual(mockResult);
      expect(mockFeatureService.checkQuota).toHaveBeenCalledWith('org-1', 'members');
    });

    it('should check different quota types', async () => {
      const mockUser = createMockUser();
      const quotaTypes: Array<'members' | 'teams' | 'standups' | 'storage' | 'integrations'> = [
        'members',
        'teams',
        'standups',
        'storage',
        'integrations',
      ];

      for (const quotaType of quotaTypes) {
        const mockResult = { current: 2, limit: 10, exceeded: false };
        mockFeatureService.checkQuota.mockResolvedValue(mockResult);

        const result = await controller.checkQuota(mockUser, quotaType);

        expect(result).toEqual(mockResult);
        expect(mockFeatureService.checkQuota).toHaveBeenCalledWith('org-1', quotaType);
      }
    });

    it('should handle exceeded quota', async () => {
      const mockUser = createMockUser();
      const mockResult = { current: 15, limit: 10, exceeded: true };

      mockFeatureService.checkQuota.mockResolvedValue(mockResult);

      const result = await controller.checkQuota(mockUser, 'members');

      expect(result).toEqual(mockResult);
    });

    it('should handle unlimited quota', async () => {
      const mockUser = createMockUser();
      const mockResult = { current: 5, limit: null, exceeded: false };

      mockFeatureService.checkQuota.mockResolvedValue(mockResult);

      const result = await controller.checkQuota(mockUser, 'members');

      expect(result).toEqual(mockResult);
    });
  });

  describe('Admin endpoints', () => {
    describe('listFeatures', () => {
      it('should list all features without category filter', async () => {
        const mockFeatures = [
          {
            key: 'dashboard',
            name: 'Dashboard',
            description: 'Dashboard feature',
            isEnabled: true,
            environment: ['development'],
            category: 'core',
            isPlanBased: false,
            requiresAdmin: false,
            rolloutType: 'boolean',
            rolloutValue: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            planFeatures: [],
          },
        ];
        mockFeatureService.listAllFeatures.mockResolvedValue(mockFeatures);

        const result = await controller.listFeatures();

        expect(result).toEqual({ features: mockFeatures });
        expect(mockFeatureService.listAllFeatures).toHaveBeenCalledWith(undefined);
      });

      it('should list features with category filter', async () => {
        const mockFeatures = [
          {
            key: 'dashboard',
            name: 'Dashboard',
            description: 'Dashboard feature',
            isEnabled: true,
            environment: ['development'],
            category: 'core',
            isPlanBased: false,
            requiresAdmin: false,
            rolloutType: 'boolean',
            rolloutValue: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            planFeatures: [],
          },
        ];
        mockFeatureService.listAllFeatures.mockResolvedValue(mockFeatures);

        const result = await controller.listFeatures('core');

        expect(result).toEqual({ features: mockFeatures });
        expect(mockFeatureService.listAllFeatures).toHaveBeenCalledWith('core');
      });
    });

    describe('createFeature', () => {
      it('should create a new feature', async () => {
        const createDto: CreateFeatureDto = {
          key: 'new-feature',
          name: 'New Feature',
          description: 'A new feature',
          isEnabled: true,
          environment: ['development'],
          category: 'test',
          isPlanBased: false,
          requiresAdmin: false,
          rolloutType: 'boolean',
          rolloutValue: null,
        };
        const mockFeature = {
          ...createDto,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        // @ts-expect-error - Mock data for testing
        mockFeatureService.createFeature.mockResolvedValue(mockFeature);

        const result = await controller.createFeature(createDto);

        expect(result).toEqual({ feature: mockFeature });
        expect(mockFeatureService.createFeature).toHaveBeenCalledWith(createDto);
      });

      it('should handle feature already exists error', async () => {
        const createDto: CreateFeatureDto = {
          key: 'existing-feature',
          name: 'Existing Feature',
          description: 'An existing feature',
          isEnabled: true,
          environment: ['development'],
          category: 'test',
          isPlanBased: false,
          requiresAdmin: false,
          rolloutType: 'boolean',
          rolloutValue: null,
        };
        const error = new Error("Feature with key 'existing-feature' already exists");
        mockFeatureService.createFeature.mockRejectedValue(error);

        await expect(controller.createFeature(createDto)).rejects.toThrow(BadRequestException);
      });

      it('should re-throw other errors', async () => {
        const createDto: CreateFeatureDto = {
          key: 'new-feature',
          name: 'New Feature',
          description: 'A new feature',
          isEnabled: true,
          environment: ['development'],
          category: 'test',
          isPlanBased: false,
          requiresAdmin: false,
          rolloutType: 'boolean',
          rolloutValue: null,
        };
        const error = new Error('Database connection failed');
        mockFeatureService.createFeature.mockRejectedValue(error);

        await expect(controller.createFeature(createDto)).rejects.toThrow(
          'Database connection failed',
        );
      });
    });

    describe('updateFeature', () => {
      it('should update a feature', async () => {
        const updateDto: UpdateFeatureDto = {
          name: 'Updated Feature',
          isEnabled: false,
        };
        const updatedFeature = {
          key: 'test-feature',
          name: 'Updated Feature',
          isEnabled: false,
          description: 'Test feature',
          environment: ['development'],
          category: 'test',
          isPlanBased: false,
          requiresAdmin: false,
          rolloutType: 'boolean',
          rolloutValue: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockFeatureService.updateFeature.mockResolvedValue(updatedFeature);

        const result = await controller.updateFeature('test-feature', updateDto);

        expect(result).toEqual({ feature: updatedFeature });
        expect(mockFeatureService.updateFeature).toHaveBeenCalledWith('test-feature', updateDto);
      });
    });

    describe('deleteFeature', () => {
      it('should delete a feature', async () => {
        const deletedFeature = {
          key: 'test-feature',
          name: 'Test Feature',
        };
        // @ts-expect-error - Mock data for testing
        mockFeatureService.deleteFeature.mockResolvedValue(deletedFeature);

        const result = await controller.deleteFeature('test-feature');

        expect(result).toEqual({ success: true });
        expect(mockFeatureService.deleteFeature).toHaveBeenCalledWith('test-feature');
      });
    });
  });
});
