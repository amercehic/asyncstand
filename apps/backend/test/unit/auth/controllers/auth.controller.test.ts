import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Socket } from 'net';
import { AuthController } from '@/auth/controllers/auth.controller';
import { AuthService } from '@/auth/services/auth.service';
import { PasswordResetService } from '@/auth/services/password-reset.service';
import { CsrfService } from '@/common/security/csrf.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { AuthFactory } from '@/test/utils/factories';
import { createMockAuthService } from '@/test/utils/mocks/typed-mocks';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: ReturnType<typeof createMockAuthService>;
  let mockPasswordResetService: jest.Mocked<PasswordResetService>;
  let mockCsrfService: jest.Mocked<CsrfService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    mockAuthService = createMockAuthService();
    mockPasswordResetService = {
      createPasswordResetToken: jest.fn(),
      resetPassword: jest.fn(),
    } as unknown as jest.Mocked<PasswordResetService>;

    mockCsrfService = {
      getToken: jest.fn().mockReturnValue('mock-csrf-token'),
      validateToken: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<CsrfService>;

    mockRequest = AuthFactory.buildMockRequest() as Partial<Request>;
    mockResponse = {
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: PasswordResetService, useValue: mockPasswordResetService },
        { provide: CsrfService, useValue: mockCsrfService },
      ],
      imports: [
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 10,
          },
        ]),
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should create a new user successfully', async () => {
      const signupData = AuthFactory.buildSignupRequest();
      const expectedUser = {
        id: 'user-id',
        email: signupData.email,
        name: signupData.name,
      };

      mockAuthService.signup.mockResolvedValue(expectedUser);

      const result = await controller.signup(signupData);

      expect(mockAuthService.signup).toHaveBeenCalledWith(
        signupData.email,
        signupData.password,
        signupData.name,
        signupData.orgId,
      );

      expect(result).toEqual({
        id: expectedUser.id,
        email: expectedUser.email,
        name: expectedUser.name,
      });
    });

    it('should handle signup errors', async () => {
      const signupData = AuthFactory.buildSignupRequest();
      const error = new ApiError(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'User with this email already exists',
      );

      mockAuthService.signup.mockRejectedValue(error);

      await expect(controller.signup(signupData)).rejects.toThrow(error);

      expect(mockAuthService.signup).toHaveBeenCalledWith(
        signupData.email,
        signupData.password,
        signupData.name,
        signupData.orgId,
      );
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const loginData = AuthFactory.buildLoginRequest();
      const expectedResponse = {
        accessToken: 'access-token',
        expiresIn: 900,
        refreshToken: 'refresh-token',
        user: {
          id: 'user-id',
          email: loginData.email,
          name: 'Test User',
          role: 'owner',
        },
        organizations: [{ id: 'org-id', name: 'Test Org', role: 'owner', isPrimary: true }],
      };

      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(
        loginData,
        mockResponse as Response,
        mockRequest as Request,
      );

      expect(mockAuthService.login).toHaveBeenCalledWith(
        loginData.email,
        loginData.password,
        mockRequest,
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        expectedResponse.refreshToken,
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );

      expect(result).toEqual({
        accessToken: expectedResponse.accessToken,
        expiresIn: expectedResponse.expiresIn,
        user: expectedResponse.user,
        organizations: expectedResponse.organizations,
      });
    });

    it('should handle invalid credentials', async () => {
      const loginData = AuthFactory.buildLoginRequest();
      const error = new ApiError(ErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');

      mockAuthService.login.mockRejectedValue(error);

      await expect(
        controller.login(loginData, mockResponse as Response, mockRequest as Request),
      ).rejects.toThrow(error);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        loginData.email,
        loginData.password,
        mockRequest,
      );

      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout user successfully with cookie token', async () => {
      mockRequest = {
        ...mockRequest,
        cookies: { refreshToken: 'valid-refresh-token' },
        ip: '192.168.1.1',
        socket: { remoteAddress: '192.168.1.1' } as unknown as Socket,
        headers: {},
      };
      mockAuthService.logout.mockResolvedValue({ success: true });

      const result = await controller.logout(
        undefined,
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockAuthService.logout).toHaveBeenCalledWith('valid-refresh-token', '192.168.1.1');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(result).toEqual({ success: true });
    });

    it('should logout user successfully with body token', async () => {
      mockRequest = {
        ...mockRequest,
        cookies: {},
        ip: '192.168.1.1',
        socket: { remoteAddress: '192.168.1.1' } as unknown as Socket,
        headers: {},
      };
      const bodyToken = 'valid-refresh-token';
      mockAuthService.logout.mockResolvedValue({ success: true });

      const result = await controller.logout(
        bodyToken,
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockAuthService.logout).toHaveBeenCalledWith(bodyToken, '192.168.1.1');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(result).toEqual({ success: true });
    });

    it('should handle missing refresh token', async () => {
      mockRequest = {
        ...mockRequest,
        cookies: {},
      };

      await expect(
        controller.logout(undefined, mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(ApiError);
    });
  });

  describe('forgotPassword', () => {
    it('should initiate password reset successfully', async () => {
      const forgotPasswordData = AuthFactory.buildForgotPasswordRequest();
      mockRequest = {
        ...mockRequest,
        ip: '192.168.1.1',
        socket: { remoteAddress: '192.168.1.1' } as unknown as Socket,
        headers: {},
      };
      mockPasswordResetService.createPasswordResetToken.mockResolvedValue(undefined);

      const result = await controller.forgotPassword(forgotPasswordData, mockRequest as Request);

      expect(mockPasswordResetService.createPasswordResetToken).toHaveBeenCalledWith(
        forgotPasswordData.email,
        '192.168.1.1',
      );

      expect(result).toEqual({
        message: 'Password reset link has been sent to your email.',
        success: true,
      });
    });

    it('should handle password reset request errors', async () => {
      const forgotPasswordData = AuthFactory.buildForgotPasswordRequest();
      mockRequest = {
        ...mockRequest,
        ip: '192.168.1.1',
        socket: { remoteAddress: '192.168.1.1' } as unknown as Socket,
        headers: {},
      };
      const error = new Error('Email service unavailable');
      mockPasswordResetService.createPasswordResetToken.mockRejectedValue(error);

      await expect(
        controller.forgotPassword(forgotPasswordData, mockRequest as Request),
      ).rejects.toThrow(error);

      expect(mockPasswordResetService.createPasswordResetToken).toHaveBeenCalledWith(
        forgotPasswordData.email,
        '192.168.1.1',
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const resetPasswordData = AuthFactory.buildResetPasswordRequest();
      mockRequest = {
        ...mockRequest,
        ip: '192.168.1.1',
        socket: { remoteAddress: '192.168.1.1' } as unknown as Socket,
        headers: {},
      };
      mockPasswordResetService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword(resetPasswordData, mockRequest as Request);

      expect(mockPasswordResetService.resetPassword).toHaveBeenCalledWith(
        resetPasswordData.token,
        resetPasswordData.password,
        resetPasswordData.email,
        '192.168.1.1',
      );

      expect(result).toEqual({
        message: 'Password has been successfully reset.',
        success: true,
      });
    });

    it('should handle invalid reset token', async () => {
      const resetPasswordData = AuthFactory.buildResetPasswordRequest();
      mockRequest = {
        ...mockRequest,
        ip: '192.168.1.1',
        socket: { remoteAddress: '192.168.1.1' } as unknown as Socket,
        headers: {},
      };
      const error = new ApiError(ErrorCode.VALIDATION_FAILED, 'Invalid or expired reset token');
      mockPasswordResetService.resetPassword.mockRejectedValue(error);

      await expect(
        controller.resetPassword(resetPasswordData, mockRequest as Request),
      ).rejects.toThrow(error);

      expect(mockPasswordResetService.resetPassword).toHaveBeenCalledWith(
        resetPasswordData.token,
        resetPasswordData.password,
        resetPasswordData.email,
        '192.168.1.1',
      );
    });
  });
});
