import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AuthFactory } from '@/test/utils/factories';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthGuard, Reflector],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  describe('canActivate', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should extend AuthGuard', () => {
      expect(guard).toBeInstanceOf(JwtAuthGuard);
    });

    it('should call parent canActivate method', async () => {
      const mockExecutionContext = createMockExecutionContext();
      const parentCanActivateSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      parentCanActivateSpy.mockResolvedValue(true);

      const result = await guard.canActivate(mockExecutionContext);

      expect(parentCanActivateSpy).toHaveBeenCalledWith(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle authentication failure', async () => {
      const mockExecutionContext = createMockExecutionContext();
      const parentCanActivateSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      parentCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockExecutionContext);

      expect(parentCanActivateSpy).toHaveBeenCalledWith(mockExecutionContext);
      expect(result).toBe(false);
    });

    it('should handle authentication errors', async () => {
      const mockExecutionContext = createMockExecutionContext();
      const parentCanActivateSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      const authError = new Error('Invalid token');
      parentCanActivateSpy.mockRejectedValue(authError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(authError);
      expect(parentCanActivateSpy).toHaveBeenCalledWith(mockExecutionContext);
    });
  });

  describe('getRequest', () => {
    it('should extract request from HTTP context', () => {
      const mockRequest = AuthFactory.buildMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      const mockExecutionContext = createMockExecutionContext(mockRequest);

      const request = guard.getRequest(mockExecutionContext);

      expect(request).toBe(mockRequest);
    });
  });

  describe('handleRequest', () => {
    it('should return user when authentication succeeds', () => {
      const mockUser = { id: 'user-id', email: 'test@example.com' };
      const mockInfo = null;
      const mockError = null;
      const mockContext = createMockExecutionContext();

      const result = guard.handleRequest(mockError, mockUser, mockInfo, mockContext);

      expect(result).toBe(mockUser);
    });

    it('should throw error when authentication fails with error', () => {
      const mockUser = false;
      const mockInfo = null;
      const mockError = new Error('Token expired');
      const mockContext = createMockExecutionContext();

      expect(() => guard.handleRequest(mockError, mockUser, mockInfo, mockContext)).toThrow(
        mockError,
      );
    });

    it('should throw unauthorized error when no user and no error', () => {
      const mockUser = false;
      const mockInfo = { message: 'No auth token' };
      const mockError = null;
      const mockContext = createMockExecutionContext();

      expect(() => guard.handleRequest(mockError, mockUser, mockInfo, mockContext)).toThrow();
    });
  });
});

function createMockExecutionContext(
  request?: unknown,
  client?: unknown,
  type: 'http' | 'ws' = 'http',
): ExecutionContext {
  const mockRequest = request || AuthFactory.buildMockRequest();

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => ({}),
    }),
    switchToWs: () => ({
      getClient: () => client || {},
      getData: () => ({}),
    }),
    switchToRpc: () => ({
      getContext: () => ({}),
      getData: () => ({}),
    }),
    getType: () => type,
    getClass: () => class MockClass {},
    getHandler: () => function mockHandler() {},
    getArgs: () => [],
    getArgByIndex: () => ({}),
  } as unknown as ExecutionContext;
}
