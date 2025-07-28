import { Injectable, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import { verify } from '@node-rs/argon2';
import { JwtService } from '@nestjs/jwt';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditActorType, AuditCategory, AuditSeverity } from '@/common/audit/types';
import { UserUtilsService } from '@/user/services/user-utils.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly userUtilsService: UserUtilsService,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async signup(email: string, password: string, name?: string, orgId?: string) {
    const passwordHash = await this.userUtilsService.hashPassword(password);

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ApiError(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'User with this email already exists',
        HttpStatus.CONFLICT,
      );
    }

    // Scenario 1: Self-service signup (create new organization)
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
            role: OrgRole.OWNER,
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

    // Scenario 2: User joining specific organization (if orgId provided)
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
        role: OrgRole.MEMBER,
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
          orderBy: { org: { name: 'asc' } }, // Order by organization name
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

    if (user.orgMembers.length === 0) {
      throw new ApiError(
        ErrorCode.NO_ACTIVE_ORGANIZATION,
        'User is not a member of any active organization',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Find primary organization (where user is OWNER)
    const primaryOrgMember = user.orgMembers.find((member) => member.role === 'OWNER');
    const primaryOrg = primaryOrgMember?.org || user.orgMembers[0]?.org;
    const userRole = primaryOrgMember?.role || user.orgMembers[0]?.role;

    // Sort organizations by role priority (OWNER first, then ADMIN, then MEMBER)
    const rolePriority = { OWNER: 3, ADMIN: 2, MEMBER: 1, SUSPENDED: 0 };
    const sortedOrgMembers = user.orgMembers.sort((a, b) => {
      const priorityDiff = rolePriority[b.role] - rolePriority[a.role];
      if (priorityDiff !== 0) return priorityDiff;
      // If same role, sort by organization name
      return a.org.name.localeCompare(b.org.name);
    });

    // Generate access token (JWT) with 15 minutes expiry
    const payload = { sub: user.id, orgId: primaryOrg.id };
    const accessToken = this.jwt.sign(payload, { expiresIn: '15m' });

    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Generate refresh token with 7 days expiry and unique identifier
    const refreshTokenValue = this.jwt.sign(
      { sub: user.id, jti: `${user.id}-${Date.now()}-${Math.random()}` },
      { expiresIn: '7d' },
    );

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

    // Build organizations list (using sorted members)
    const organizations = sortedOrgMembers.map((member) => ({
      id: member.org.id,
      name: member.org.name,
      role: member.role,
      isPrimary: member.org.id === primaryOrg.id,
    }));

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
      organizations, // List of all organizations user belongs to
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
