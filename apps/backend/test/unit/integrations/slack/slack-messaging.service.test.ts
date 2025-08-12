import { Test, TestingModule } from '@nestjs/testing';
import { SlackMessagingService } from '@/integrations/slack/slack-messaging.service';
import { SlackOauthService } from '@/integrations/slack/slack-oauth.service';
import { SlackMessageFormatterService } from '@/integrations/slack/slack-message-formatter.service';
import { LoggerService } from '@/common/logger.service';
import { PrismaService } from '@/prisma/prisma.service';
import { WebClient } from '@slack/web-api';

// Create mock WebClient instance
const mockWebClientInstance = {
  chat: {
    postMessage: jest.fn(),
    update: jest.fn(),
  },
  conversations: {
    open: jest.fn(),
  },
  views: {
    open: jest.fn(),
  },
  team: {
    info: jest.fn(),
  },
  users: {
    info: jest.fn(),
  },
};

// Mock WebClient constructor
jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => mockWebClientInstance),
}));

describe('SlackMessagingService', () => {
  let service: SlackMessagingService;
  let mockSlackOauth: jest.Mocked<SlackOauthService>;
  let mockFormatter: jest.Mocked<SlackMessageFormatterService>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockPrisma: {
    standupInstance: { findFirst: jest.Mock; update: jest.Mock };
  };
  let mockWebClient: jest.Mocked<WebClient>;

  const mockIntegrationId = 'test-integration-id';
  const mockChannelId = 'C1234567890';
  const mockUserId = 'U1234567890';
  const mockToken = 'xoxb-test-token';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackMessagingService,
        {
          provide: SlackOauthService,
          useValue: {
            getDecryptedToken: jest.fn(),
          },
        },
        {
          provide: SlackMessageFormatterService,
          useValue: {
            formatStandupReminder: jest.fn(),
            formatStandupSummary: jest.fn(),
            formatFollowupReminder: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            standupInstance: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
          } as { standupInstance: { findFirst: jest.Mock; update: jest.Mock } },
        },
      ],
    }).compile();

    service = module.get<SlackMessagingService>(SlackMessagingService);
    mockSlackOauth = module.get(SlackOauthService);
    mockFormatter = module.get(SlackMessageFormatterService);
    mockLogger = module.get(LoggerService);
    mockPrisma = module.get(PrismaService) as typeof mockPrisma;

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mocks
    mockSlackOauth.getDecryptedToken.mockResolvedValue(mockToken);
    mockWebClient = mockWebClientInstance as unknown as jest.Mocked<WebClient>;
  });

  describe('sendChannelMessage', () => {
    it('should send a channel message successfully', async () => {
      const mockResult = {
        ok: true,
        ts: '1234567890.123456',
        channel: mockChannelId,
      };

      mockWebClient.chat.postMessage = jest.fn().mockResolvedValue(mockResult);

      const result = await service.sendChannelMessage(
        mockIntegrationId,
        mockChannelId,
        'Test message',
      );

      expect(mockSlackOauth.getDecryptedToken).toHaveBeenCalledWith(mockIntegrationId, 'bot');
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: mockChannelId,
        text: 'Test message',
        blocks: undefined,
        unfurl_links: false,
        unfurl_media: false,
      });
      expect(result).toEqual({
        ok: true,
        ts: '1234567890.123456',
        channel: mockChannelId,
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Channel message sent successfully', {
        integrationId: mockIntegrationId,
        channelId: mockChannelId,
        messageTs: '1234567890.123456',
      });
    });

    it('should handle message sending failure', async () => {
      const error = new Error('Slack API error');
      mockWebClient.chat.postMessage = jest.fn().mockRejectedValue(error);

      const result = await service.sendChannelMessage(
        mockIntegrationId,
        mockChannelId,
        'Test message',
      );

      expect(result).toEqual({
        ok: false,
        error: 'Slack API error',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to send channel message', {
        integrationId: mockIntegrationId,
        channelId: mockChannelId,
        error: 'Slack API error',
      });
    });

    it('should send message with blocks', async () => {
      const mockBlocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'Test block' } }];
      const mockResult = { ok: true, ts: '1234567890.123456', channel: mockChannelId };

      mockWebClient.chat.postMessage = jest.fn().mockResolvedValue(mockResult);

      await service.sendChannelMessage(
        mockIntegrationId,
        mockChannelId,
        'Test message',
        mockBlocks,
      );

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: mockChannelId,
        text: 'Test message',
        blocks: mockBlocks,
        unfurl_links: false,
        unfurl_media: false,
      });
    });
  });

  describe('sendDirectMessage', () => {
    it('should send a direct message successfully', async () => {
      const mockDmResult = {
        ok: true,
        channel: { id: 'D1234567890' },
      };
      const mockMessageResult = {
        ok: true,
        ts: '1234567890.123456',
        channel: 'D1234567890',
      };

      mockWebClient.conversations.open = jest.fn().mockResolvedValue(mockDmResult);
      mockWebClient.chat.postMessage = jest.fn().mockResolvedValue(mockMessageResult);

      const result = await service.sendDirectMessage(mockIntegrationId, mockUserId, 'Test DM');

      expect(mockWebClient.conversations.open).toHaveBeenCalledWith({
        users: mockUserId,
      });
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'D1234567890',
        text: 'Test DM',
        blocks: undefined,
        unfurl_links: false,
        unfurl_media: false,
      });
      expect(result).toEqual({
        ok: true,
        ts: '1234567890.123456',
        channel: 'D1234567890',
      });
    });

    it('should handle DM channel opening failure', async () => {
      mockWebClient.conversations.open = jest.fn().mockResolvedValue({
        ok: false,
        channel: null,
      });

      const result = await service.sendDirectMessage(mockIntegrationId, mockUserId, 'Test DM');

      expect(result).toEqual({
        ok: false,
        error: 'Failed to open DM channel',
      });
    });
  });

  describe('updateMessage', () => {
    it('should update a message successfully', async () => {
      const mockResult = {
        ok: true,
        ts: '1234567890.123456',
        channel: mockChannelId,
      };

      mockWebClient.chat.update = jest.fn().mockResolvedValue(mockResult);

      const result = await service.updateMessage(
        mockIntegrationId,
        mockChannelId,
        '1234567890.123456',
        'Updated message',
      );

      expect(mockWebClient.chat.update).toHaveBeenCalledWith({
        channel: mockChannelId,
        ts: '1234567890.123456',
        text: 'Updated message',
        blocks: undefined,
      });
      expect(result).toEqual({
        ok: true,
        ts: '1234567890.123456',
        channel: mockChannelId,
      });
    });
  });

  describe('openModal', () => {
    it('should open a modal successfully', async () => {
      const mockModal = {
        type: 'modal' as const,
        callback_id: 'test_modal',
        title: { type: 'plain_text' as const, text: 'Test Modal' },
        blocks: [],
      };
      const mockResult = { ok: true };

      mockWebClient.views.open = jest.fn().mockResolvedValue(mockResult);

      const result = await service.openModal(mockIntegrationId, 'test-trigger-id', mockModal);

      expect(mockWebClient.views.open).toHaveBeenCalledWith({
        trigger_id: 'test-trigger-id',
        view: mockModal,
      });
      expect(result).toEqual({ ok: true, error: undefined });
    });
  });

  describe('getTeamInfo', () => {
    it('should get team info successfully', async () => {
      const mockResult = {
        ok: true,
        team: {
          id: 'T1234567890',
          name: 'Test Team',
        },
      };

      mockWebClient.team.info = jest.fn().mockResolvedValue(mockResult);

      const result = await service.getTeamInfo(mockIntegrationId);

      expect(result).toEqual({
        id: 'T1234567890',
        name: 'Test Team',
      });
    });

    it('should return null when team info request fails', async () => {
      mockWebClient.team.info = jest.fn().mockResolvedValue({ ok: false });

      const result = await service.getTeamInfo(mockIntegrationId);

      expect(result).toBeNull();
    });
  });

  describe('getUserInfo', () => {
    it('should get user info successfully', async () => {
      const mockResult = {
        ok: true,
        user: {
          id: mockUserId,
          name: 'testuser',
          real_name: 'Test User',
        },
      };

      mockWebClient.users.info = jest.fn().mockResolvedValue(mockResult);

      const result = await service.getUserInfo(mockIntegrationId, mockUserId);

      expect(mockWebClient.users.info).toHaveBeenCalledWith({ user: mockUserId });
      expect(result).toEqual({
        name: 'testuser',
        realName: 'Test User',
      });
    });

    it('should fallback to name when real_name is not available', async () => {
      const mockResult = {
        ok: true,
        user: {
          id: mockUserId,
          name: 'testuser',
          real_name: null,
        },
      };

      mockWebClient.users.info = jest.fn().mockResolvedValue(mockResult);

      const result = await service.getUserInfo(mockIntegrationId, mockUserId);

      expect(result).toEqual({
        name: 'testuser',
        realName: 'testuser',
      });
    });
  });

  describe('sendStandupReminder', () => {
    const mockInstance = {
      id: 'instance-123',
      team: {
        name: 'Test Team',
        channelId: mockChannelId,
        integrationId: mockIntegrationId,
        configs: [{ deliveryType: 'channel' }],
      },
      configSnapshot: {
        questions: ['Question 1', 'Question 2'],
        responseTimeoutHours: 2,
        participatingMembers: [{ id: 'member1', name: 'User 1', platformUserId: 'U123' }],
      },
    };

    it('should send standup reminder successfully', async () => {
      mockPrisma.standupInstance.findFirst.mockResolvedValue(
        mockInstance as {
          id: string;
          team: {
            name: string;
            channelId: string;
            integrationId: string;
            configs: Array<{ deliveryType: string }>;
          };
          configSnapshot: {
            questions: string[];
            responseTimeoutHours: number;
            participatingMembers: Array<{ id: string; name: string; platformUserId: string }>;
          };
        },
      );
      mockFormatter.formatStandupReminder.mockReturnValue({
        text: 'Standup reminder',
        blocks: [],
      });

      const mockMessageResult = {
        ok: true,
        ts: '1234567890.123456',
        channel: mockChannelId,
      };
      mockWebClient.chat.postMessage = jest.fn().mockResolvedValue(mockMessageResult);

      const result = await service.sendStandupReminder('instance-123');

      expect(mockPrisma.standupInstance.findFirst).toHaveBeenCalledWith({
        where: { id: 'instance-123' },
        include: {
          team: {
            select: {
              name: true,
              channelId: true,
              integrationId: true,
              configs: {
                where: { isActive: true },
                select: { deliveryType: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });
      expect(mockFormatter.formatStandupReminder).toHaveBeenCalled();
      expect(mockPrisma.standupInstance.update).toHaveBeenCalledWith({
        where: { id: 'instance-123' },
        data: { reminderMessageTs: '1234567890.123456' },
      });
      expect(result).toEqual(mockMessageResult);
    });

    it('should handle instance not found', async () => {
      mockPrisma.standupInstance.findFirst.mockResolvedValue(null);

      const result = await service.sendStandupReminder('invalid-instance');

      expect(result).toEqual({
        ok: false,
        error: 'Standup instance or team not found',
      });
    });
  });

  describe('sendIndividualReminder', () => {
    const mockInstance = {
      id: 'instance-123',
      team: {
        integrationId: mockIntegrationId,
        name: 'Test Team',
      },
    };

    it('should send individual reminder successfully', async () => {
      mockPrisma.standupInstance.findFirst.mockResolvedValue(
        mockInstance as {
          id: string;
          team: { name: string; channelId: string; integrationId: string };
          configSnapshot: {
            questions: string[];
            responseTimeoutHours: number;
            participatingMembers: Array<{ id: string; name: string; platformUserId: string }>;
          };
        },
      );

      mockWebClient.users.info = jest.fn().mockResolvedValue({
        ok: true,
        user: { name: 'testuser', real_name: 'Test User' },
      });

      const mockDmResult = {
        ok: true,
        channel: { id: 'D1234567890' },
      };
      const mockMessageResult = {
        ok: true,
        ts: '1234567890.123456',
        channel: 'D1234567890',
      };

      mockWebClient.conversations.open = jest.fn().mockResolvedValue(mockDmResult);
      mockWebClient.chat.postMessage = jest.fn().mockResolvedValue(mockMessageResult);

      const result = await service.sendIndividualReminder('instance-123', mockUserId);

      expect(result).toEqual(mockMessageResult);
    });
  });

  describe('postStandupSummary', () => {
    const mockInstance = {
      id: 'instance-123',
      targetDate: new Date('2024-01-15'),
      team: {
        name: 'Test Team',
        channelId: mockChannelId,
        integrationId: mockIntegrationId,
      },
      configSnapshot: {
        questions: ['Question 1', 'Question 2'],
        responseTimeoutHours: 2,
        participatingMembers: [{ id: 'member1', name: 'User 1', platformUserId: 'U123' }],
      },
      answers: [
        {
          teamMemberId: 'member1',
          questionIndex: 0,
          text: 'Answer 1',
          teamMember: { name: 'User 1' },
        },
      ],
    };

    it('should post standup summary successfully', async () => {
      mockPrisma.standupInstance.findFirst.mockResolvedValue(
        mockInstance as {
          id: string;
          team: { name: string; channelId: string; integrationId: string };
          configSnapshot: {
            questions: string[];
            responseTimeoutHours: number;
            participatingMembers: Array<{ id: string; name: string; platformUserId: string }>;
          };
        },
      );
      mockFormatter.formatStandupSummary.mockReturnValue({
        text: 'Summary',
        blocks: [],
      });

      const mockMessageResult = {
        ok: true,
        ts: '1234567890.123456',
        channel: mockChannelId,
      };
      mockWebClient.chat.postMessage = jest.fn().mockResolvedValue(mockMessageResult);

      const result = await service.postStandupSummary('instance-123');

      expect(mockFormatter.formatStandupSummary).toHaveBeenCalled();
      expect(mockPrisma.standupInstance.update).toHaveBeenCalledWith({
        where: { id: 'instance-123' },
        data: { summaryMessageTs: '1234567890.123456' },
      });
      expect(result).toEqual(mockMessageResult);
    });
  });

  describe('sendFollowupReminder', () => {
    const mockInstance = {
      id: 'instance-123',
      createdAt: new Date(),
      team: {
        name: 'Test Team',
        integrationId: mockIntegrationId,
        channelId: mockChannelId,
      },
      configSnapshot: {
        questions: ['Question 1'],
        responseTimeoutHours: 2,
        participatingMembers: [{ id: 'member1', name: 'User 1', platformUserId: 'U123' }],
      },
    };

    it('should send followup reminders successfully', async () => {
      mockPrisma.standupInstance.findFirst.mockResolvedValue(
        mockInstance as {
          id: string;
          team: { name: string; channelId: string; integrationId: string };
          configSnapshot: {
            questions: string[];
            responseTimeoutHours: number;
            participatingMembers: Array<{ id: string; name: string; platformUserId: string }>;
          };
        },
      );
      mockFormatter.formatFollowupReminder.mockReturnValue({
        text: 'Followup reminder',
        blocks: [],
      });

      const mockChannelResult = { ok: true, ts: '1234567890.123456' };
      const mockDmResult = { ok: true, ts: '1234567890.123457' };

      mockWebClient.chat.postMessage = jest
        .fn()
        .mockResolvedValueOnce(mockChannelResult)
        .mockResolvedValueOnce(mockDmResult);

      mockWebClient.conversations.open = jest.fn().mockResolvedValue({
        ok: true,
        channel: { id: 'D1234567890' },
      });

      const result = await service.sendFollowupReminder('instance-123', ['U123']);

      expect(result).toHaveLength(2); // Channel message + DM
      expect(result[0]).toEqual(mockChannelResult);
      expect(result[1]).toEqual(mockDmResult);
    });
  });

  describe('error handling', () => {
    it('should handle unknown error types', async () => {
      const unknownError = 'string error';
      mockWebClient.chat.postMessage = jest.fn().mockRejectedValue(unknownError);

      const result = await service.sendChannelMessage(
        mockIntegrationId,
        mockChannelId,
        'Test message',
      );

      expect(result).toEqual({
        ok: false,
        error: 'string error',
      });
    });

    it('should handle Error objects', async () => {
      const error = new Error('Test error');
      mockWebClient.chat.postMessage = jest.fn().mockRejectedValue(error);

      const result = await service.sendChannelMessage(
        mockIntegrationId,
        mockChannelId,
        'Test message',
      );

      expect(result).toEqual({
        ok: false,
        error: 'Test error',
      });
    });
  });
});
