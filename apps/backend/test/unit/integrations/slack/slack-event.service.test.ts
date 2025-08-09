import { Test, TestingModule } from '@nestjs/testing';
import { SlackEventService } from '@/integrations/slack/slack-event.service';
import { SlackMessagingService } from '@/integrations/slack/slack-messaging.service';
import { SlackMessageFormatterService } from '@/integrations/slack/slack-message-formatter.service';
import { LoggerService } from '@/common/logger.service';
import { PrismaService } from '@/prisma/prisma.service';
import { createHmac } from 'crypto';

describe('SlackEventService', () => {
  let service: SlackEventService;
  let mockSlackMessaging: jest.Mocked<SlackMessagingService>;
  let mockFormatter: jest.Mocked<SlackMessageFormatterService>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockPrisma: {
    integration: { findFirst: jest.Mock };
    teamMember: { findFirst: jest.Mock };
    standupInstance: { findFirst: jest.Mock };
    answer: { findFirst: jest.Mock; upsert: jest.Mock };
  };

  const mockSigningSecret = 'test-signing-secret';
  const mockIntegrationId = 'integration-123';
  const mockTeamId = 'T1234567890';
  const mockUserId = 'U1234567890';
  const mockTriggerId = 'trigger-123';
  const mockInstanceId = 'instance-123';

  beforeEach(async () => {
    // Set environment variable for signing secret
    process.env.SLACK_SIGNING_SECRET = mockSigningSecret;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackEventService,
        {
          provide: SlackMessagingService,
          useValue: {
            sendDirectMessage: jest.fn(),
            openModal: jest.fn(),
          },
        },
        {
          provide: SlackMessageFormatterService,
          useValue: {
            createResponseModal: jest.fn(),
            formatUserStatusResponse: jest.fn(),
            formatHelpMessage: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            integration: {
              findFirst: jest.fn(),
            },
            teamMember: {
              findFirst: jest.fn(),
            },
            standupInstance: {
              findFirst: jest.fn(),
            },
            answer: {
              findFirst: jest.fn(),
              upsert: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SlackEventService>(SlackEventService);
    mockSlackMessaging = module.get(SlackMessagingService);
    mockFormatter = module.get(SlackMessageFormatterService);
    mockLogger = module.get(LoggerService);
    mockPrisma = module.get(PrismaService) as typeof mockPrisma;

    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.SLACK_SIGNING_SECRET;
  });

  describe('verifySlackRequest', () => {
    const mockTimestamp = Math.floor(Date.now() / 1000);
    const mockBody = JSON.stringify({ type: 'event_callback' });

    it('should verify valid Slack request signature', async () => {
      const sigBaseString = `v0:${mockTimestamp}:${mockBody}`;
      const expectedSignature =
        'v0=' + createHmac('sha256', mockSigningSecret).update(sigBaseString).digest('hex');

      const headers = {
        'x-slack-signature': expectedSignature,
        'x-slack-request-timestamp': mockTimestamp.toString(),
      };

      const result = await service.verifySlackRequest(headers, mockBody);

      expect(result).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const headers = {
        'x-slack-signature': 'v0=invalid-signature',
        'x-slack-request-timestamp': mockTimestamp.toString(),
      };

      const result = await service.verifySlackRequest(headers, mockBody);

      expect(result).toBe(false);
    });

    it('should reject old timestamps (replay attack protection)', async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
      const sigBaseString = `v0:${oldTimestamp}:${mockBody}`;
      const validSignature =
        'v0=' + createHmac('sha256', mockSigningSecret).update(sigBaseString).digest('hex');

      const headers = {
        'x-slack-signature': validSignature,
        'x-slack-request-timestamp': oldTimestamp.toString(),
      };

      const result = await service.verifySlackRequest(headers, mockBody);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Request timestamp too old');
    });

    it('should reject missing signature headers', async () => {
      const headers = {};

      const result = await service.verifySlackRequest(headers, mockBody);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Missing signature or timestamp headers');
    });

    it('should allow requests when signing secret is not configured', async () => {
      delete process.env.SLACK_SIGNING_SECRET;

      // Recreate service without signing secret
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SlackEventService,
          { provide: SlackMessagingService, useValue: mockSlackMessaging },
          { provide: SlackMessageFormatterService, useValue: mockFormatter },
          { provide: LoggerService, useValue: mockLogger },
          { provide: PrismaService, useValue: mockPrisma },
        ],
      }).compile();

      const testService = module.get<SlackEventService>(SlackEventService);
      const result = await testService.verifySlackRequest({}, mockBody);

      expect(result).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Slack signing secret not configured, skipping verification',
      );
    });
  });

  describe('handleSlackEvent', () => {
    it('should handle app_mention event', async () => {
      const event = {
        type: 'app_mention',
        user: mockUserId,
        channel: 'C1234567890',
        text: '<@U123> help',
      };

      await service.handleSlackEvent(event, mockTeamId);

      expect(mockLogger.info).toHaveBeenCalledWith('Bot mentioned', {
        channel: 'C1234567890',
        user: mockUserId,
        text: '<@U123> help',
      });
    });

    it('should handle direct message event', async () => {
      const event = {
        type: 'message',
        user: mockUserId,
        channel: 'D1234567890', // DM channel starts with D
        text: 'Hello bot',
      };

      await service.handleSlackEvent(event, mockTeamId);

      expect(mockLogger.info).toHaveBeenCalledWith('Direct message received', {
        user: mockUserId,
        text: 'Hello bot',
      });
    });

    it('should log unhandled event types', async () => {
      const event = {
        type: 'unknown_event',
        user: mockUserId,
      };

      await service.handleSlackEvent(event, mockTeamId);

      expect(mockLogger.debug).toHaveBeenCalledWith('Unhandled event type', {
        eventType: 'unknown_event',
      });
    });

    it('should handle errors in event processing', async () => {
      const event = {
        type: 'app_mention',
        user: mockUserId,
      };

      // Mock an error in processing
      jest
        .spyOn(
          service as unknown as { handleAppMention: (...args: unknown[]) => Promise<unknown> },
          'handleAppMention',
        )
        .mockRejectedValue(new Error('Processing error'));

      await service.handleSlackEvent(event, mockTeamId);

      expect(mockLogger.error).toHaveBeenCalledWith('Error processing Slack event', {
        error: 'Processing error',
        eventType: 'app_mention',
        teamId: mockTeamId,
      });
    });
  });

  describe('processInteractiveComponent', () => {
    const mockPayload = {
      type: 'block_actions',
      user: { id: mockUserId, name: 'testuser' },
      team: { id: mockTeamId, domain: 'test-team' },
      actions: [
        {
          action_id: 'submit_standup_response',
          value: mockInstanceId,
          type: 'button',
        },
      ],
      trigger_id: mockTriggerId,
    };

    it('should handle block_actions interactive component', async () => {
      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };
      const mockInstance = {
        id: mockInstanceId,
        team: { name: 'Test Team' },
        configSnapshot: { questions: ['Question 1'] },
      };
      const mockModal = {
        type: 'modal' as const,
        callback_id: 'test',
        title: { type: 'plain_text' as const, text: 'Test' },
        blocks: [],
      };

      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );
      mockPrisma.standupInstance.findFirst.mockResolvedValue(
        mockInstance as {
          id: string;
          team: { name: string };
          configSnapshot: { questions: string[] };
        },
      );
      mockFormatter.createResponseModal.mockReturnValue(mockModal);
      mockSlackMessaging.openModal.mockResolvedValue({ ok: true });

      await service.processInteractiveComponent(mockPayload);

      expect(mockFormatter.createResponseModal).toHaveBeenCalledWith(
        mockInstanceId,
        ['Question 1'],
        mockUserId,
      );
      expect(mockSlackMessaging.openModal).toHaveBeenCalledWith(
        mockIntegrationId,
        mockTriggerId,
        mockModal,
      );
    });

    it('should handle skip_standup action', async () => {
      const skipPayload = {
        ...mockPayload,
        actions: [
          {
            action_id: 'skip_standup',
            value: mockInstanceId,
            type: 'button',
          },
        ],
      };

      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };
      const mockTeamMember = { id: 'member-123' };

      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );
      mockPrisma.teamMember.findFirst.mockResolvedValue(mockTeamMember as { id: string });
      mockSlackMessaging.sendDirectMessage.mockResolvedValue({ ok: true });

      await service.processInteractiveComponent(skipPayload);

      expect(mockSlackMessaging.sendDirectMessage).toHaveBeenCalledWith(
        mockIntegrationId,
        mockUserId,
        "✅ You've been marked as skipping today's standup.",
      );
    });

    it('should handle view_submission interactive component', async () => {
      const modalPayload = {
        type: 'view_submission',
        user: { id: mockUserId, name: 'testuser' },
        team: { id: mockTeamId, domain: 'test-team' },
        view: {
          callback_id: `standup_response_${mockInstanceId}`,
          state: {
            values: {
              question_0: {
                answer_0: { value: 'My answer' },
              },
            },
          },
        },
      };

      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };
      const mockTeamMember = { id: 'member-123' };

      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );
      mockPrisma.teamMember.findFirst.mockResolvedValue(mockTeamMember as { id: string });
      mockPrisma.answer.upsert.mockResolvedValue(
        {} as {
          standupInstanceId: string;
          teamMemberId: string;
          questionIndex: number;
          text: string;
          submittedAt: Date;
        },
      );
      mockSlackMessaging.sendDirectMessage.mockResolvedValue({ ok: true });

      await service.processInteractiveComponent(modalPayload);

      expect(mockPrisma.answer.upsert).toHaveBeenCalledWith({
        where: {
          standupInstanceId_teamMemberId_questionIndex: {
            standupInstanceId: mockInstanceId,
            teamMemberId: 'member-123',
            questionIndex: 0,
          },
        },
        update: {
          text: 'My answer',
          submittedAt: expect.any(Date),
        },
        create: {
          standupInstanceId: mockInstanceId,
          teamMemberId: 'member-123',
          questionIndex: 0,
          text: 'My answer',
          submittedAt: expect.any(Date),
        },
      });

      expect(mockSlackMessaging.sendDirectMessage).toHaveBeenCalledWith(
        mockIntegrationId,
        mockUserId,
        '✅ Your standup responses have been submitted! Thank you.',
      );
    });

    it('should handle unhandled interactive component types', async () => {
      const unknownPayload = {
        type: 'unknown_type',
        user: { id: mockUserId, name: 'testuser' },
        team: { id: mockTeamId, domain: 'test-team' },
      };

      await service.processInteractiveComponent(unknownPayload);

      expect(mockLogger.debug).toHaveBeenCalledWith('Unhandled interactive component type', {
        type: 'unknown_type',
      });
    });
  });

  describe('processSlashCommand', () => {
    const mockSlashPayload = {
      command: '/standup',
      text: 'status',
      user_id: mockUserId,
      user_name: 'testuser',
      team_id: mockTeamId,
      team_domain: 'test-team',
      channel_id: 'C1234567890',
      channel_name: 'general',
      trigger_id: mockTriggerId,
      response_url: 'https://hooks.slack.com/commands/...',
    };

    it('should handle status command', async () => {
      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };
      const mockTeamMember = {
        id: 'member-123',
        teamId: 'team-123',
        team: { name: 'Test Team' },
      };
      const mockInstance = { id: mockInstanceId, state: 'collecting' };

      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );
      mockPrisma.teamMember.findFirst.mockResolvedValue(mockTeamMember as { id: string });
      mockPrisma.standupInstance.findFirst.mockResolvedValue(
        mockInstance as { id: string; state: string },
      );
      mockPrisma.answer.findFirst.mockResolvedValue(null);
      mockFormatter.formatUserStatusResponse.mockReturnValue({
        text: 'Status response',
        blocks: [],
      });

      const result = await service.processSlashCommand(mockSlashPayload);

      expect(result).toEqual({
        response_type: 'ephemeral',
        text: 'Status response',
        blocks: [],
      });
    });

    it('should handle submit command', async () => {
      const submitPayload = { ...mockSlashPayload, text: 'submit' };
      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };
      const mockTeamMember = { id: 'member-123', teamId: 'team-123' };
      const mockInstance = {
        id: mockInstanceId,
        state: 'collecting',
        configSnapshot: { questions: ['Question 1'] },
      };
      const mockModal = {
        type: 'modal' as const,
        callback_id: 'test',
        title: { type: 'plain_text' as const, text: 'Test' },
        blocks: [],
      };

      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );
      mockPrisma.teamMember.findFirst.mockResolvedValue(mockTeamMember as { id: string });
      mockPrisma.standupInstance.findFirst.mockResolvedValue(
        mockInstance as { id: string; state: string; configSnapshot: { questions: string[] } },
      );
      mockFormatter.createResponseModal.mockReturnValue(mockModal);
      mockSlackMessaging.openModal.mockResolvedValue({ ok: true });

      const result = await service.processSlashCommand(submitPayload);

      expect(mockSlackMessaging.openModal).toHaveBeenCalledWith(
        mockIntegrationId,
        mockTriggerId,
        mockModal,
      );
      expect(result).toEqual({
        response_type: 'ephemeral',
        text: 'Opening standup form...',
      });
    });

    it('should handle skip command', async () => {
      const skipPayload = { ...mockSlashPayload, text: 'skip feeling sick today' };
      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };
      const mockTeamMember = { id: 'member-123', teamId: 'team-123' };
      const mockInstance = { id: mockInstanceId, state: 'collecting' };

      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );
      mockPrisma.teamMember.findFirst.mockResolvedValue(mockTeamMember as { id: string });
      mockPrisma.standupInstance.findFirst.mockResolvedValue(
        mockInstance as { id: string; state: string },
      );

      const result = await service.processSlashCommand(skipPayload);

      expect(result).toEqual({
        response_type: 'ephemeral',
        text: "✅ You've been marked as skipping today's standup. Reason: feeling sick today",
      });
    });

    it('should handle help command', async () => {
      const helpPayload = { ...mockSlashPayload, text: 'help' };
      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };

      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );
      mockFormatter.formatHelpMessage.mockReturnValue({
        text: 'Help message',
        blocks: [],
      });

      const result = await service.processSlashCommand(helpPayload);

      expect(result).toEqual({
        response_type: 'ephemeral',
        text: 'Help message',
        blocks: [],
      });
    });

    it('should handle empty command as help', async () => {
      const emptyPayload = { ...mockSlashPayload, text: '' };
      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };

      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );
      mockFormatter.formatHelpMessage.mockReturnValue({
        text: 'Help message',
        blocks: [],
      });

      const result = await service.processSlashCommand(emptyPayload);

      expect(result).toEqual({
        response_type: 'ephemeral',
        text: 'Help message',
        blocks: [],
      });
    });

    it('should handle unknown subcommand', async () => {
      const unknownPayload = { ...mockSlashPayload, text: 'unknown' };
      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };

      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );

      const result = await service.processSlashCommand(unknownPayload);

      expect(result).toEqual({
        response_type: 'ephemeral',
        text: 'Unknown subcommand: unknown. Type `/standup help` for available commands.',
      });
    });

    it('should handle missing integration', async () => {
      mockPrisma.integration.findFirst.mockResolvedValue(null);

      const result = await service.processSlashCommand(mockSlashPayload);

      expect(result).toEqual({
        response_type: 'ephemeral',
        text: 'Sorry, I could not find your team integration. Please contact your administrator.',
      });
    });

    it('should handle unknown command', async () => {
      const unknownCommandPayload = { ...mockSlashPayload, command: '/unknown' };
      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };

      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );

      const result = await service.processSlashCommand(unknownCommandPayload);

      expect(result).toEqual({
        response_type: 'ephemeral',
        text: 'Unknown command. Type `/standup help` for available commands.',
      });
    });

    it('should handle database errors in integration lookup', async () => {
      mockPrisma.integration.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await service.processSlashCommand(mockSlashPayload);

      expect(result).toEqual({
        response_type: 'ephemeral',
        text: 'Sorry, I could not find your team integration. Please contact your administrator.',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Error finding integration by team ID', {
        error: 'Database error',
        teamId: mockTeamId,
      });
    });
  });

  describe('status command scenarios', () => {
    const mockSlashPayload = {
      command: '/standup',
      text: 'status',
      user_id: mockUserId,
      user_name: 'testuser',
      team_id: mockTeamId,
      team_domain: 'test-team',
      channel_id: 'C1234567890',
      channel_name: 'general',
      trigger_id: mockTriggerId,
      response_url: 'https://hooks.slack.com/commands/...',
    };

    it('should handle user not being team member', async () => {
      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };

      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );
      mockPrisma.teamMember.findFirst.mockResolvedValue(null);

      const result = await service.processSlashCommand(mockSlashPayload);

      expect(result).toEqual({
        response_type: 'ephemeral',
        text: 'You are not a member of any team configured for standups.',
      });
    });

    it('should handle no active standup', async () => {
      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };
      const mockTeamMember = {
        id: 'member-123',
        teamId: 'team-123',
        team: { name: 'Test Team' },
      };

      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );
      mockPrisma.teamMember.findFirst.mockResolvedValue(mockTeamMember as { id: string });
      mockPrisma.standupInstance.findFirst.mockResolvedValue(null);
      mockFormatter.formatUserStatusResponse.mockReturnValue({
        text: 'No active standup',
        blocks: [],
      });

      await service.processSlashCommand(mockSlashPayload);

      expect(mockFormatter.formatUserStatusResponse).toHaveBeenCalledWith(null, false, 'Test Team');
    });
  });

  describe('submit command scenarios', () => {
    const mockSlashPayload = {
      command: '/standup',
      text: 'submit',
      user_id: mockUserId,
      user_name: 'testuser',
      team_id: mockTeamId,
      team_domain: 'test-team',
      channel_id: 'C1234567890',
      channel_name: 'general',
      trigger_id: mockTriggerId,
      response_url: 'https://hooks.slack.com/commands/...',
    };

    it('should handle no active standup for submit', async () => {
      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };
      const mockTeamMember = { id: 'member-123', teamId: 'team-123' };

      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );
      mockPrisma.teamMember.findFirst.mockResolvedValue(mockTeamMember as { id: string });
      mockPrisma.standupInstance.findFirst.mockResolvedValue(null);

      const result = await service.processSlashCommand(mockSlashPayload);

      expect(result).toEqual({
        response_type: 'ephemeral',
        text: 'No active standup found for your team.',
      });
    });
  });

  describe('error handling in modal response collection', () => {
    it('should handle errors in modal response collection', async () => {
      const modalPayload = {
        type: 'view_submission',
        user: { id: mockUserId, name: 'testuser' },
        team: { id: mockTeamId, domain: 'test-team' },
        view: {
          callback_id: `standup_response_${mockInstanceId}`,
          state: {
            values: {
              question_0: {
                answer_0: { value: 'My answer' },
              },
            },
          },
        },
      };

      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };
      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );
      mockPrisma.teamMember.findFirst.mockRejectedValue(new Error('Database error'));
      mockSlackMessaging.sendDirectMessage.mockResolvedValue({ ok: true });

      await service.processInteractiveComponent(modalPayload);

      expect(mockLogger.error).toHaveBeenCalledWith('Error collecting modal response', {
        error: 'Database error',
        instanceId: mockInstanceId,
        userId: mockUserId,
      });

      // Should attempt to send error message to user
      expect(mockSlackMessaging.sendDirectMessage).toHaveBeenCalledWith(
        mockIntegrationId,
        mockUserId,
        '❌ Sorry, there was an error saving your responses. Please try again or contact your team admin.',
      );
    });

    it('should handle empty answers in modal response', async () => {
      const modalPayload = {
        type: 'view_submission',
        user: { id: mockUserId, name: 'testuser' },
        team: { id: mockTeamId, domain: 'test-team' },
        view: {
          callback_id: `standup_response_${mockInstanceId}`,
          state: {
            values: {
              question_0: {
                answer_0: { value: '   ' }, // Empty/whitespace answer
              },
            },
          },
        },
      };

      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };
      const mockTeamMember = { id: 'member-123' };

      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );
      mockPrisma.teamMember.findFirst.mockResolvedValue(mockTeamMember as { id: string });

      await service.processInteractiveComponent(modalPayload);

      expect(mockLogger.warn).toHaveBeenCalledWith('No answers found in modal response', {
        instanceId: mockInstanceId,
        userId: mockUserId,
      });
      expect(mockPrisma.answer.upsert).not.toHaveBeenCalled();
    });
  });

  describe('findIntegrationByTeamId', () => {
    it('should find integration by team ID', async () => {
      const mockIntegration = { id: mockIntegrationId, orgId: 'org-123' };
      mockPrisma.integration.findFirst.mockResolvedValue(
        mockIntegration as { id: string; orgId: string },
      );

      const result = await (
        service as unknown as {
          findIntegrationByTeamId: (
            teamId: string,
          ) => Promise<{ id: string; orgId: string } | null>;
        }
      ).findIntegrationByTeamId(mockTeamId);

      expect(mockPrisma.integration.findFirst).toHaveBeenCalledWith({
        where: {
          platform: 'slack',
          externalTeamId: mockTeamId,
        },
        select: {
          id: true,
          orgId: true,
        },
      });
      expect(result).toEqual(mockIntegration);
    });

    it('should return null when integration not found', async () => {
      mockPrisma.integration.findFirst.mockResolvedValue(null);

      const result = await (
        service as unknown as {
          findIntegrationByTeamId: (
            teamId: string,
          ) => Promise<{ id: string; orgId: string } | null>;
        }
      ).findIntegrationByTeamId(mockTeamId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockPrisma.integration.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await (
        service as unknown as {
          findIntegrationByTeamId: (
            teamId: string,
          ) => Promise<{ id: string; orgId: string } | null>;
        }
      ).findIntegrationByTeamId(mockTeamId);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Error finding integration by team ID', {
        error: 'Database error',
        teamId: mockTeamId,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle invalid callback_id format in view submission', async () => {
      const modalPayload = {
        type: 'view_submission',
        user: { id: mockUserId, name: 'testuser' },
        team: { id: mockTeamId, domain: 'test-team' },
        view: {
          callback_id: 'invalid_format',
          state: { values: {} },
        },
      };

      await service.processInteractiveComponent(modalPayload);

      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid callback_id format', {
        callback_id: 'invalid_format',
      });
    });

    it('should handle missing actions in block_actions', async () => {
      const payloadWithoutActions = {
        type: 'block_actions',
        user: { id: mockUserId, name: 'testuser' },
        team: { id: mockTeamId, domain: 'test-team' },
        actions: undefined,
        trigger_id: mockTriggerId,
      };

      await service.processInteractiveComponent(payloadWithoutActions);

      // Should not crash and should return early
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should handle missing view in view_submission', async () => {
      const payloadWithoutView = {
        type: 'view_submission',
        user: { id: mockUserId, name: 'testuser' },
        team: { id: mockTeamId, domain: 'test-team' },
        view: undefined,
      };

      await service.processInteractiveComponent(payloadWithoutView);

      // Should return early without processing
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalid callback_id'),
      );
    });
  });
});
