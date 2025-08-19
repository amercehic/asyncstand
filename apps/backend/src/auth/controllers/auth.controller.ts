import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CsrfProtected, CsrfTokenEndpoint } from '@/common/decorators/csrf-protected.decorator';
import { AuthService } from '@/auth/services/auth.service';
import { PasswordResetService } from '@/auth/services/password-reset.service';
import { SignupDto } from '@/auth/dto/signup.dto';
import { LoginDto } from '@/auth/dto/login.dto';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import { Request, Response } from 'express';

interface RequestWithSession extends Request {
  session?: { id: string };
  user?: { id: string };
}
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { ApiTags } from '@nestjs/swagger';
import {
  SwaggerSignup,
  SwaggerLogin,
  SwaggerLogout,
  SwaggerForgotPassword,
  SwaggerResetPassword,
} from '@/swagger/auth.swagger';
import { AuditCategory, AuditSeverity } from '@/common/audit/types';
import { AuditableController, AuditLog } from '@/common/audit/decorators';
import { CsrfService } from '@/common/security/csrf.service';

@ApiTags('Authentication')
@AuditableController({
  defaultCategory: AuditCategory.AUTH,
  defaultSeverity: AuditSeverity.MEDIUM,
})
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
    private readonly csrfService: CsrfService,
  ) {}

  @Get('csrf-token')
  @CsrfTokenEndpoint()
  async getCsrfToken(@Req() req: RequestWithSession) {
    // Extract session ID using the same approach as CSRF guard
    const sessionHeader = req.headers['x-session-id'];
    const sessionId =
      req.session?.id ||
      (typeof sessionHeader === 'string' ? sessionHeader : sessionHeader?.[0]) ||
      req.user?.id ||
      'anonymous';

    const token = await this.csrfService.generateToken(sessionId);
    return { csrfToken: token };
  }

  @Post('signup')
  @SwaggerSignup()
  @AuditLog({
    action: 'user.signup',
    category: AuditCategory.AUTH,
    severity: AuditSeverity.MEDIUM,
    sanitizeFields: ['password'],
    resources: [{ type: 'user', idFrom: 'result.id' }],
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
  @AuditLog({
    action: 'user.login',
    category: AuditCategory.AUTH,
    severity: AuditSeverity.MEDIUM,
    sanitizeFields: ['password'],
    resources: [{ type: 'user', idFrom: 'result.user.id' }],
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const loginResponse = await this.authService.login(dto.email, dto.password, req);

    res.cookie('refreshToken', loginResponse.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { refreshToken: _, ...response } = loginResponse;
    return response;
  }

  @HttpCode(200)
  @Post('logout')
  @SwaggerLogout()
  @AuditLog({
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

    if (!token) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Refresh token is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await this.authService.logout(token, ip);

    res.clearCookie('refreshToken');

    return result;
  }

  @Post('forgot-password')
  @UseGuards(ThrottlerGuard)
  @SwaggerForgotPassword()
  @AuditLog({
    action: 'password.reset.requested',
    category: AuditCategory.AUTH,
    severity: AuditSeverity.MEDIUM,
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    await this.passwordResetService.createPasswordResetToken(dto.email, ip);

    return {
      message: 'Password reset link has been sent to your email.',
      success: true,
    };
  }

  @Post('reset-password')
  @SwaggerResetPassword()
  @AuditLog({
    action: 'password.reset.completed',
    category: AuditCategory.AUTH,
    severity: AuditSeverity.HIGH,
    sanitizeFields: ['password'],
  })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    await this.passwordResetService.resetPassword(dto.token, dto.password, dto.email, ip);

    return {
      message: 'Password has been successfully reset.',
      success: true,
    };
  }
}
