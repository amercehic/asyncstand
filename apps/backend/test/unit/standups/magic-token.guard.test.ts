import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { MagicTokenGuard, RequestWithMagicToken } from '@/standups/guards/magic-token.guard';
import { MagicTokenService, MagicTokenPayload } from '@/standups/services/magic-token.service';
import { LoggerService } from '@/common/logger.service';

describe('MagicTokenGuard', () => {
  let guard: MagicTokenGuard;
  let mockMagicTokenService: jest.Mocked<MagicTokenService>;
  let mockLogger: jest.Mocked<LoggerService>;

  const mockTokenPayload: MagicTokenPayload = {
    standupInstanceId: 'instance-123',
    teamMemberId: 'member-123',
    platformUserId: 'platform-user-123',
    orgId: 'org-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MagicTokenGuard,
        {
          provide: MagicTokenService,
          useValue: {
            validateMagicToken: jest.fn(),
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

    guard = module.get<MagicTokenGuard>(MagicTokenGuard);
    mockMagicTokenService = module.get(MagicTokenService);
    mockLogger = module.get(LoggerService);

    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    request: Partial<RequestWithMagicToken>,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request as RequestWithMagicToken,
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow access with valid token in Authorization header', async () => {
      const mockRequest: Partial<RequestWithMagicToken> = {
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        path: '/magic-token/standup-info',
        method: 'GET',
        query: {},
        body: {},
        params: {},
      };

      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);

      const context = createMockExecutionContext(mockRequest);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockMagicTokenService.validateMagicToken).toHaveBeenCalledWith('valid-token-123');
      expect(mockRequest.magicTokenPayload).toEqual(mockTokenPayload);
      expect(mockLogger.debug).toHaveBeenCalledWith('Magic token validated successfully', {
        instanceId: mockTokenPayload.standupInstanceId,
        teamMemberId: mockTokenPayload.teamMemberId,
        orgId: mockTokenPayload.orgId,
        path: '/magic-token/standup-info',
      });
    });

    it('should allow access with valid token in query parameter', async () => {
      const mockRequest: Partial<RequestWithMagicToken> = {
        headers: {},
        query: { token: 'query-token-123' },
        body: {},
        params: {},
        path: '/magic-token/validate',
        method: 'GET',
      };

      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);

      const context = createMockExecutionContext(mockRequest);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockMagicTokenService.validateMagicToken).toHaveBeenCalledWith('query-token-123');
      expect(mockRequest.magicTokenPayload).toEqual(mockTokenPayload);
    });

    it('should allow access with valid token in request body', async () => {
      const mockRequest: Partial<RequestWithMagicToken> = {
        headers: {},
        query: {},
        body: { magicToken: 'body-token-123' },
        params: {},
        path: '/magic-token/submit',
        method: 'POST',
      };

      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);

      const context = createMockExecutionContext(mockRequest);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockMagicTokenService.validateMagicToken).toHaveBeenCalledWith('body-token-123');
      expect(mockRequest.magicTokenPayload).toEqual(mockTokenPayload);
    });

    it('should allow access with valid token in path parameter', async () => {
      const mockRequest: Partial<RequestWithMagicToken> = {
        headers: {},
        query: {},
        body: {},
        params: { token: 'path-token-123' },
        path: '/standup/respond/path-token-123',
        method: 'GET',
      };

      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);

      const context = createMockExecutionContext(mockRequest);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockMagicTokenService.validateMagicToken).toHaveBeenCalledWith('path-token-123');
      expect(mockRequest.magicTokenPayload).toEqual(mockTokenPayload);
    });

    it('should prioritize Authorization header over other sources', async () => {
      const mockRequest: Partial<RequestWithMagicToken> = {
        headers: {
          authorization: 'Bearer header-token',
        },
        query: { token: 'query-token' },
        body: { magicToken: 'body-token' },
        params: { token: 'path-token' },
        path: '/magic-token/test',
        method: 'GET',
      };

      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);

      const context = createMockExecutionContext(mockRequest);
      await guard.canActivate(context);

      expect(mockMagicTokenService.validateMagicToken).toHaveBeenCalledWith('header-token');
    });

    it('should throw UnauthorizedException when no token is provided', async () => {
      const mockRequest: Partial<RequestWithMagicToken> = {
        headers: {},
        query: {},
        body: {},
        params: {},
        path: '/magic-token/test',
        method: 'GET',
      };

      const context = createMockExecutionContext(mockRequest);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Magic token is required'),
      );

      expect(mockLogger.warn).toHaveBeenCalledWith('Magic token not provided in request', {
        path: '/magic-token/test',
        method: 'GET',
      });
      expect(mockMagicTokenService.validateMagicToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      const mockRequest: Partial<RequestWithMagicToken> = {
        headers: {
          authorization: 'Bearer invalid-token',
        },
        path: '/magic-token/test',
        method: 'GET',
        query: {},
        body: {},
        params: {},
      };

      mockMagicTokenService.validateMagicToken.mockResolvedValue(null);

      const context = createMockExecutionContext(mockRequest);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired magic token'),
      );

      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid magic token provided', {
        path: '/magic-token/test',
        method: 'GET',
        tokenProvided: true,
      });
    });

    it('should throw UnauthorizedException when token validation throws an error', async () => {
      const mockRequest: Partial<RequestWithMagicToken> = {
        headers: {
          authorization: 'Bearer error-token',
        },
        path: '/magic-token/test',
        method: 'GET',
        query: {},
        body: {},
        params: {},
      };

      const validationError = new Error('Database connection failed');
      mockMagicTokenService.validateMagicToken.mockRejectedValue(validationError);

      const context = createMockExecutionContext(mockRequest);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Token validation failed'),
      );

      expect(mockLogger.error).toHaveBeenCalledWith('Error validating magic token', {
        error: 'Database connection failed',
        path: '/magic-token/test',
        method: 'GET',
      });
    });

    it('should re-throw UnauthorizedException without wrapping', async () => {
      const mockRequest: Partial<RequestWithMagicToken> = {
        headers: {
          authorization: 'Bearer expired-token',
        },
        path: '/magic-token/test',
        method: 'GET',
        query: {},
        body: {},
        params: {},
      };

      const unauthorizedError = new UnauthorizedException('Token expired');
      mockMagicTokenService.validateMagicToken.mockRejectedValue(unauthorizedError);

      const context = createMockExecutionContext(mockRequest);

      await expect(guard.canActivate(context)).rejects.toThrow(unauthorizedError);
    });

    it('should handle Authorization header without Bearer prefix', async () => {
      const mockRequest: Partial<RequestWithMagicToken> = {
        headers: {
          authorization: 'invalid-format-token',
        },
        query: {},
        body: {},
        params: {},
        path: '/magic-token/test',
        method: 'GET',
      };

      const context = createMockExecutionContext(mockRequest);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Magic token is required'),
      );

      expect(mockMagicTokenService.validateMagicToken).not.toHaveBeenCalled();
    });

    it('should handle empty Bearer token', async () => {
      const mockRequest: Partial<RequestWithMagicToken> = {
        headers: {
          authorization: 'Bearer ',
        },
        query: {},
        body: {},
        params: {},
        path: '/magic-token/test',
        method: 'GET',
      };

      mockMagicTokenService.validateMagicToken.mockResolvedValue(null);

      const context = createMockExecutionContext(mockRequest);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Magic token is required'),
      );

      expect(mockMagicTokenService.validateMagicToken).not.toHaveBeenCalled();
    });
  });

  describe('token extraction priority', () => {
    it('should use query parameter when Authorization header is missing', async () => {
      const mockRequest: Partial<RequestWithMagicToken> = {
        headers: {},
        query: { token: 'query-token' },
        body: { magicToken: 'body-token' },
        params: { token: 'path-token' },
        path: '/magic-token/test',
        method: 'GET',
      };

      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);

      const context = createMockExecutionContext(mockRequest);
      await guard.canActivate(context);

      expect(mockMagicTokenService.validateMagicToken).toHaveBeenCalledWith('query-token');
    });

    it('should use body parameter when Authorization header and query are missing', async () => {
      const mockRequest: Partial<RequestWithMagicToken> = {
        headers: {},
        query: {},
        body: { magicToken: 'body-token' },
        params: { token: 'path-token' },
        path: '/magic-token/test',
        method: 'POST',
      };

      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);

      const context = createMockExecutionContext(mockRequest);
      await guard.canActivate(context);

      expect(mockMagicTokenService.validateMagicToken).toHaveBeenCalledWith('body-token');
    });

    it('should use path parameter as last resort', async () => {
      const mockRequest: Partial<RequestWithMagicToken> = {
        headers: {},
        query: {},
        body: {},
        params: { token: 'path-token' },
        path: '/standup/respond/path-token',
        method: 'GET',
      };

      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);

      const context = createMockExecutionContext(mockRequest);
      await guard.canActivate(context);

      expect(mockMagicTokenService.validateMagicToken).toHaveBeenCalledWith('path-token');
    });
  });
});
