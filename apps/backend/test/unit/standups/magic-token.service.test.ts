import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MagicTokenService } from '@/standups/services/magic-token.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';

describe('MagicTokenService', () => {
  let service: MagicTokenService;
  let mockJwtService: jest.Mocked<JwtService>;
  // let mockConfigService: jest.Mocked<ConfigService>;
  let mockPrismaService: {
    standupInstance: {
      findFirst: jest.Mock;
    };
    answer: {
      findFirst: jest.Mock;
    };
  };
  let mockLogger: jest.Mocked<LoggerService>;

  const mockJwtSecret = 'test-jwt-secret';
  const mockBaseUrl = 'http://localhost:3000';
  const mockInstanceId = 'instance-123';
  const mockTeamMemberId = 'member-123';
  const mockPlatformUserId = 'platform-user-123';
  const mockOrgId = 'org-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MagicTokenService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'jwtSecret') return mockJwtSecret;
              if (key === 'appUrl') return mockBaseUrl;
              return undefined;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            standupInstance: {
              findFirst: jest.fn(),
            },
            answer: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: LoggerService,
          useValue: {
            setContext: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MagicTokenService>(MagicTokenService);
    mockJwtService = module.get(JwtService);
    // mockConfigService = module.get(ConfigService);
    mockPrismaService = module.get(PrismaService) as typeof mockPrismaService;
    mockLogger = module.get(LoggerService);

    jest.clearAllMocks();
  });

  describe('generateMagicToken', () => {
    it('should generate a magic token with correct payload', async () => {
      const mockToken = 'mock-jwt-token';
      const expirationHours = 24;

      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await service.generateMagicToken(
        mockInstanceId,
        mockTeamMemberId,
        mockPlatformUserId,
        mockOrgId,
        expirationHours,
      );

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          standupInstanceId: mockInstanceId,
          teamMemberId: mockTeamMemberId,
          platformUserId: mockPlatformUserId,
          orgId: mockOrgId,
        },
        {
          secret: mockJwtSecret,
          expiresIn: `${expirationHours}h`,
        },
      );

      expect(result).toEqual({
        token: mockToken,
        expiresAt: expect.any(Date),
        submissionUrl: `${mockBaseUrl}/standup/respond/${mockToken}`,
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Generating magic token', {
        standupInstanceId: mockInstanceId,
        teamMemberId: mockTeamMemberId,
        platformUserId: mockPlatformUserId,
        orgId: mockOrgId,
        expirationHours,
      });
    });

    it('should use default expiration hours when not provided', async () => {
      const mockToken = 'mock-jwt-token';
      mockJwtService.sign.mockReturnValue(mockToken);

      await service.generateMagicToken(
        mockInstanceId,
        mockTeamMemberId,
        mockPlatformUserId,
        mockOrgId,
      );

      expect(mockJwtService.sign).toHaveBeenCalledWith(expect.any(Object), {
        secret: mockJwtSecret,
        expiresIn: '24h',
      });
    });
  });

  describe('validateMagicToken', () => {
    const mockToken = 'valid-token';
    const mockDecodedPayload = {
      standupInstanceId: mockInstanceId,
      teamMemberId: mockTeamMemberId,
      platformUserId: mockPlatformUserId,
      orgId: mockOrgId,
    };

    const mockInstance = {
      id: mockInstanceId,
      state: 'collecting',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      configSnapshot: {
        responseTimeoutHours: 24,
        questions: ['What did you work on?', 'What are you working on today?'],
      },
      team: {
        members: [
          {
            id: mockTeamMemberId,
            active: true,
          },
        ],
      },
    };

    beforeEach(() => {
      // Mock current time to be within response window
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T20:00:00Z')); // 10 hours after creation
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should validate a valid token successfully', async () => {
      mockJwtService.verify.mockReturnValue(mockDecodedPayload);
      mockPrismaService.standupInstance.findFirst.mockResolvedValue(mockInstance);

      const result = await service.validateMagicToken(mockToken);

      expect(mockJwtService.verify).toHaveBeenCalledWith(mockToken, {
        secret: mockJwtSecret,
      });

      expect(mockPrismaService.standupInstance.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockInstanceId,
          team: { orgId: mockOrgId },
        },
        include: {
          team: {
            include: {
              members: {
                where: { id: mockTeamMemberId, active: true },
              },
            },
          },
        },
      });

      expect(result).toEqual(mockDecodedPayload);
    });

    it('should return null for invalid JWT token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.validateMagicToken('invalid-token');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Magic token validation error', {
        error: 'Invalid token',
        tokenProvided: true,
      });
    });

    it('should return null when standup instance not found', async () => {
      mockJwtService.verify.mockReturnValue(mockDecodedPayload);
      mockPrismaService.standupInstance.findFirst.mockResolvedValue(null);

      const result = await service.validateMagicToken(mockToken);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Magic token validation failed: instance not found',
        {
          instanceId: mockInstanceId,
          orgId: mockOrgId,
        },
      );
    });

    it('should return null when team member not found or inactive', async () => {
      mockJwtService.verify.mockReturnValue(mockDecodedPayload);
      mockPrismaService.standupInstance.findFirst.mockResolvedValue({
        ...mockInstance,
        team: { members: [] },
      });

      const result = await service.validateMagicToken(mockToken);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Magic token validation failed: team member not found or inactive',
        {
          teamMemberId: mockTeamMemberId,
          instanceId: mockInstanceId,
        },
      );
    });

    it('should return null when standup is not collecting responses', async () => {
      mockJwtService.verify.mockReturnValue(mockDecodedPayload);
      mockPrismaService.standupInstance.findFirst.mockResolvedValue({
        ...mockInstance,
        state: 'completed',
      });

      const result = await service.validateMagicToken(mockToken);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Magic token validation failed: standup not accepting responses',
        {
          instanceId: mockInstanceId,
          currentState: 'completed',
        },
      );
    });

    it('should return null when response window has closed', async () => {
      // Set current time to be after the response window (25 hours after creation)
      jest.setSystemTime(new Date('2024-01-02T11:00:00Z'));

      mockJwtService.verify.mockReturnValue(mockDecodedPayload);
      mockPrismaService.standupInstance.findFirst.mockResolvedValue(mockInstance);

      const result = await service.validateMagicToken(mockToken);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Magic token validation failed: response window closed',
        {
          instanceId: mockInstanceId,
          timeoutAt: '2024-01-02T10:00:00.000Z',
          currentTime: '2024-01-02T11:00:00.000Z',
        },
      );
    });
  });

  describe('getStandupInfoForToken', () => {
    const mockTokenPayload = {
      standupInstanceId: mockInstanceId,
      teamMemberId: mockTeamMemberId,
      platformUserId: mockPlatformUserId,
      orgId: mockOrgId,
    };

    const mockInstance = {
      id: mockInstanceId,
      targetDate: new Date('2024-01-01'),
      createdAt: new Date('2024-01-01T10:00:00Z'),
      state: 'collecting',
      configSnapshot: {
        questions: ['What did you work on?', 'What are you working on today?'],
        responseTimeoutHours: 24,
      },
      team: {
        id: 'team-123',
        name: 'Engineering Team',
        members: [
          {
            id: mockTeamMemberId,
            name: 'John Doe',
            platformUserId: mockPlatformUserId,
            integrationUser: {
              name: 'john.doe',
            },
          },
        ],
      },
    };

    it('should return standup info for valid token payload', async () => {
      mockPrismaService.standupInstance.findFirst.mockResolvedValue(mockInstance);

      const result = await service.getStandupInfoForToken(mockTokenPayload);

      expect(mockPrismaService.standupInstance.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockInstanceId,
          team: { orgId: mockOrgId },
        },
        include: {
          team: {
            include: {
              members: {
                where: { id: mockTeamMemberId },
                include: {
                  integrationUser: true,
                },
              },
            },
          },
        },
      });

      expect(result).toEqual({
        instance: {
          id: mockInstanceId,
          targetDate: mockInstance.targetDate,
          createdAt: mockInstance.createdAt,
          state: 'collecting',
          timeoutAt: new Date('2024-01-02T10:00:00.000Z'),
        },
        team: {
          id: 'team-123',
          name: 'Engineering Team',
        },
        member: {
          id: mockTeamMemberId,
          name: 'John Doe',
          platformUserId: mockPlatformUserId,
        },
        questions: ['What did you work on?', 'What are you working on today?'],
      });
    });

    it('should return null when instance not found', async () => {
      mockPrismaService.standupInstance.findFirst.mockResolvedValue(null);

      const result = await service.getStandupInfoForToken(mockTokenPayload);

      expect(result).toBeNull();
    });

    it('should return null when team member not found', async () => {
      mockPrismaService.standupInstance.findFirst.mockResolvedValue({
        ...mockInstance,
        team: { ...mockInstance.team, members: [] },
      });

      const result = await service.getStandupInfoForToken(mockTokenPayload);

      expect(result).toBeNull();
    });

    it('should use integration user name when member name is not available', async () => {
      const instanceWithoutMemberName = {
        ...mockInstance,
        team: {
          ...mockInstance.team,
          members: [
            {
              id: mockTeamMemberId,
              name: null,
              platformUserId: mockPlatformUserId,
              integrationUser: {
                name: 'john.doe',
              },
            },
          ],
        },
      };

      mockPrismaService.standupInstance.findFirst.mockResolvedValue(instanceWithoutMemberName);

      const result = await service.getStandupInfoForToken(mockTokenPayload);

      expect(result?.member.name).toBe('john.doe');
    });

    it('should use "Unknown" when no name is available', async () => {
      const instanceWithoutNames = {
        ...mockInstance,
        team: {
          ...mockInstance.team,
          members: [
            {
              id: mockTeamMemberId,
              name: null,
              platformUserId: mockPlatformUserId,
              integrationUser: null,
            },
          ],
        },
      };

      mockPrismaService.standupInstance.findFirst.mockResolvedValue(instanceWithoutNames);

      const result = await service.getStandupInfoForToken(mockTokenPayload);

      expect(result?.member.name).toBe('Unknown');
    });
  });

  describe('hasExistingResponses', () => {
    it('should return true when member has existing responses', async () => {
      mockPrismaService.answer.findFirst.mockResolvedValue({
        id: 'answer-123',
        text: 'Some response',
      });

      const result = await service.hasExistingResponses(mockInstanceId, mockTeamMemberId);

      expect(mockPrismaService.answer.findFirst).toHaveBeenCalledWith({
        where: {
          standupInstanceId: mockInstanceId,
          teamMemberId: mockTeamMemberId,
        },
      });

      expect(result).toBe(true);
    });

    it('should return false when member has no existing responses', async () => {
      mockPrismaService.answer.findFirst.mockResolvedValue(null);

      const result = await service.hasExistingResponses(mockInstanceId, mockTeamMemberId);

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle missing JWT secret gracefully', () => {
      const configServiceWithoutSecret = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'appUrl') return mockBaseUrl;
          return undefined; // No JWT secret
        }),
      };

      // This should not throw during service construction
      expect(() => {
        new MagicTokenService(
          mockJwtService,
          configServiceWithoutSecret as unknown as ConfigService,
          mockPrismaService as unknown as PrismaService,
          mockLogger,
        );
      }).not.toThrow();
    });

    it('should handle missing app URL gracefully', () => {
      const configServiceWithoutUrl = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'jwtSecret') return mockJwtSecret;
          return undefined; // No app URL
        }),
      };

      // This should not throw during service construction
      expect(() => {
        new MagicTokenService(
          mockJwtService,
          configServiceWithoutUrl as unknown as ConfigService,
          mockPrismaService as unknown as PrismaService,
          mockLogger,
        );
      }).not.toThrow();
    });
  });
});
