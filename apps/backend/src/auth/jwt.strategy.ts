import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { OrgMemberStatus } from '@prisma/client';
import { LoggerService } from '@/common/logger.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
    this.logger.setContext(JwtStrategy.name);
  }

  async validate(payload: { sub: string; orgId: string | null; role?: string }) {
    this.logger.debug('Validating token payload', {
      userId: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
      isOrgIdNull: payload.orgId === null,
      orgIdType: typeof payload.orgId,
    });

    // Handle super admins with null orgId
    if (payload.orgId === null || payload.orgId === undefined) {
      this.logger.debug('Detected null/undefined orgId, checking if super admin');

      // Verify this is actually a super admin user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { isSuperAdmin: true, email: true },
      });

      this.logger.debug('User lookup result', {
        found: !!user,
        isSuperAdmin: user?.isSuperAdmin,
        email: user?.email,
      });

      if (!user?.isSuperAdmin) {
        this.logger.error('User is not a super admin, rejecting token');
        throw new UnauthorizedException('Invalid super admin token');
      }

      this.logger.debug('Super admin validated successfully');
      return {
        userId: payload.sub,
        orgId: null,
        role: 'admin', // Super admins get admin role
        isSuperAdmin: true,
      };
    }

    // Regular organization member validation
    const member = await this.prisma.orgMember.findFirst({
      where: {
        userId: payload.sub,
        orgId: payload.orgId,
      },
      include: {
        user: {
          select: {
            isSuperAdmin: true,
          },
        },
      },
    });

    if (!member || member.status !== OrgMemberStatus.active) {
      throw new UnauthorizedException('Invalid organization');
    }

    const result = {
      userId: payload.sub,
      orgId: payload.orgId,
      role: member.role, // Use the actual role from the database
      isSuperAdmin: member.user.isSuperAdmin,
    };

    return result;
  }
}
