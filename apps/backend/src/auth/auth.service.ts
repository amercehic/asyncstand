import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import { hash, verify } from '@node-rs/argon2';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async signup(
    email: string,
    password: string,
    name?: string,
    orgId?: string,
    invitationToken?: string,
  ) {
    const passwordHash = await hash(password, {
      memoryCost: 1 << 14, // 16 MiB
      timeCost: 3,
    });

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new UnauthorizedException('User with this email already exists');
    }

    // Scenario 1: Invited user joining existing organization
    if (invitationToken) {
      // TODO: Validate invitation token and get org details
      // For now, we'll use orgId directly if provided
      if (!orgId) {
        throw new UnauthorizedException('Organization ID required for invited users');
      }

      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
        },
      });

      // Create OrgMember record
      await this.prisma.orgMember.create({
        data: {
          orgId,
          userId: user.id,
          role: 'member',
          status: 'active',
        },
      });

      // Emit audit log for invited user signup
      await this.prisma.auditLog.create({
        data: {
          orgId,
          actorUserId: user.id,
          action: 'user.signup.invited',
          payload: {
            userId: user.id,
            email: user.email,
            name: user.name,
            invitationToken,
          },
        },
      });

      return user;
    }

    // Scenario 2: Self-service signup (create new organization)
    if (!orgId) {
      // Create organization and user in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create new organization
        const org = await tx.organization.create({
          data: {
            name: `${name || email}'s Organization`,
          },
        });

        // Create user
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            name,
          },
        });

        // Create OrgMember record as owner
        await tx.orgMember.create({
          data: {
            orgId: org.id,
            userId: user.id,
            role: 'owner',
            status: 'active',
          },
        });

        // Emit audit log for self-service signup
        await tx.auditLog.create({
          data: {
            orgId: org.id,
            actorUserId: user.id,
            action: 'user.signup.self_service',
            payload: {
              userId: user.id,
              email: user.email,
              name: user.name,
              orgId: org.id,
              orgName: org.name,
            },
          },
        });

        return { user, org };
      });

      return result.user;
    }

    // Scenario 3: User joining specific organization (if orgId provided)
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

    // Create OrgMember record
    await this.prisma.orgMember.create({
      data: {
        orgId,
        userId: user.id,
        role: 'member',
        status: 'active',
      },
    });

    // Emit audit log for direct org join
    await this.prisma.auditLog.create({
      data: {
        orgId,
        actorUserId: user.id,
        action: 'user.signup.direct_join',
        payload: {
          userId: user.id,
          email: user.email,
          name: user.name,
        },
      },
    });

    return user;
  }

  async login(email: string, password: string, req: Request) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        orgMembers: {
          where: { status: 'active' },
          include: { org: true },
        },
      },
    });
    if (!user || !(await verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Get user's primary organization (first active org)
    const primaryOrg = user.orgMembers[0]?.org;
    if (!primaryOrg) {
      throw new UnauthorizedException('User is not a member of any active organization');
    }

    // Generate access token (JWT)
    const payload = { sub: user.id, orgId: primaryOrg.id };
    const accessToken = this.jwt.sign(payload);

    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Generate refresh token
    const refreshToken = await this.prisma.refreshToken.create({
      data: {
        token: this.jwt.sign({ sub: user.id }, { expiresIn: '7d' }),
        user: { connect: { id: user.id } },
        ipAddress: ip,
        fingerprint: '1234567890',
      },
    });

    // Emit audit log for login
    await this.prisma.auditLog.create({
      data: {
        orgId: primaryOrg.id,
        actorUserId: user.id,
        action: 'user.login',
        payload: {
          userId: user.id,
          email: user.email,
          ipAddress: ip,
        },
      },
    });

    return {
      accessToken,
      refreshToken: refreshToken.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async logout(token: string, ip: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token },
      data: { revokedAt: new Date() },
    });
    // Emit audit log for logout
    await this.prisma.auditLog.create({
      data: {
        org: undefined,
        action: 'user.logout',
        payload: {
          token,
          ipAddress: ip,
        },
      },
    });
    return { success: true };
  }
}
