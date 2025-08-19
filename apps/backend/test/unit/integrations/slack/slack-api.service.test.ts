import { Test, TestingModule } from '@nestjs/testing';
import { SlackApiService } from '@/integrations/slack/slack-api.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { SlackOauthService } from '@/integrations/slack/slack-oauth.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { IntegrationFactory } from '@/test/utils/factories';
import { createMockPrismaService, MockPrismaService } from '@/test/utils/mocks/prisma.mock';
import { Integration, IntegrationSyncState, IntegrationUser, Channel } from '@prisma/client';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('SlackApiService', () => {
  let service: SlackApiService;
  let mockPrisma: MockPrismaService;
  let mockSlackOauthService: jest.Mocked<SlackOauthService>;
  let mockAuditLogService: jest.Mocked<AuditLogService>;

  const mockIntegrationId = 'integration-123';
  const mockOrgId = 'org-123';
  const mockBotToken = 'xoxb-bot-token';

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const mockLoggerServiceMethods = {
      setContext: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const mockSlackOauthServiceMethods = {
      getDecryptedToken: jest.fn(),
    };

    const mockAuditLogServiceMethods = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackApiService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerServiceMethods,
        },
        {
          provide: SlackOauthService,
          useValue: mockSlackOauthServiceMethods,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogServiceMethods,
        },
      ],
    }).compile();

    service = module.get<SlackApiService>(SlackApiService);
    mockSlackOauthService = module.get(SlackOauthService);
    mockAuditLogService = module.get(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('syncWorkspaceData', () => {
    const mockIntegration = IntegrationFactory.createMockIntegration({
      id: mockIntegrationId,
      orgId: mockOrgId,
      platform: 'slack',
      org: { id: mockOrgId, name: 'Test Org' },
    });

    beforeEach(() => {
      mockPrisma.integration.findUnique.mockResolvedValue(mockIntegration as Integration);
      mockPrisma.integrationSyncState.upsert.mockResolvedValue({} as IntegrationSyncState);
      mockAuditLogService.log.mockResolvedValue(undefined);
    });

    it('should successfully sync workspace data', async () => {
      const mockUsersResponse = IntegrationFactory.createMockSlackUsersListResponse({
        members: [
          {
            id: 'U1234567890',
            name: 'testuser',
            profile: {
              real_name: 'Test User',
              display_name: 'testuser',
              email: 'test@example.com',
              image_192: 'https://example.com/avatar.jpg',
            },
            deleted: false,
            is_bot: false,
            is_app_user: false,
            tz: 'America/New_York',
          },
        ],
        response_metadata: { next_cursor: '' },
      });

      const mockChannelsResponse = IntegrationFactory.createMockSlackChannelsListResponse({
        channels: [
          {
            id: 'C1234567890',
            name: 'general',
            is_channel: true,
            is_archived: false,
            is_private: false,
            topic: { value: 'General discussion' },
            purpose: { value: 'Company-wide announcements' },
            num_members: 10,
          },
        ],
        response_metadata: { next_cursor: '' },
      });

      mockSlackOauthService.getDecryptedToken.mockResolvedValue(mockBotToken);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUsersResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChannelsResponse),
        });

      mockPrisma.integrationUser.findUnique.mockResolvedValue(null); // New user
      mockPrisma.integrationUser.create.mockResolvedValue({} as IntegrationUser);
      mockPrisma.channel.findUnique.mockResolvedValue(null); // New channel
      mockPrisma.channel.create.mockResolvedValue({ id: 'channel-db-id' } as Channel);
      mockPrisma.team.findMany.mockResolvedValue([]);

      const result = await service.syncWorkspaceData(mockIntegrationId);

      expect(result).toEqual({
        usersAdded: 1,
        usersUpdated: 0,
        channelsAdded: 1,
        channelsUpdated: 0,
        errors: [],
      });

      expect(mockPrisma.integrationUser.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          integrationId: mockIntegrationId,
          externalUserId: 'U1234567890',
          name: 'Test User',
          displayName: 'testuser',
          email: 'test@example.com',
        }),
      });

      expect(mockPrisma.channel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          integrationId: mockIntegrationId,
          channelId: 'C1234567890',
          name: 'general',
          topic: 'General discussion',
          purpose: 'Company-wide announcements',
        }),
      });

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'integration.slack.sync_completed',
          orgId: mockOrgId,
        }),
      );
    });

    it('should throw error when integration not found', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(service.syncWorkspaceData(mockIntegrationId)).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Integration not found', 404),
      );
    });

    it('should throw error when integration is not Slack', async () => {
      const nonSlackIntegration = {
        ...mockIntegration,
        platform: 'discord',
      };
      mockPrisma.integration.findUnique.mockResolvedValue(nonSlackIntegration as Integration);

      await expect(service.syncWorkspaceData(mockIntegrationId)).rejects.toThrow(
        new ApiError(ErrorCode.VALIDATION_FAILED, 'Integration is not a Slack integration', 400),
      );
    });

    it('should handle sync errors and log audit event', async () => {
      const error = new Error('API timeout');
      mockSlackOauthService.getDecryptedToken.mockRejectedValue(error);

      const result = await service.syncWorkspaceData(mockIntegrationId);

      expect(result).toEqual({
        usersAdded: 0,
        usersUpdated: 0,
        channelsAdded: 0,
        channelsUpdated: 0,
        errors: ['Failed to fetch users: API timeout', 'Failed to fetch channels: API timeout'],
      });

      expect(mockPrisma.integrationSyncState.upsert).toHaveBeenCalledWith({
        where: { integrationId: mockIntegrationId },
        create: {
          integrationId: mockIntegrationId,
          lastUsersSyncAt: expect.any(Date),
          lastChannelsSyncAt: expect.any(Date),
          errorMsg: 'Failed to fetch users: API timeout; Failed to fetch channels: API timeout',
        },
        update: {
          lastUsersSyncAt: expect.any(Date),
          lastChannelsSyncAt: expect.any(Date),
          errorMsg: 'Failed to fetch users: API timeout; Failed to fetch channels: API timeout',
        },
      });

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'integration.slack.sync_completed',
          orgId: mockOrgId,
        }),
      );
    });

    it('should update existing users instead of creating new ones', async () => {
      const mockUsersResponse = IntegrationFactory.createMockSlackUsersListResponse({
        members: [
          {
            id: 'U1234567890',
            name: 'testuser',
            profile: {
              real_name: 'Updated Test User',
              display_name: 'updated_testuser',
              email: 'updated@example.com',
              image_192: 'https://example.com/new-avatar.jpg',
            },
            deleted: false,
            is_bot: false,
            is_app_user: false,
            tz: 'America/Los_Angeles',
          },
        ],
        response_metadata: { next_cursor: '' },
      });

      mockSlackOauthService.getDecryptedToken.mockResolvedValue(mockBotToken);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUsersResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, channels: [], response_metadata: {} }),
        });

      const existingUser = { id: 'existing-user-id' };
      mockPrisma.integrationUser.findUnique.mockResolvedValue(existingUser as IntegrationUser);
      mockPrisma.integrationUser.update.mockResolvedValue({} as IntegrationUser);
      mockPrisma.teamMember.updateMany.mockResolvedValue({ count: 2 } as { count: number });

      const result = await service.syncWorkspaceData(mockIntegrationId);

      expect(result.usersUpdated).toBe(1);
      expect(result.usersAdded).toBe(0);

      expect(mockPrisma.integrationUser.update).toHaveBeenCalledWith({
        where: { id: 'existing-user-id' },
        data: expect.objectContaining({
          name: 'Updated Test User',
          displayName: 'updated_testuser',
          email: 'updated@example.com',
        }),
      });

      expect(mockPrisma.teamMember.updateMany).toHaveBeenCalledWith({
        where: {
          platformUserId: 'U1234567890',
          team: { integrationId: mockIntegrationId },
        },
        data: { name: 'Updated Test User' },
      });
    });

    it('should skip deleted, bot, and app users', async () => {
      const mockUsersResponse = IntegrationFactory.createMockSlackUsersListResponse({
        members: [
          {
            id: 'U1111111111',
            name: 'deleteduser',
            profile: { real_name: 'Deleted User' },
            deleted: true,
            is_bot: false,
            is_app_user: false,
          },
          {
            id: 'U2222222222',
            name: 'botuser',
            profile: { real_name: 'Bot User' },
            deleted: false,
            is_bot: true,
            is_app_user: false,
          },
          {
            id: 'U3333333333',
            name: 'appuser',
            profile: { real_name: 'App User' },
            deleted: false,
            is_bot: false,
            is_app_user: true,
          },
        ],
        response_metadata: { next_cursor: '' },
      });

      mockSlackOauthService.getDecryptedToken.mockResolvedValue(mockBotToken);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUsersResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, channels: [], response_metadata: {} }),
        });

      const result = await service.syncWorkspaceData(mockIntegrationId);

      expect(result.usersAdded).toBe(0);
      expect(result.usersUpdated).toBe(0);
      expect(mockPrisma.integrationUser.create).not.toHaveBeenCalled();
      expect(mockPrisma.integrationUser.update).not.toHaveBeenCalled();
    });

    it('should handle pagination for users and channels', async () => {
      const mockUsersResponsePage1 = IntegrationFactory.createMockSlackUsersListResponse({
        members: [
          {
            id: 'U1111111111',
            name: 'user1',
            profile: { real_name: 'User 1' },
            deleted: false,
            is_bot: false,
            is_app_user: false,
          },
        ],
        response_metadata: { next_cursor: 'cursor1' },
      });

      const mockUsersResponsePage2 = IntegrationFactory.createMockSlackUsersListResponse({
        members: [
          {
            id: 'U2222222222',
            name: 'user2',
            profile: { real_name: 'User 2' },
            deleted: false,
            is_bot: false,
            is_app_user: false,
          },
        ],
        response_metadata: { next_cursor: '' },
      });

      mockSlackOauthService.getDecryptedToken.mockResolvedValue(mockBotToken);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUsersResponsePage1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUsersResponsePage2),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, channels: [], response_metadata: {} }),
        });

      mockPrisma.integrationUser.findUnique.mockResolvedValue(null);
      mockPrisma.integrationUser.create.mockResolvedValue({} as IntegrationUser);

      const result = await service.syncWorkspaceData(mockIntegrationId);

      expect(result.usersAdded).toBe(2);
      expect(global.fetch).toHaveBeenCalledTimes(3); // 2 user pages + 1 channels page
    });
  });

  describe('callSlackApi error handling', () => {
    beforeEach(() => {
      const mockIntegration = IntegrationFactory.createMockIntegration({
        id: mockIntegrationId,
        orgId: mockOrgId,
      });
      mockPrisma.integration.findUnique.mockResolvedValue(mockIntegration as Integration);
      mockPrisma.integrationSyncState.upsert.mockResolvedValue({} as IntegrationSyncState);
    });

    it('should handle error when bot token not found', async () => {
      mockSlackOauthService.getDecryptedToken.mockResolvedValue(null);

      const result = await service.syncWorkspaceData(mockIntegrationId);

      expect(result).toEqual({
        usersAdded: 0,
        usersUpdated: 0,
        channelsAdded: 0,
        channelsUpdated: 0,
        errors: [
          'Failed to fetch users: Bot token not found or could not be decrypted',
          'Failed to fetch channels: Bot token not found or could not be decrypted',
        ],
      });
    });

    it('should handle HTTP error responses', async () => {
      mockSlackOauthService.getDecryptedToken.mockResolvedValue(mockBotToken);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await service.syncWorkspaceData(mockIntegrationId);

      expect(result).toEqual({
        usersAdded: 0,
        usersUpdated: 0,
        channelsAdded: 0,
        channelsUpdated: 0,
        errors: [
          'Failed to fetch users: Slack API error: 500 Internal Server Error',
          'Failed to fetch channels: Slack API error: 500 Internal Server Error',
        ],
      });
    });

    it('should handle rate limit errors from HTTP status', async () => {
      mockSlackOauthService.getDecryptedToken.mockResolvedValue(mockBotToken);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const result = await service.syncWorkspaceData(mockIntegrationId);

      expect(result).toEqual({
        usersAdded: 0,
        usersUpdated: 0,
        channelsAdded: 0,
        channelsUpdated: 0,
        errors: [
          'Failed to fetch users: Slack API rate limit exceeded',
          'Failed to fetch channels: Slack API rate limit exceeded',
        ],
      });
    });

    it('should handle invalid auth errors and update token status', async () => {
      mockSlackOauthService.getDecryptedToken.mockResolvedValue(mockBotToken);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: 'invalid_auth' }),
      });

      mockPrisma.integration.update.mockResolvedValue({} as Integration);

      const result = await service.syncWorkspaceData(mockIntegrationId);

      expect(result).toEqual({
        usersAdded: 0,
        usersUpdated: 0,
        channelsAdded: 0,
        channelsUpdated: 0,
        errors: [
          'Failed to fetch users: Slack token is invalid or revoked',
          'Failed to fetch channels: Slack token is invalid or revoked',
        ],
      });

      expect(mockPrisma.integration.update).toHaveBeenCalledWith({
        where: { id: mockIntegrationId },
        data: { tokenStatus: 'revoked' },
      });
    });

    it('should handle token revoked errors and update token status', async () => {
      mockSlackOauthService.getDecryptedToken.mockResolvedValue(mockBotToken);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: 'token_revoked' }),
      });

      mockPrisma.integration.update.mockResolvedValue({} as Integration);

      const result = await service.syncWorkspaceData(mockIntegrationId);

      expect(result).toEqual({
        usersAdded: 0,
        usersUpdated: 0,
        channelsAdded: 0,
        channelsUpdated: 0,
        errors: [
          'Failed to fetch users: Slack token is invalid or revoked',
          'Failed to fetch channels: Slack token is invalid or revoked',
        ],
      });

      expect(mockPrisma.integration.update).toHaveBeenCalledWith({
        where: { id: mockIntegrationId },
        data: { tokenStatus: 'revoked' },
      });
    });

    it('should handle rate limit errors from API response', async () => {
      mockSlackOauthService.getDecryptedToken.mockResolvedValue(mockBotToken);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: 'ratelimited' }),
      });

      const result = await service.syncWorkspaceData(mockIntegrationId);

      expect(result).toEqual({
        usersAdded: 0,
        usersUpdated: 0,
        channelsAdded: 0,
        channelsUpdated: 0,
        errors: [
          'Failed to fetch users: Slack API rate limit exceeded',
          'Failed to fetch channels: Slack API rate limit exceeded',
        ],
      });
    });

    it('should handle generic API errors', async () => {
      mockSlackOauthService.getDecryptedToken.mockResolvedValue(mockBotToken);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: 'some_other_error' }),
      });

      const result = await service.syncWorkspaceData(mockIntegrationId);

      expect(result).toEqual({
        usersAdded: 0,
        usersUpdated: 0,
        channelsAdded: 0,
        channelsUpdated: 0,
        errors: [
          'Failed to fetch users: Slack API error: some_other_error',
          'Failed to fetch channels: Slack API error: some_other_error',
        ],
      });
    });
  });

  describe('joinChannel', () => {
    beforeEach(() => {
      mockSlackOauthService.getDecryptedToken.mockResolvedValue(mockBotToken);
    });

    it('should successfully join a channel', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const result = await service.joinChannel(mockIntegrationId, 'C1234567890');

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith('https://slack.com/api/conversations.join', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockBotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel: 'C1234567890' }),
      });
    });

    it('should handle bot already in channel', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: 'already_in_channel' }),
      });

      const result = await service.joinChannel(mockIntegrationId, 'C1234567890');

      expect(result).toEqual({ success: true });
    });

    it('should handle private channel error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: 'channel_not_found' }),
      });

      const result = await service.joinChannel(mockIntegrationId, 'C1234567890');

      expect(result).toEqual({
        success: false,
        error:
          'Private channels require manual bot invitation. Please use /invite @AsyncStand in the channel.',
      });
    });

    it('should handle is_private error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: 'is_private' }),
      });

      const result = await service.joinChannel(mockIntegrationId, 'C1234567890');

      expect(result).toEqual({
        success: false,
        error:
          'Private channels require manual bot invitation. Please use /invite @AsyncStand in the channel.',
      });
    });

    it('should handle generic API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: 'invalid_channel' }),
      });

      const result = await service.joinChannel(mockIntegrationId, 'C1234567890');

      expect(result).toEqual({
        success: false,
        error: 'Slack API error: invalid_channel',
      });
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await service.joinChannel(mockIntegrationId, 'C1234567890');

      expect(result).toEqual({
        success: false,
        error: 'Slack API error: 500 Internal Server Error',
      });
    });

    it('should handle missing bot token', async () => {
      mockSlackOauthService.getDecryptedToken.mockResolvedValue(null);

      const result = await service.joinChannel(mockIntegrationId, 'C1234567890');

      expect(result).toEqual({
        success: false,
        error: 'Bot token not found or could not be decrypted',
      });
    });
  });
});
