import { Test, TestingModule } from '@nestjs/testing';
import { FeatureController } from '@/features/feature.controller';
import { FeatureService } from '@/features/feature.service';

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

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getEnabledFeatures', () => {
    it('should return enabled features', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        orgId: 'org1',
        role: 'owner',
        isSuperAdmin: false,
      };
      const mockFeatures = ['dashboard', 'teams', 'standups'];

      mockFeatureService.getEnabledFeatures.mockResolvedValue(mockFeatures);

      const result = await controller.getEnabledFeatures(mockUser);

      expect(result).toEqual({ features: mockFeatures });
      expect(mockFeatureService.getEnabledFeatures).toHaveBeenCalledWith('org1');
    });
  });

  describe('checkFeature', () => {
    it('should check if feature is enabled', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        orgId: 'org1',
        role: 'owner',
        isSuperAdmin: false,
      };
      const mockResult = { enabled: true, source: 'global' as const };

      mockFeatureService.isFeatureEnabled.mockResolvedValue(mockResult);

      const result = await controller.checkFeature(mockUser, 'dashboard');

      expect(result).toEqual(mockResult);
      expect(mockFeatureService.isFeatureEnabled).toHaveBeenCalledWith('dashboard', 'org1', '1');
    });
  });

  describe('checkQuota', () => {
    it('should check quota', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        orgId: 'org1',
        role: 'owner',
        isSuperAdmin: false,
      };
      const mockResult = { current: 5, limit: 10, exceeded: false };

      mockFeatureService.checkQuota.mockResolvedValue(mockResult);

      const result = await controller.checkQuota(mockUser, 'members');

      expect(result).toEqual(mockResult);
      expect(mockFeatureService.checkQuota).toHaveBeenCalledWith('org1', 'members');
    });
  });
});
