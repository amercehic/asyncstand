import { Test, TestingModule } from '@nestjs/testing';
import { SlackOauthController } from '@/integrations/slack/slack-oauth.controller';
import { SlackOauthService } from '@/integrations/slack/slack-oauth.service';
import { LoggerService } from '@/common/logger.service';
import { RedisService } from '@/common/redis.service';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';

describe('SlackOauthController', () => {
  let controller: SlackOauthController;
  let mockSlackOauthService: jest.Mocked<SlackOauthService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockResponse: jest.Mocked<Response>;
  let mockRequest: jest.Mocked<Request>;

  const mockOrgId = 'org-123';

  beforeEach(async () => {
    mockSlackOauthService = {
      exchangeCode: jest.fn(),
    } as unknown as jest.Mocked<SlackOauthService>;

    mockLoggerService = {
      setContext: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    mockRedisService = {
      generateStateToken: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    mockConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn(),
    } as unknown as jest.Mocked<Response>;

    mockRequest = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as jest.Mocked<Request>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SlackOauthController],
      providers: [
        { provide: SlackOauthService, useValue: mockSlackOauthService },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<SlackOauthController>(SlackOauthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('start', () => {
    it('should start OAuth flow and redirect to Slack', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'slackClientId':
            return 'test-client-id';
          case 'slackOauthEnabled':
            return true;
          case 'appUrl':
            return 'http://localhost:3001';
          default:
            return undefined;
        }
      });
      mockRedisService.generateStateToken.mockResolvedValue('state-token-123');

      await controller.start(mockOrgId, mockResponse);

      expect(mockRedisService.generateStateToken).toHaveBeenCalledWith(mockOrgId);
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://slack.com/oauth/v2/authorize'),
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('client_id=test-client-id'),
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('state=state-token-123'),
      );
    });

    it('should return error when orgId is missing', async () => {
      await controller.start('', mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'orgId query parameter is required',
      });
    });

    it('should return error when Slack client ID is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await controller.start(mockOrgId, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Slack OAuth not configured',
      });
    });
  });

  describe('callback', () => {
    it('should handle successful OAuth callback', async () => {
      const query = { code: 'oauth-code-123', state: 'state-token-123' };
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'frontendUrl') return 'http://localhost:3000';
        return undefined;
      });
      mockSlackOauthService.exchangeCode.mockResolvedValue(undefined);

      await controller.callback(query, mockRequest, mockResponse);

      expect(mockSlackOauthService.exchangeCode).toHaveBeenCalledWith(
        'oauth-code-123',
        'state-token-123',
        '127.0.0.1',
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/integrations?status=success',
      );
    });

    it('should handle OAuth error from Slack', async () => {
      const query = {
        error: 'access_denied',
        error_description: 'User cancelled',
        state: 'state-token-123',
      };
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'frontendUrl') return 'http://localhost:3000';
        return undefined;
      });

      await controller.callback(query, mockRequest, mockResponse);

      expect(mockResponse.redirect).toHaveBeenCalledWith(expect.stringContaining('status=error'));
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('OAuth%20was%20cancelled%20by%20user'),
      );
    });

    it('should handle missing authorization code', async () => {
      const query = { state: 'state-token-123' };
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'frontendUrl') return 'http://localhost:3000';
        return undefined;
      });

      await controller.callback(query, mockRequest, mockResponse);

      expect(mockResponse.redirect).toHaveBeenCalledWith(expect.stringContaining('status=error'));
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('missing%20authorization%20code'),
      );
    });
  });
});
