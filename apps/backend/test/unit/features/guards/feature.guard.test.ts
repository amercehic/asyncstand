import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureGuard } from '@/features/guards/feature.guard';
import { FeatureService, FeatureCheckResult } from '@/features/feature.service';
import { FEATURE_KEY } from '@/features/decorators/require-feature.decorator';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { TestHelpers } from '@/test/utils/test-helpers';

describe('FeatureGuard', () => {
  let guard: FeatureGuard;
  let mockReflector: jest.Mocked<Reflector>;
  let mockFeatureService: jest.Mocked<FeatureService>;

  beforeEach(async () => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    mockFeatureService = {
      isFeatureEnabled: jest.fn(),
    } as unknown as jest.Mocked<FeatureService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: FeatureService, useValue: mockFeatureService },
      ],
    }).compile();

    guard = module.get<FeatureGuard>(FeatureGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    const mockUser = {
      id: TestHelpers.generateRandomString(),
      orgId: TestHelpers.generateRandomString(),
      email: 'test@example.com',
      name: 'Test User',
      role: 'member',
      isSuperAdmin: false,
    };

    const mockSuperAdmin = {
      id: TestHelpers.generateRandomString(),
      orgId: TestHelpers.generateRandomString(),
      email: 'admin@example.com',
      name: 'Super Admin',
      role: 'admin',
      isSuperAdmin: true,
    };

    const createMockExecutionContext = (
      user?: unknown,
      requiredFeature?: string,
    ): ExecutionContext => {
      const mockRequest = {
        user: user === undefined ? undefined : user === null ? null : user || mockUser,
      };

      mockReflector.getAllAndOverride.mockReturnValue(requiredFeature);

      const mockHandler = jest.fn();
      const mockClass = jest.fn();

      return {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => ({}),
        }),
        getHandler: () => mockHandler,
        getClass: () => mockClass,
      } as unknown as ExecutionContext;
    };

    it('should return true when no feature is required', async () => {
      const mockExecutionContext = createMockExecutionContext(mockUser, undefined);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(FEATURE_KEY, [
        expect.any(Function),
        expect.any(Function),
      ]);
    });

    it('should throw error when user is not authenticated', async () => {
      const mockExecutionContext = createMockExecutionContext(undefined, 'test-feature');

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new ApiError(
          ErrorCode.UNAUTHENTICATED,
          'User authentication required',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });

    it('should throw error when user has no orgId', async () => {
      const userWithoutOrg = { ...mockUser, orgId: null };
      const mockExecutionContext = createMockExecutionContext(userWithoutOrg, 'test-feature');

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new ApiError(
          ErrorCode.UNAUTHENTICATED,
          'User authentication required',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });

    it('should return true when feature is enabled', async () => {
      const requiredFeature = 'test-feature';
      const mockExecutionContext = createMockExecutionContext(mockUser, requiredFeature);

      const featureCheckResult = {
        enabled: true,
        source: 'global' as const,
      };

      mockFeatureService.isFeatureEnabled.mockResolvedValue(featureCheckResult);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockFeatureService.isFeatureEnabled).toHaveBeenCalledWith(
        requiredFeature,
        mockUser.orgId,
        mockUser.id,
      );

      // Check that feature check result is added to request
      const request = mockExecutionContext.switchToHttp().getRequest();
      expect(request.featureCheck).toEqual(featureCheckResult);
    });

    it('should throw error when feature is disabled', async () => {
      const requiredFeature = 'disabled-feature';
      const mockExecutionContext = createMockExecutionContext(mockUser, requiredFeature);

      const featureCheckResult = {
        enabled: false,
        source: 'global' as const,
        reason: 'Feature globally disabled',
      };

      mockFeatureService.isFeatureEnabled.mockResolvedValue(featureCheckResult);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new ApiError(
          ErrorCode.FEATURE_DISABLED,
          `Feature '${requiredFeature}' is not available. Feature globally disabled`,
          HttpStatus.FORBIDDEN,
        ),
      );

      expect(mockFeatureService.isFeatureEnabled).toHaveBeenCalledWith(
        requiredFeature,
        mockUser.orgId,
        mockUser.id,
      );
    });

    it('should throw error with default message when no reason provided', async () => {
      const requiredFeature = 'disabled-feature';
      const mockExecutionContext = createMockExecutionContext(mockUser, requiredFeature);

      const featureCheckResult = {
        enabled: false,
        source: 'plan' as const,
      };

      mockFeatureService.isFeatureEnabled.mockResolvedValue(featureCheckResult);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new ApiError(
          ErrorCode.FEATURE_DISABLED,
          `Feature '${requiredFeature}' is not available. Please upgrade your plan or contact support.`,
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('should handle feature service errors', async () => {
      const requiredFeature = 'error-feature';
      const mockExecutionContext = createMockExecutionContext(mockUser, requiredFeature);

      mockFeatureService.isFeatureEnabled.mockRejectedValue(new Error('Database error'));

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('Database error');

      expect(mockFeatureService.isFeatureEnabled).toHaveBeenCalledWith(
        requiredFeature,
        mockUser.orgId,
        mockUser.id,
      );
    });

    it('should properly extract feature metadata from handler and class', async () => {
      const requiredFeature = 'test-feature';
      const mockExecutionContext = createMockExecutionContext(mockUser, requiredFeature);

      const featureCheckResult = {
        enabled: true,
        source: 'plan' as const,
        value: 'custom-value',
      };

      mockFeatureService.isFeatureEnabled.mockResolvedValue(featureCheckResult);

      await guard.canActivate(mockExecutionContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(FEATURE_KEY, [
        expect.any(Function), // handler
        expect.any(Function), // class
      ]);
    });

    it('should add feature check result to request for controller access', async () => {
      const requiredFeature = 'test-feature';
      const mockRequest = { user: mockUser };
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(requiredFeature);

      const featureCheckResult = {
        enabled: true,
        source: 'plan' as const,
        value: 'premium',
        reason: 'Plan-based feature',
      };

      mockFeatureService.isFeatureEnabled.mockResolvedValue(featureCheckResult);

      await guard.canActivate(mockExecutionContext);

      expect(mockRequest).toHaveProperty('featureCheck', featureCheckResult);
    });

    it('should handle null user gracefully', async () => {
      const mockExecutionContext = createMockExecutionContext(null, 'test-feature');

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new ApiError(
          ErrorCode.UNAUTHENTICATED,
          'User authentication required',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });

    it('should handle user with null orgId', async () => {
      const userWithNullOrgId = { ...mockUser, orgId: null };
      const mockExecutionContext = createMockExecutionContext(userWithNullOrgId, 'test-feature');

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new ApiError(
          ErrorCode.UNAUTHENTICATED,
          'User authentication required',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });

    it('should handle user with empty string orgId', async () => {
      const userWithEmptyOrgId = { ...mockUser, orgId: '' };
      const mockExecutionContext = createMockExecutionContext(userWithEmptyOrgId, 'test-feature');

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new ApiError(
          ErrorCode.UNAUTHENTICATED,
          'User authentication required',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });

    it('should work with super admin users', async () => {
      const mockExecutionContext = createMockExecutionContext(mockSuperAdmin, 'admin-feature');

      const featureCheckResult: FeatureCheckResult = {
        enabled: true,
        source: 'global',
      };

      mockFeatureService.isFeatureEnabled.mockResolvedValue(featureCheckResult);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockFeatureService.isFeatureEnabled).toHaveBeenCalledWith(
        'admin-feature',
        mockSuperAdmin.orgId,
        mockSuperAdmin.id,
      );
    });

    it('should handle various feature check sources', async () => {
      const sources: Array<FeatureCheckResult['source']> = [
        'global',
        'environment',
        'plan',
        'rollout',
      ];

      for (const source of sources) {
        const mockExecutionContext = createMockExecutionContext(mockUser, 'test-feature');
        const featureCheckResult: FeatureCheckResult = {
          enabled: true,
          source,
        };

        mockFeatureService.isFeatureEnabled.mockResolvedValue(featureCheckResult);

        const result = await guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);

        // Clear mocks for next iteration
        jest.clearAllMocks();
        mockReflector.getAllAndOverride.mockReturnValue('test-feature');
      }
    });

    it('should handle feature service returning different error reasons', async () => {
      const errorReasons = [
        'Feature globally disabled',
        'Not available in current environment',
        'Plan limit exceeded',
        'Rollout not active',
      ];

      for (const reason of errorReasons) {
        const mockExecutionContext = createMockExecutionContext(mockUser, 'disabled-feature');
        const featureCheckResult: FeatureCheckResult = {
          enabled: false,
          source: 'global',
          reason,
        };

        mockFeatureService.isFeatureEnabled.mockResolvedValue(featureCheckResult);

        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
          new ApiError(
            ErrorCode.FEATURE_DISABLED,
            `Feature 'disabled-feature' is not available. ${reason}`,
            HttpStatus.FORBIDDEN,
          ),
        );

        // Clear mocks for next iteration
        jest.clearAllMocks();
        mockReflector.getAllAndOverride.mockReturnValue('disabled-feature');
      }
    });

    it('should handle empty feature key as no feature required', async () => {
      const mockExecutionContext = createMockExecutionContext(mockUser, '');

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      // Feature service should not be called for empty feature key
      expect(mockFeatureService.isFeatureEnabled).not.toHaveBeenCalled();
    });

    it('should handle async operation timing', async () => {
      const mockExecutionContext = createMockExecutionContext(mockUser, 'slow-feature');
      const featureCheckResult: FeatureCheckResult = {
        enabled: true,
        source: 'global',
      };

      // Simulate slow feature service response
      mockFeatureService.isFeatureEnabled.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(featureCheckResult), 100)),
      );

      const startTime = Date.now();
      const result = await guard.canActivate(mockExecutionContext);
      const endTime = Date.now();

      expect(result).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should preserve request object modifications', async () => {
      const mockRequest = {
        user: mockUser,
        existingProperty: 'should be preserved',
      };
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue('test-feature');

      const featureCheckResult: FeatureCheckResult = {
        enabled: true,
        source: 'plan',
        value: 'custom-value',
      };

      mockFeatureService.isFeatureEnabled.mockResolvedValue(featureCheckResult);

      await guard.canActivate(mockExecutionContext);

      expect(mockRequest.existingProperty).toBe('should be preserved');
      expect(mockRequest).toHaveProperty('featureCheck', featureCheckResult);
    });

    it('should handle concurrent feature checks', async () => {
      const mockExecutionContext1 = createMockExecutionContext(mockUser, 'feature-1');
      const mockExecutionContext2 = createMockExecutionContext(mockUser, 'feature-2');

      const featureCheckResult1: FeatureCheckResult = {
        enabled: true,
        source: 'global',
      };
      const featureCheckResult2: FeatureCheckResult = {
        enabled: false,
        source: 'plan',
        reason: 'Plan limit exceeded',
      };

      mockFeatureService.isFeatureEnabled
        .mockResolvedValueOnce(featureCheckResult1)
        .mockResolvedValueOnce(featureCheckResult2);

      mockReflector.getAllAndOverride
        .mockReturnValueOnce('feature-1')
        .mockReturnValueOnce('feature-2');

      const promise1 = guard.canActivate(mockExecutionContext1);
      const promise2 = guard.canActivate(mockExecutionContext2);

      const [result1] = await Promise.allSettled([promise1, promise2]);

      expect(result1.status).toBe('fulfilled');
      if (result1.status === 'fulfilled') {
        expect(result1.value).toBe(true);
      }
    });
  });
});
