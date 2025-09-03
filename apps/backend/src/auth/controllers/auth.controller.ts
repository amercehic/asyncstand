import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  UseGuards,
  Get,
  Put,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CsrfProtected,
  CsrfTokenEndpoint,
  SkipCsrf,
} from '@/common/decorators/csrf-protected.decorator';
import { AuthService } from '@/auth/services/auth.service';
import { PasswordResetService } from '@/auth/services/password-reset.service';
import { SignupDto } from '@/auth/dto/signup.dto';
import { LoginDto } from '@/auth/dto/login.dto';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import { UpdatePasswordDto } from '@/auth/dto/update-password.dto';
import { Request, Response } from 'express';
import { SessionIdentifierService } from '@/common/session/session-identifier.service';
import { SessionCleanupService } from '@/common/session/session-cleanup.service';

interface RequestWithSession extends Request {
  session?: { id: string };
  user?: { id: string };
}
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  SwaggerSignup,
  SwaggerLogin,
  SwaggerLogout,
  SwaggerForgotPassword,
  SwaggerResetPassword,
} from '@/swagger/auth.swagger';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Audit } from '@/common/audit/audit.decorator';
import { getClientIp } from '@/common/http/ip.util';
import { AuditCategory, AuditSeverity } from '@/common/audit/types';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { CsrfService } from '@/common/security/csrf.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { LoggerService } from '@/common/logger.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
    private readonly csrfService: CsrfService,
    private readonly sessionIdentifierService: SessionIdentifierService,
    private readonly sessionCleanupService: SessionCleanupService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(AuthController.name);
  }

  @Get('csrf-token')
  @CsrfTokenEndpoint()
  async getCsrfToken(@Req() req: RequestWithSession) {
    const sessionId = this.sessionIdentifierService.extractSessionId(req);
    const token = await this.csrfService.generateToken(sessionId);
    return { csrfToken: token };
  }

  @Post('signup')
  @SwaggerSignup()
  @Audit({
    action: 'user.signup',
    category: AuditCategory.AUTH,
    severity: AuditSeverity.MEDIUM,
    redactRequestBodyPaths: ['password'],
    resourcesFromResult: (result) => [{ type: 'user', id: result?.id, action: 'CREATED' }],
  })
  async signup(@Body() dto: SignupDto) {
    const user = await this.authService.signup(dto.email, dto.password, dto.name, dto.orgId);
    // Return minimal user info (no passwordHash)
    return { id: user.id, email: user.email, name: user.name };
  }

  @HttpCode(200)
  @Post('login')
  @CsrfProtected()
  @SwaggerLogin()
  @Audit({
    action: 'user.login',
    category: AuditCategory.AUTH,
    severity: AuditSeverity.MEDIUM,
    redactRequestBodyPaths: ['password'],
    resourcesFromResult: (result) => [{ type: 'user', id: result?.user?.id, action: 'ACCESSED' }],
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const loginResponse = await this.authService.login(dto.email, dto.password, req);

    // Determine if we should use secure cookies
    // Use secure if in production/staging OR if request came via HTTPS (e.g., ngrok)
    const isSecure =
      ['production', 'staging'].includes(process.env.NODE_ENV || '') ||
      req.get('x-forwarded-proto') === 'https' ||
      req.protocol === 'https';

    this.logger.debug('Login cookie security check', {
      nodeEnv: process.env.NODE_ENV,
      forwardedProto: req.get('x-forwarded-proto'),
      protocol: req.protocol,
      isSecure,
      origin: req.get('origin'),
    });

    const cookieOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    this.logger.debug('Setting refresh token cookie with options', {
      isSecure,
      maxAge: cookieOptions.maxAge,
      hasRefreshToken: !!loginResponse.refreshToken,
      cookieOptions,
      refreshTokenLength: loginResponse.refreshToken?.length,
    });

    res.cookie('refreshToken', loginResponse.refreshToken, cookieOptions);

    this.logger.debug('Refresh token cookie set successfully');

    const { refreshToken: _, ...response } = loginResponse;
    return response;
  }

  @HttpCode(200)
  @Post('logout')
  @SwaggerLogout()
  @Audit({
    action: 'user.logout',
    category: AuditCategory.AUTH,
    severity: AuditSeverity.LOW,
  })
  async logout(
    @Body('refreshToken') bodyToken: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.refreshToken || bodyToken;

    // If no refresh token is provided, still perform a local logout
    // This handles cases where cookies aren't available (cross-origin with ngrok)
    // or the refresh token has already been cleared
    if (!token) {
      // Clear any existing refresh token cookie just in case
      res.clearCookie('refreshToken');

      // Also try to clean up any active session data
      try {
        const sessionId = this.sessionIdentifierService.extractSessionId(req as RequestWithSession);
        await this.sessionCleanupService.cleanupSession(sessionId);
      } catch {
        // Ignore errors during session cleanup for local logout
      }

      // Return success response for local logout
      return {
        success: true,
        message: 'Logged out successfully',
      };
    }

    const ip = getClientIp(req);
    const result = await this.authService.logout(token, ip, req);

    res.clearCookie('refreshToken');

    return result;
  }

  @Post('refresh')
  @SkipCsrf()
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Refresh an expired access token using a valid refresh token from HTTP-only cookie',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        expiresIn: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.logger.debug('Refresh endpoint called');
    this.logger.debug('All cookies received', { cookies: req.cookies });
    this.logger.debug('Cookie header', { cookieHeader: req.headers.cookie });

    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      this.logger.error('No refresh token in cookies');
      this.logger.error('Available cookies', {
        availableCookies: Object.keys(req.cookies || {}),
      });
      throw new ApiError(
        ErrorCode.UNAUTHENTICATED,
        'Refresh token is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug('Found refresh token in cookies');
    const ip = getClientIp(req);
    const tokens = await this.authService.refreshToken(refreshToken, ip);
    this.logger.debug('New tokens generated successfully');

    // Set new refresh token cookie with consistent settings
    const isSecure =
      ['production', 'staging'].includes(process.env.NODE_ENV || '') ||
      req.get('x-forwarded-proto') === 'https' ||
      req.protocol === 'https';

    const cookieOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

    // Return only access token (refresh token is in HTTP-only cookie)
    const { refreshToken: _, ...response } = tokens;
    return response;
  }

  @Post('forgot-password')
  @UseGuards(ThrottlerGuard)
  @SwaggerForgotPassword()
  @Audit({
    action: 'password.reset.requested',
    category: AuditCategory.AUTH,
    severity: AuditSeverity.MEDIUM,
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const ip = getClientIp(req);
    await this.passwordResetService.createPasswordResetToken(dto.email, ip);

    return {
      message: 'Password reset link has been sent to your email.',
      success: true,
    };
  }

  @Post('reset-password')
  @SwaggerResetPassword()
  @Audit({
    action: 'password.reset.completed',
    category: AuditCategory.AUTH,
    severity: AuditSeverity.HIGH,
    redactRequestBodyPaths: ['password'],
  })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const ip = getClientIp(req);
    await this.passwordResetService.resetPassword(dto.token, dto.password, dto.email, ip);

    return {
      message: 'Password has been successfully reset.',
      success: true,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async getCurrentUser(
    @CurrentUser('userId') userId: string,
    @CurrentUser('orgId') orgId: string | null,
  ) {
    const userData = await this.authService.getCurrentUser(userId, orgId);
    return { user: userData };
  }

  @Put('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @CsrfProtected()
  @Audit({
    action: 'password.updated',
    category: AuditCategory.AUTH,
    severity: AuditSeverity.MEDIUM,
    redactRequestBodyPaths: ['currentPassword', 'newPassword'],
    resourcesFromRequest: (req) => [{ type: 'user', id: req.user?.userId, action: 'UPDATED' }],
  })
  async updatePassword(
    @Body() dto: UpdatePasswordDto,
    @CurrentUser('userId') userId: string,
    @Req() req: Request,
  ) {
    const ip = getClientIp(req);
    await this.authService.updatePassword(userId, dto.currentPassword, dto.newPassword, ip);

    return {
      message: 'Password has been successfully updated.',
      success: true,
    };
  }
}
