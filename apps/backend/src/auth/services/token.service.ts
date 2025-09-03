import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';

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
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(TokenService.name);
  }

  async generateTokens(
    userId: string,
    orgId: string | null,
    ipAddress: string = 'unknown',
    role?: string,
  ): Promise<AuthTokens> {
    // Generate access token (JWT) with 15 minutes expiry
    const payload = { sub: userId, orgId, role: role || 'member' };

    this.logger.debug('Generating tokens with payload', {
      userId,
      orgId,
      orgIdIsNull: orgId === null,
      orgIdType: typeof orgId,
      role: role || 'member',
      ipAddress,
    });

    const accessToken = this.jwt.sign(payload, { expiresIn: '15m' });

    // Generate refresh token with 7 days expiry and unique identifier
    const refreshTokenValue = this.jwt.sign(
      { sub: userId, jti: `${userId}-${Date.now()}-${Math.random()}` },
      { expiresIn: '7d' },
    );

    // Hash and persist refresh token
    const hashedRefreshToken = await this.hashToken(refreshTokenValue);
    await this.prisma.refreshToken.create({
      data: {
        token: hashedRefreshToken,
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
    // Token should already be hashed when passed here
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

  private async hashToken(token: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
