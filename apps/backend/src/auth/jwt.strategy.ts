import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { sub: string; orgId: string; role: string }) {
    const member = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          userId: payload.sub,
          orgId: payload.orgId,
        },
      },
    });
    if (!member || member.status !== 'active') {
      throw new UnauthorizedException('Invalid organization');
    }
    return { userId: payload.sub, orgId: payload.orgId, role: payload.role };
  }
}
