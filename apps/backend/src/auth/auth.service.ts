import { Injectable, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import { hash, verify } from '@node-rs/argon2';
import { JwtService } from '@nestjs/jwt';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditActorType, AuditCategory, AuditSeverity } from '@/common/audit/types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.logger.setContext(AuthService.name);
  }

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
      throw new ApiError(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'User with this email already exists',
        HttpStatus.CONFLICT,
      );
    }

    // Scenario 1: Invited user joining existing organization
    if (invitationToken) {
      // TODO: Validate invitation token and get org details
      // For now, we'll use orgId directly if provided
      if (!orgId) {
        throw new ApiError(
          ErrorCode.ORG_ID_REQUIRED,
          'Organization ID required for invited users',
          HttpStatus.BAD_REQUEST,
        );
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
      await this.auditLogService.log({
        orgId,
        actorUserId: user.id,
        actorType: AuditActorType.USER,
        action: 'user.signup.invited',
        category: AuditCategory.AUTH,
        severity: AuditSeverity.MEDIUM,
        requestData: {
          method: 'POST',
          path: '/auth/signup',
          ipAddress: 'unknown',
          body: {
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
            role: 'OWNER',
            status: 'active',
          },
        });

        // Emit audit log for self-service signup
        await this.auditLogService.logWithTransaction(
          {
            orgId: org.id,
            actorUserId: user.id,
            actorType: AuditActorType.USER,
            action: 'user.signup.self_service',
            category: AuditCategory.AUTH,
            severity: AuditSeverity.MEDIUM,
            requestData: {
              method: 'POST',
              path: '/auth/signup',
              ipAddress: 'unknown',
              body: {
                email: user.email,
                name: user.name,
                orgName: org.name,
              },
            },
          },
          tx,
        );

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
    await this.auditLogService.log({
      orgId,
      actorUserId: user.id,
      actorType: AuditActorType.USER,
      action: 'user.signup.direct_join',
      category: AuditCategory.AUTH,
      severity: AuditSeverity.MEDIUM,
      requestData: {
        method: 'POST',
        path: '/auth/signup',
        ipAddress: 'unknown',
        body: {
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
      throw new ApiError(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Get user's primary organization (first active org)
    const primaryOrg = user.orgMembers[0]?.org;
    const userRole = user.orgMembers[0]?.role;
    if (!primaryOrg) {
      throw new ApiError(
        ErrorCode.NO_ACTIVE_ORGANIZATION,
        'User is not a member of any active organization',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Generate access token (JWT) with 15 minutes expiry
    const payload = { sub: user.id, orgId: primaryOrg.id };
    const accessToken = this.jwt.sign(payload, { expiresIn: '15m' });

    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Generate refresh token with 7 days expiry
    const refreshTokenValue = this.jwt.sign({ sub: user.id }, { expiresIn: '7d' });

    const refreshToken = await this.prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
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
        actorType: 'user',
        action: 'user.login',
        category: 'auth',
        severity: 'medium',
        requestData: {
          method: 'POST',
          path: '/auth/login',
          ipAddress: ip,
          body: {
            email: user.email,
          },
        },
      },
    });

    return {
      accessToken,
      expiresIn: 900, // 15 minutes in seconds
      refreshToken: refreshToken.token, // Needed by controller to set cookie
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: userRole,
      },
      organization: {
        id: primaryOrg.id,
        name: primaryOrg.name,
      },
    };
  }

  async logout(token: string, ip: string) {
    // Find the refresh token and get user with org membership
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            orgMembers: {
              where: { status: 'active' },
              include: { org: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!refreshToken) {
      throw new ApiError(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Revoke the refresh token
    await this.prisma.refreshToken.updateMany({
      where: { token },
      data: { revokedAt: new Date() },
    });

    // Emit audit log for logout - only if we have an orgId
    const primaryOrg = refreshToken.user?.orgMembers[0]?.org;
    if (primaryOrg && refreshToken.userId) {
      await this.prisma.auditLog.create({
        data: {
          orgId: primaryOrg.id,
          actorUserId: refreshToken.userId,
          actorType: 'user',
          action: 'user.logout',
          category: 'auth',
          severity: 'low',
          requestData: {
            method: 'POST',
            path: '/auth/logout',
            ipAddress: ip,
            body: {
              refreshTokenId: refreshToken.id,
            },
          },
        },
      });
    }

    return { success: true };
  }
}
