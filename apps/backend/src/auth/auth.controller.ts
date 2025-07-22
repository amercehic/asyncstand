import { Controller, Post, Body, Req, Res, HttpCode } from '@nestjs/common';
import { AuthService } from '@/auth/auth.service';
import { SignupDto } from '@/auth/dto/signup.dto';
import { LoginDto } from '@/auth/dto/login.dto';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    const user = await this.authService.signup(
      dto.email,
      dto.password,
      dto.name,
      dto.orgId,
      dto.invitationToken,
    );
    // Return minimal user info (no passwordHash)
    return { id: user.id, email: user.email, name: user.name };
  }

  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(
      dto.email,
      dto.password,
      req,
    );
    // Set refresh token in HttpOnly cookie (optional)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // e.g. 7 days
    });
    return { accessToken };
  }

  @HttpCode(200)
  @Post('logout')
  async logout(@Body('refreshToken') token: string, @Req() req: Request) {
    await this.authService.logout(token, req.ip);
    return { success: true };
  }
}
