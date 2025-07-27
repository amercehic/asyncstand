import { Controller, Post, Body, Req, Res, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from '@/auth/services/auth.service';
import { PasswordResetService } from '@/auth/services/password-reset.service';
import { SignupDto } from '@/auth/dto/signup.dto';
import { LoginDto } from '@/auth/dto/login.dto';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import { Request, Response } from 'express';
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

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('signup')
  @SwaggerSignup()
  async signup(@Body() dto: SignupDto) {
    const user = await this.authService.signup(dto.email, dto.password, dto.name, dto.orgId);
    // Return minimal user info (no passwordHash)
    return { id: user.id, email: user.email, name: user.name };
  }

  @HttpCode(200)
  @Post('login')
  @SwaggerLogin()
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

    const { ...response } = loginResponse;
    return response;
  }

  @HttpCode(200)
  @Post('logout')
  @SwaggerLogout()
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
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    await this.passwordResetService.resetPassword(dto.token, dto.password, dto.email, ip);

    return {
      message: 'Password has been successfully reset.',
      success: true,
    };
  }
}
