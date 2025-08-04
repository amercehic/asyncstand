import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SlackOauthService } from '@/integrations/slack/slack-oauth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { RedisService } from '@/common/redis.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { IntegrationPlatform, TokenStatus, Integration } from '@prisma/client';
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
            return null; // Test without encryption first
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
      expect(mockPrisma.integration.create).toHaveBeenCalledWith({
        data: {
          orgId: mockOrgId,
          platform: IntegrationPlatform.slack,
          externalTeamId: mockOauthResponse.team.id,
          accessToken: mockOauthResponse.authed_user.access_token,
          botToken: mockOauthResponse.access_token,
          botUserId: mockOauthResponse.bot_user_id,
          appId: mockOauthResponse.app_id,
          refreshToken: mockOauthResponse.refresh_token,
          expiresAt: null,
          tokenStatus: TokenStatus.ok,
          scopes: ['channels:read', 'users:read', 'chat:write'],
          userScopes: ['identify'],
        },
      });
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

      // Verify that the integration was created with an expiration time
      expect(mockPrisma.integration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should log audit event on failure', async () => {
      const error = new Error('Test error');
      mockPrisma.integration.create.mockRejectedValue(error);

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

    it('should return plaintext token when no encryption key is set', async () => {
      mockConfigService.get.mockReturnValue(null); // No encryption key
      const mockIntegration = {
        accessToken: 'plain-access-token',
        botToken: 'plain-bot-token',
        refreshToken: 'plain-refresh-token',
      };
      mockPrisma.integration.findUnique.mockResolvedValue(mockIntegration as Integration);

      const accessToken = await service.getDecryptedToken(mockIntegrationId, 'access');
      const botToken = await service.getDecryptedToken(mockIntegrationId, 'bot');
      const refreshToken = await service.getDecryptedToken(mockIntegrationId, 'refresh');

      expect(accessToken).toBe('plain-access-token');
      expect(botToken).toBe('plain-bot-token');
      expect(refreshToken).toBe('plain-refresh-token');
    });

    it('should return null when integration not found', async () => {
      mockConfigService.get.mockReturnValue(null); // No encryption key
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      const result = await service.getDecryptedToken(mockIntegrationId, 'access');

      expect(result).toBeNull();
    });

    it('should decrypt token when encryption key is available', async () => {
      mockConfigService.get.mockReturnValue('test-encrypt-key');
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ decrypted: 'decrypted-token' }]);

      const result = await service.getDecryptedToken(mockIntegrationId, 'bot');

      expect(result).toBe('decrypted-token');
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('pgp_sym_decrypt("botToken"'),
        'test-encrypt-key',
      );
    });

    it('should return null when decryption returns null', async () => {
      mockConfigService.get.mockReturnValue('test-encrypt-key');
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ decrypted: null }]);

      const result = await service.getDecryptedToken(mockIntegrationId, 'refresh');

      expect(result).toBeNull();
    });

    it('should handle different token types with encryption', async () => {
      mockConfigService.get.mockReturnValue('test-encrypt-key');
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ decrypted: 'decrypted-access-token' }]);

      await service.getDecryptedToken(mockIntegrationId, 'access');

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('pgp_sym_decrypt("accessToken"'),
        'test-encrypt-key',
      );
    });
  });
});
