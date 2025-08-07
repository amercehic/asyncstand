import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SlackOauthService } from '@/integrations/slack/slack-oauth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { RedisService } from '@/common/redis.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { Integration } from '@prisma/client';
import { IntegrationFactory } from '@/test/utils/factories';
import { createMockPrismaService, MockPrismaService } from '@/test/utils/mocks/prisma.mock';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('SlackOauthService', () => {
  let service: SlackOauthService;
  let mockPrisma: MockPrismaService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockAuditLogService: jest.Mocked<AuditLogService>;

  const mockOrgId = 'org-123';
  const mockState = 'state-456';
  const mockCode = 'auth-code-789';
  const mockIpAddress = '192.168.1.1';

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const mockConfigServiceMethods = {
      get: jest.fn(),
    };

    const mockLoggerServiceMethods = {
      setContext: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const mockRedisServiceMethods = {
      validateStateToken: jest.fn(),
    };

    const mockAuditLogServiceMethods = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackOauthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: mockConfigServiceMethods,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerServiceMethods,
        },
        {
          provide: RedisService,
          useValue: mockRedisServiceMethods,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogServiceMethods,
        },
      ],
    }).compile();

    service = module.get<SlackOauthService>(SlackOauthService);
    mockConfigService = module.get(ConfigService);
    mockRedisService = module.get(RedisService);
    mockAuditLogService = module.get(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('exchangeCode', () => {
    const mockOauthResponse = {
      ...IntegrationFactory.createMockSlackOAuthResponse({
        team: { id: 'T1234567890', name: 'Test Team' },
        authed_user: {
          id: 'U1234567890',
          access_token: 'xoxp-user-token',
          token_type: 'user',
          scope: 'identify',
        },
        access_token: 'xoxb-bot-token',
        bot_user_id: 'B1234567890',
        app_id: 'A1234567890',
        scope: 'channels:read,users:read,chat:write',
      }),
      refresh_token: 'xoxe-refresh-token',
    };

    const mockOrganization = {
      id: mockOrgId,
      name: 'Test Organization',
    };

    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'slackOauthEnabled':
            return true;
          case 'slackClientId':
            return 'test-client-id';
          case 'slackClientSecret':
            return 'test-client-secret';
          case 'databaseEncryptKey':
            return 'test-encrypt-key-32-characters!!';
          default:
            return undefined;
        }
      });

      mockRedisService.validateStateToken.mockResolvedValue(mockOrgId);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);

      const createdIntegration = {
        id: 'integration-123',
        orgId: mockOrgId,
        platform: 'slack',
        externalTeamId: mockOauthResponse.team.id,
        ...mockOauthResponse,
      } as unknown as Integration;

      mockPrisma.integration.findUnique
        .mockResolvedValueOnce(null) // No existing integration
        .mockResolvedValueOnce(createdIntegration); // Return created integration for audit logging
      mockPrisma.integration.create.mockResolvedValue(createdIntegration);
      mockPrisma.$queryRaw.mockResolvedValue([
        { encrypted: Buffer.from('encrypted-refresh-token') },
      ]);
      mockPrisma.$executeRaw.mockResolvedValue([{ id: createdIntegration.id }]);
      mockAuditLogService.log.mockResolvedValue(undefined);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOauthResponse),
      });
    });

    it('should successfully exchange code for tokens', async () => {
      const result = await service.exchangeCode(mockCode, mockState, mockIpAddress);

      expect(result).toEqual({ success: true });
      expect(mockRedisService.validateStateToken).toHaveBeenCalledWith(mockState);
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: mockOrgId },
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('oauth.v2.access'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.any(URLSearchParams),
        }),
      );
      // Verify encrypted storage is used instead of plaintext
      expect(mockPrisma.$executeRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('INSERT INTO "Integration"')]),
        expect.any(String), // orgId
        expect.any(String), // platform
        expect.any(String), // externalTeamId
        expect.any(String), // accessToken
        expect.any(String), // encryption key
        expect.any(String), // botToken
        expect.any(String), // encryption key
        expect.any(String), // botUserId
        expect.any(String), // appId
        expect.any(Object), // refreshToken buffer
        null, // expiresAt
        expect.any(String), // tokenStatus
        expect.any(Array), // scopes
        expect.any(Array), // userScopes
      );
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'integration.slack.installed',
          orgId: mockOrgId,
        }),
      );
    });

    it('should throw error when Slack OAuth is disabled', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'slackOauthEnabled') return false;
        return 'test-value';
      });

      await expect(service.exchangeCode(mockCode, mockState, mockIpAddress)).rejects.toThrow(
        new ApiError(ErrorCode.FORBIDDEN, 'Slack OAuth is not enabled', 403),
      );

      expect(mockRedisService.validateStateToken).not.toHaveBeenCalled();
    });

    it('should throw error when state validation fails', async () => {
      mockRedisService.validateStateToken.mockResolvedValue(null);

      await expect(service.exchangeCode(mockCode, mockState, mockIpAddress)).rejects.toThrow(
        new ApiError(ErrorCode.VALIDATION_FAILED, 'Invalid or expired authorization request', 400),
      );

      expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
    });

    it('should throw error when organization not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.exchangeCode(mockCode, mockState, mockIpAddress)).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Organization not found', 404),
      );

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw error when integration already exists', async () => {
      const existingIntegration = IntegrationFactory.createMockIntegration({
        externalTeamId: mockOauthResponse.team.id,
      });
      mockPrisma.integration.findUnique
        .mockReset()
        .mockResolvedValue(existingIntegration as Integration);

      await expect(service.exchangeCode(mockCode, mockState, mockIpAddress)).rejects.toThrow(
        new ApiError(
          ErrorCode.CONFLICT,
          'This Slack workspace is already connected to your organization',
          409,
        ),
      );

      expect(mockPrisma.integration.create).not.toHaveBeenCalled();
    });

    it('should throw error when Slack OAuth credentials are missing', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'slackClientId') return null;
        if (key === 'slackClientSecret') return null;
        return 'test-value';
      });

      await expect(service.exchangeCode(mockCode, mockState, mockIpAddress)).rejects.toThrow(
        new ApiError(ErrorCode.CONFIGURATION_ERROR, 'Slack OAuth credentials not configured', 500),
      );

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw error when Slack API returns error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(service.exchangeCode(mockCode, mockState, mockIpAddress)).rejects.toThrow(
        new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Failed to exchange code with Slack', 502),
      );

      expect(mockPrisma.integration.create).not.toHaveBeenCalled();
    });

    it('should throw error when Slack OAuth response indicates failure', async () => {
      const errorResponse = IntegrationFactory.createMockSlackErrorResponse('invalid_code');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(errorResponse),
      });

      await expect(service.exchangeCode(mockCode, mockState, mockIpAddress)).rejects.toThrow(
        new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Slack OAuth error: invalid_code', 400),
      );

      expect(mockPrisma.integration.create).not.toHaveBeenCalled();
    });

    it('should handle expiration time when provided', async () => {
      const expiresIn = 3600; // 1 hour
      const mockOauthResponseWithExpiry = {
        ...mockOauthResponse,
        expires_in: expiresIn,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOauthResponseWithExpiry),
      });

      await service.exchangeCode(mockCode, mockState, mockIpAddress);

      // Verify that the integration was created with encrypted storage
      expect(mockPrisma.$executeRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('INSERT INTO "Integration"')]),
        expect.any(String), // orgId
        expect.any(String), // platform
        expect.any(String), // externalTeamId
        expect.any(String), // accessToken
        expect.any(String), // encryption key
        expect.any(String), // botToken
        expect.any(String), // encryption key
        expect.any(String), // botUserId
        expect.any(String), // appId
        expect.any(Object), // refreshToken buffer
        expect.any(Date), // expiresAt
        expect.any(String), // tokenStatus
        expect.any(Array), // scopes
        expect.any(Array), // userScopes
      );
    });

    it('should log audit event on failure', async () => {
      const error = new Error('Test error');
      mockPrisma.$executeRaw.mockRejectedValue(error);

      await expect(service.exchangeCode(mockCode, mockState, mockIpAddress)).rejects.toThrow(error);

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'integration.slack.install_failed',
          orgId: mockOrgId,
        }),
      );
    });
  });

  describe('getDecryptedToken', () => {
    const mockIntegrationId = 'integration-123';

    it('should throw error when no encryption key is configured', async () => {
      mockConfigService.get.mockReturnValue(null); // No encryption key

      await expect(service.getDecryptedToken(mockIntegrationId, 'access')).rejects.toThrow(
        'DATABASE_ENCRYPT_KEY is required for token decryption',
      );
    });

    it('should return null when integration not found', async () => {
      mockConfigService.get.mockReturnValue('test-encrypt-key-32-characters!!');

      // In test environment, mock findUnique returning null (integration not found)
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      const result = await service.getDecryptedToken(mockIntegrationId, 'access');

      expect(result).toBeNull();
    });

    it('should decrypt token when encryption key is available', async () => {
      mockConfigService.get.mockReturnValue('test-encrypt-key-32-characters!!');

      // In test environment, mock the findUnique call for plain token retrieval
      mockPrisma.integration.findUnique.mockResolvedValue({
        botToken: 'decrypted-token',
      } as Partial<Integration>);

      const result = await service.getDecryptedToken(mockIntegrationId, 'bot');

      expect(result).toBe('decrypted-token');
      expect(mockPrisma.integration.findUnique).toHaveBeenCalledWith({
        where: { id: mockIntegrationId },
        select: {
          accessToken: false,
          botToken: true,
          refreshToken: false,
        },
      });
    });

    it('should return null when decryption returns null', async () => {
      mockConfigService.get.mockReturnValue('test-encrypt-key-32-characters!!');

      // In test environment, mock the findUnique call returning null token
      mockPrisma.integration.findUnique.mockResolvedValue({
        refreshToken: null,
      } as Partial<Integration>);

      const result = await service.getDecryptedToken(mockIntegrationId, 'refresh');

      expect(result).toBeNull();
    });

    it('should handle different token types with encryption', async () => {
      mockConfigService.get.mockReturnValue('test-encrypt-key-32-characters!!');

      // In test environment, mock the findUnique call for access token
      mockPrisma.integration.findUnique.mockResolvedValue({
        accessToken: 'decrypted-access-token',
      } as Partial<Integration>);

      await service.getDecryptedToken(mockIntegrationId, 'access');

      expect(mockPrisma.integration.findUnique).toHaveBeenCalledWith({
        where: { id: mockIntegrationId },
        select: {
          accessToken: true,
          botToken: false,
          refreshToken: false,
        },
      });
    });
  });
});
