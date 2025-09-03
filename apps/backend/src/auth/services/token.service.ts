import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async generateTokens(
    userId: string,
    orgId: string,
    ipAddress: string = 'unknown',
  ): Promise<AuthTokens> {
    // Generate access token (JWT) with 15 minutes expiry
    const payload = { sub: userId, orgId };
    const accessToken = this.jwt.sign(payload, { expiresIn: '15m' });

    // Generate refresh token with 7 days expiry and unique identifier
    const refreshTokenValue = this.jwt.sign(
      { sub: userId, jti: `${userId}-${Date.now()}-${Math.random()}` },
      { expiresIn: '7d' },
    );

    // Persist refresh token
    await this.prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        user: { connect: { id: userId } },
        ipAddress,
        fingerprint: '1234567890', // Could be enhanced with actual fingerprinting
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
  }
}
