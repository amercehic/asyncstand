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
import { UserUtilsService } from '@/auth/services/user-utils.service';
import { TokenService } from '@/auth/services/token.service';
import { UserService } from '@/auth/services/user.service';
import { OrgRole, OrgMemberStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly userUtilsService: UserUtilsService,
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async signup(email: string, password: string, name?: string, orgId?: string) {
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
      const result = await this.userService.createUserWithNewOrganization(email, password, name);
      return result.user;
    }

    // Scenario 2: User joining specific organization (if orgId provided)
    return await this.userService.addUserToOrganization(email, password, name, orgId);
  }

  async login(email: string, password: string, req: Request) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        orgMembers: {
          where: { status: OrgMemberStatus.active },
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

    // Find primary organization (where user is owner)
    const primaryOrgMember = user.orgMembers.find((member) => member.role === OrgRole.owner);
    const primaryOrg = primaryOrgMember?.org || user.orgMembers[0]?.org;
    const userRole = primaryOrgMember?.role || user.orgMembers[0]?.role;

    // Sort organizations by role priority (owner first, then admin, then member)
    const rolePriority = { owner: 3, admin: 2, member: 1 };
    const sortedOrgMembers = user.orgMembers.sort((a, b) => {
      const priorityDiff = rolePriority[b.role] - rolePriority[a.role];
      if (priorityDiff !== 0) return priorityDiff;
      // If same role, sort by organization name
      return (a.org.name || '').localeCompare(b.org.name || '');
    });

    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Generate tokens using TokenService
    const tokens = await this.tokenService.generateTokens(user.id, primaryOrg.id, ip);

    // Emit audit log for login
    await this.prisma.auditLog.create({
      data: {
        orgId: primaryOrg.id,
        actorUserId: user.id,
        actorType: AuditActorType.USER,
        action: 'user.login',
        category: AuditCategory.AUTH,
        severity: AuditSeverity.MEDIUM,
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
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      refreshToken: tokens.refreshToken,
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
              where: { status: OrgMemberStatus.active },
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

    // Revoke the refresh token using TokenService
    await this.tokenService.revokeRefreshToken(token);

    // Emit audit log for logout - only if we have an orgId
    const primaryOrg = refreshToken.user?.orgMembers[0]?.org;
    if (primaryOrg && refreshToken.userId) {
      await this.prisma.auditLog.create({
        data: {
          orgId: primaryOrg.id,
          actorUserId: refreshToken.userId,
          actorType: AuditActorType.USER,
          action: 'user.logout',
          category: AuditCategory.AUTH,
          severity: AuditSeverity.LOW,
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

  async acceptInvite(
    inviteToken: string,
    name?: string,
    password?: string,
    ipAddress: string = 'unknown',
  ) {
    // Hash the invite token to find the invitation
    const inviteTokenHash = await this.hashToken(inviteToken);

    // Find the invitation
    const orgMember = await this.prisma.orgMember.findUnique({
      where: { inviteToken: inviteTokenHash },
      include: { org: true, user: true },
    });

    if (!orgMember) {
      throw new ApiError(ErrorCode.FORBIDDEN, 'Invalid invitation token', HttpStatus.BAD_REQUEST);
    }

    if (orgMember.status !== OrgMemberStatus.invited) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'Invitation has already been accepted or is no longer valid',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if token is expired (7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (orgMember.invitedAt && orgMember.invitedAt < sevenDaysAgo) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'Invitation token has expired',
        HttpStatus.BAD_REQUEST,
      );
    }

    const userId = orgMember.userId;
    let userName = orgMember.user.name;

    // Check if this is a new user (has temp_hash password) or existing user
    const isNewUser = orgMember.user.passwordHash === 'temp_hash';

    if (isNewUser) {
      // New user - password is required
      if (!password) {
        throw new ApiError(
          ErrorCode.VALIDATION_FAILED,
          'Password is required for new users',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Update user with real password and name
      const passwordHash = await this.userUtilsService.hashPassword(password);
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          name: name || orgMember.user.name,
        },
      });

      userName = name || orgMember.user.name;
    } else {
      // Existing user - password not needed, but can update name if provided
      if (name) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { name },
        });
        userName = name;
      }
    }

    // Activate the membership
    await this.prisma.orgMember.update({
      where: { inviteToken: inviteTokenHash },
      data: {
        status: OrgMemberStatus.active,
        acceptedAt: new Date(),
        inviteToken: null, // Clear the token
      },
    });

    // Generate tokens
    const tokens = await this.tokenService.generateTokens(userId, orgMember.orgId, ipAddress);

    // Log audit event
    await this.auditLogService.log({
      action: isNewUser ? 'user.invite.accepted.new' : 'user.invite.accepted.existing',
      actorUserId: userId,
      orgId: orgMember.orgId,
      actorType: AuditActorType.USER,
      category: AuditCategory.AUTH,
      severity: AuditSeverity.MEDIUM,
      requestData: {
        method: 'POST',
        path: '/org/members/accept',
        ipAddress,
        body: {
          userId,
          role: orgMember.role,
          name: userName,
          isNewUser,
        },
      },
    });

    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      refreshToken: tokens.refreshToken,
      user: {
        id: userId,
        email: orgMember.user.email,
        name: userName,
        role: orgMember.role,
      },
      organization: {
        id: orgMember.org.id,
        name: orgMember.org.name,
      },
    };
  }

  private async hashToken(token: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
