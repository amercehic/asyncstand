import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { createHmac } from 'crypto';
import { SlackSignatureMiddleware } from '@/integrations/slack/middleware/slack-signature.middleware';
import { LoggerService } from '@/common/logger.service';
import { ErrorCode } from 'shared';

describe('SlackSignatureMiddleware', () => {
  let middleware: SlackSignatureMiddleware;
  let configService: jest.Mocked<ConfigService>;
  let loggerService: jest.Mocked<LoggerService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  const SIGNING_SECRET = 'test-signing-secret';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackSignatureMiddleware,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            setContext: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    middleware = module.get<SlackSignatureMiddleware>(SlackSignatureMiddleware);
    configService = module.get(ConfigService);
    loggerService = module.get(LoggerService);

    configService.get.mockImplementation((key: string) => {
      if (key === 'slackSigningSecret') return SIGNING_SECRET;
      return undefined;
    });

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    nextFunction = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createValidSignature = (timestamp: string, body: string): string => {
    const baseString = `v0:${timestamp}:${body}`;
    return `v0=${createHmac('sha256', SIGNING_SECRET).update(baseString).digest('hex')}`;
  };

  const createMockRequest = (
    timestamp?: string,
    signature?: string,
    body?: Record<string, unknown>,
  ): Partial<Request> => {
    const currentTimestamp = Math.floor(Date.now() / 1000).toString();
    const requestBody = body || { type: 'event_callback' };
    const bodyString = JSON.stringify(requestBody);

    return {
      headers: {
        'x-slack-request-timestamp': timestamp || currentTimestamp,
        'x-slack-signature':
          signature || createValidSignature(timestamp || currentTimestamp, bodyString),
      },
      body: requestBody,
      path: '/slack/events',
    };
  };

  describe('use', () => {
    it('should call next() when signature is valid', () => {
      mockRequest = createMockRequest();

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 when signature is invalid', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      mockRequest = createMockRequest(timestamp, 'v0=invalid-signature');

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'Invalid Slack signature',
      });
    });

    it('should return 400 when timestamp is missing', () => {
      mockRequest = {
        headers: {
          'x-slack-signature': 'v0=some-signature',
        },
        body: { type: 'event_callback' },
        path: '/slack/events',
      };

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Missing Slack signature headers',
      });
    });

    it('should return 400 when signature is missing', () => {
      mockRequest = {
        headers: {
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
        },
        body: { type: 'event_callback' },
        path: '/slack/events',
      };

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Missing Slack signature headers',
      });
    });

    it('should return 400 when timestamp is too old', () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes ago
      const body = JSON.stringify({ type: 'event_callback' });
      const signature = createValidSignature(oldTimestamp, body);

      mockRequest = createMockRequest(oldTimestamp, signature);

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Request timestamp too old',
      });
    });

    it('should return 500 when signing secret is not configured', () => {
      configService.get.mockReturnValue(undefined);
      mockRequest = createMockRequest();

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: ErrorCode.CONFIGURATION_ERROR,
        message: 'Slack signing secret not configured',
      });
    });

    it('should handle empty body correctly', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const bodyString = '';
      const signature = createValidSignature(timestamp, bodyString);

      mockRequest = {
        headers: {
          'x-slack-request-timestamp': timestamp,
          'x-slack-signature': signature,
        },
        body: undefined,
        path: '/slack/events',
      };

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledTimes(1);
    });

    it('should log warning when signature verification fails', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      mockRequest = createMockRequest(timestamp, 'v0=invalid-signature');

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(loggerService.warn).toHaveBeenCalledWith(
        'Slack signature verification failed',
        expect.objectContaining({
          error: 'Invalid Slack signature',
          path: '/slack/events',
          timestamp,
        }),
      );
    });

    it('should accept signatures within timestamp tolerance', () => {
      const recentTimestamp = (Math.floor(Date.now() / 1000) - 299).toString(); // 4 minutes 59 seconds ago
      const body = JSON.stringify({ type: 'event_callback' });
      const signature = createValidSignature(recentTimestamp, body);

      mockRequest = createMockRequest(recentTimestamp, signature);

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledTimes(1);
    });

    it('should reject signatures outside timestamp tolerance', () => {
      const staleTimestamp = (Math.floor(Date.now() / 1000) - 301).toString(); // 5 minutes 1 second ago
      const body = JSON.stringify({ type: 'event_callback' });
      const signature = createValidSignature(staleTimestamp, body);

      mockRequest = createMockRequest(staleTimestamp, signature);

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should handle malformed signature gracefully', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      mockRequest = createMockRequest(timestamp, 'malformed-signature');

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should handle non-numeric timestamp gracefully', () => {
      const body = JSON.stringify({ type: 'event_callback' });
      const signature = createValidSignature('not-a-number', body);

      mockRequest = createMockRequest('not-a-number', signature);

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Request timestamp too old',
      });
    });
  });
});
