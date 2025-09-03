import { Test, TestingModule } from '@nestjs/testing';
import { FeatureService } from '@/features/feature.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';

interface MockPrismaService {
  feature: {
    findUnique: jest.MockedFunction<PrismaService['feature']['findUnique']>;
    findMany: jest.MockedFunction<PrismaService['feature']['findMany']>;
    create: jest.MockedFunction<PrismaService['feature']['create']>;
    update: jest.MockedFunction<PrismaService['feature']['update']>;
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
      const mockFeature = {
        id: '1',
        key: 'test',
        name: 'Test',
        description: 'Test feature',
        isEnabled: false,
        environment: ['development'],
        category: 'test',
        isPlanBased: false,
        requiresAdmin: false,
        rolloutType: 'boolean',
        rolloutValue: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.feature.findUnique.mockResolvedValue(mockFeature);

      const result = await service.isFeatureEnabled('test');

      expect(result).toEqual({
        enabled: false,
        source: 'global',
        reason: 'Feature globally disabled',
      });
    });
  });

  describe('getEnabledFeatures', () => {
    it('should return enabled features for organization', async () => {
      const mockFeatures = [
        {
          id: '1',
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
        },
      ];

      mockPrismaService.feature.findMany.mockResolvedValue(mockFeatures);

      // Mock the isFeatureEnabled call for each feature
      jest.spyOn(service, 'isFeatureEnabled').mockResolvedValue({
        enabled: true,
        source: 'global',
      });

      const result = await service.getEnabledFeatures('org1');

      expect(result).toEqual(['dashboard']);
    });
  });
});
