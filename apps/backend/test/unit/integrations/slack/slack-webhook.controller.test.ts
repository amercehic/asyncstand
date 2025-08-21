import { Test, TestingModule } from '@nestjs/testing';
import { SlackWebhookController } from '@/integrations/slack/slack-webhook.controller';
import { SlackEventService } from '@/integrations/slack/slack-event.service';
import { LoggerService } from '@/common/logger.service';
import { Request, Response } from 'express';

describe('SlackWebhookController', () => {
  let controller: SlackWebhookController;
  let mockSlackEventService: jest.Mocked<SlackEventService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockResponse: jest.Mocked<Response>;
  let mockRequest: jest.Mocked<Request>;

  beforeEach(async () => {
    mockSlackEventService = {
      verifySlackRequest: jest.fn(),
      handleSlackEvent: jest.fn(),
      processInteractiveComponent: jest.fn(),
      processSlashCommand: jest.fn(),
    } as unknown as jest.Mocked<SlackEventService>;

    mockLoggerService = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<Response>;

    mockRequest = {
      body: JSON.stringify({ type: 'url_verification', challenge: 'test-challenge' }),
      rawBody: Buffer.from(
        JSON.stringify({ type: 'url_verification', challenge: 'test-challenge' }),
      ),
    } as unknown as jest.Mocked<Request>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SlackWebhookController],
      providers: [
        { provide: SlackEventService, useValue: mockSlackEventService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    controller = module.get<SlackWebhookController>(SlackWebhookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleSlackEvents', () => {
    const mockHeaders = {
      'x-slack-signature': 'v0=test-signature',
      'x-slack-request-timestamp': '1234567890',
    };

    it('should handle URL verification challenge', async () => {
      const body = { type: 'url_verification', challenge: 'test-challenge' };
      mockSlackEventService.verifySlackRequest.mockResolvedValue(true);

      await controller.handleSlackEvents(mockHeaders, body, mockRequest, mockResponse);

      expect(mockSlackEventService.verifySlackRequest).toHaveBeenCalledWith(
        mockHeaders,
        expect.any(String),
      );
      expect(mockResponse.json).toHaveBeenCalledWith({ challenge: 'test-challenge' });
    });

    it('should handle event callback', async () => {
      const body = {
        type: 'event_callback',
        team_id: 'team-123',
        event: { type: 'message', user: 'user-123' },
      };
      const mockReq = {
        body: JSON.stringify(body),
        rawBody: Buffer.from(JSON.stringify(body)),
      } as unknown as jest.Mocked<Request>;
      mockSlackEventService.verifySlackRequest.mockResolvedValue(true);

      await controller.handleSlackEvents(mockHeaders, body, mockReq, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({ ok: true });
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Processing Slack event',
        expect.objectContaining({
          eventType: 'message',
          teamId: 'team-123',
        }),
      );
    });

    it('should return unauthorized for invalid signature', async () => {
      const body = { type: 'event_callback' };
      mockSlackEventService.verifySlackRequest.mockResolvedValue(false);

      await controller.handleSlackEvents(mockHeaders, body, mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    });

    it('should handle unknown event types', async () => {
      const body = { type: 'unknown_event' };
      const mockReq = {
        body: JSON.stringify(body),
        rawBody: Buffer.from(JSON.stringify(body)),
      } as unknown as jest.Mocked<Request>;
      mockSlackEventService.verifySlackRequest.mockResolvedValue(true);

      await controller.handleSlackEvents(mockHeaders, body, mockReq, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({ ok: true });
      expect(mockLoggerService.warn).toHaveBeenCalledWith('Unknown Slack event type', {
        type: 'unknown_event',
      });
    });
  });

  describe('handleInteractiveComponents', () => {
    const mockHeaders = {
      'x-slack-signature': 'v0=test-signature',
      'x-slack-request-timestamp': '1234567890',
    };

    it('should handle interactive components', async () => {
      const payload = {
        type: 'block_actions',
        team: { id: 'team-123' },
        user: { id: 'user-123' },
        actions: [{ action_id: 'test-action' }],
      };
      const body = { payload: JSON.stringify(payload) };
      const rawBodyStr = `payload=${encodeURIComponent(JSON.stringify(payload))}`;

      const mockReq = {
        rawBody: Buffer.from(rawBodyStr),
      } as unknown as jest.Mocked<Request>;

      mockSlackEventService.verifySlackRequest.mockResolvedValue(true);

      await controller.handleInteractiveComponents(mockHeaders, body, mockReq, mockResponse);

      expect(mockSlackEventService.verifySlackRequest).toHaveBeenCalledWith(
        mockHeaders,
        rawBodyStr,
      );
      expect(mockResponse.json).toHaveBeenCalledWith({ ok: true });
    });

    it('should handle view submission synchronously', async () => {
      const payload = {
        type: 'view_submission',
        team: { id: 'team-123' },
        user: { id: 'user-123' },
      };
      const body = { payload: JSON.stringify(payload) };
      const rawBodyStr = `payload=${encodeURIComponent(JSON.stringify(payload))}`;

      const mockReq = {
        rawBody: Buffer.from(rawBodyStr),
      } as unknown as jest.Mocked<Request>;

      mockSlackEventService.verifySlackRequest.mockResolvedValue(true);
      mockSlackEventService.processInteractiveComponent.mockResolvedValue(undefined);

      await controller.handleInteractiveComponents(mockHeaders, body, mockReq, mockResponse);

      expect(mockSlackEventService.processInteractiveComponent).toHaveBeenCalledWith(payload);
      expect(mockResponse.json).toHaveBeenCalledWith({});
    });

    it('should return unauthorized for invalid signature', async () => {
      const body = { payload: '{}' };
      const mockReq = { rawBody: Buffer.from('payload={}') } as unknown as jest.Mocked<Request>;
      mockSlackEventService.verifySlackRequest.mockResolvedValue(false);

      await controller.handleInteractiveComponents(mockHeaders, body, mockReq, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    });
  });

  describe('handleSlashCommands', () => {
    const mockHeaders = {
      'x-slack-signature': 'v0=test-signature',
      'x-slack-request-timestamp': '1234567890',
    };

    it('should handle slash commands', async () => {
      const body = {
        command: '/standup',
        text: 'help',
        user_id: 'user-123',
        team_id: 'team-123',
      };
      const rawBodyStr = 'command=/standup&text=help&user_id=user-123&team_id=team-123';
      const mockReq = { rawBody: Buffer.from(rawBodyStr) } as unknown as jest.Mocked<Request>;

      const mockSlashResponse = {
        response_type: 'ephemeral' as const,
        text: 'Help text here',
      };

      mockSlackEventService.verifySlackRequest.mockResolvedValue(true);
      mockSlackEventService.processSlashCommand.mockResolvedValue(mockSlashResponse);

      await controller.handleSlashCommands(mockHeaders, body, mockReq, mockResponse);

      expect(mockSlackEventService.verifySlackRequest).toHaveBeenCalledWith(
        mockHeaders,
        rawBodyStr,
      );
      expect(mockSlackEventService.processSlashCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: '/standup',
          text: 'help',
          user_id: 'user-123',
          team_id: 'team-123',
        }),
      );
    });

    it('should return unauthorized for invalid signature', async () => {
      const body = { command: '/test' };
      const mockReq = { rawBody: Buffer.from('command=/test') } as unknown as jest.Mocked<Request>;
      mockSlackEventService.verifySlackRequest.mockResolvedValue(false);

      await controller.handleSlashCommands(mockHeaders, body, mockReq, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    });
  });
});
