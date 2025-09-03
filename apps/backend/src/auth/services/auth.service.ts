import { Injectable, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import { verify } from '@node-rs/argon2';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditActorType, AuditCategory, AuditSeverity } from '@/common/audit/types';
import { UserUtilsService } from '@/auth/services/user-utils.service';
import { TokenService, AuthTokens } from '@/auth/services/token.service';
import { UserService } from '@/auth/services/user.service';
import { SessionIdentifierService } from '@/common/session/session-identifier.service';
import { SessionCleanupService } from '@/common/session/session-cleanup.service';
import { OrgRole, OrgMemberStatus } from '@prisma/client';
import { getClientIp } from '@/common/http/ip.util';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly userUtilsService: UserUtilsService,
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
    private readonly sessionIdentifierService: SessionIdentifierService,
    private readonly sessionCleanupService: SessionCleanupService,
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

    this.logger.debug('User found', {
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      orgMembersCount: user.orgMembers.length,
    });

    // Super admins can login without organization membership
    if (user.orgMembers.length === 0 && !user.isSuperAdmin) {
      throw new ApiError(
        ErrorCode.NO_ACTIVE_ORGANIZATION,
        'User is not a member of any active organization',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Find primary organization (where user is owner) or handle super admins
    const primaryOrgMember = user.orgMembers.find((member) => member.role === OrgRole.owner);
    const primaryOrg = primaryOrgMember?.org || user.orgMembers[0]?.org;
    const userRole = primaryOrgMember?.role || user.orgMembers[0]?.role;

    // For super admins without organizations, use null orgId and 'admin' role
    const effectiveOrgId = primaryOrg?.id || null;
    const effectiveRole = user.isSuperAdmin ? 'admin' : userRole;

    this.logger.debug('Effective auth values', {
      effectiveOrgId,
      effectiveOrgIdIsNull: effectiveOrgId === null,
      effectiveRole,
      isSuperAdmin: user.isSuperAdmin,
    });

    // Sort organizations by role priority (owner first, then admin, then member)
    const rolePriority = { owner: 3, admin: 2, member: 1 };
    const sortedOrgMembers = user.orgMembers.sort((a, b) => {
      const priorityDiff = rolePriority[b.role] - rolePriority[a.role];
      if (priorityDiff !== 0) return priorityDiff;
      // If same role, sort by organization name
      return a.org.name.localeCompare(b.org.name);
    });

    const ip = getClientIp(req);

    // Generate tokens using TokenService
    const tokens = await this.tokenService.generateTokens(
      user.id,
      effectiveOrgId,
      ip,
      effectiveRole,
    );

    // Emit audit log for login (skip for super admins without organizations)
    if (effectiveOrgId) {
      await this.prisma.auditLog.create({
        data: {
          orgId: effectiveOrgId,
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
    }

    // Build organizations list (using sorted members)
    const organizations = sortedOrgMembers.map((member) => ({
      id: member.org.id,
      name: member.org.name,
      role: member.role,
      isPrimary: member.org.id === primaryOrg?.id,
    }));

    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: effectiveRole,
        isSuperAdmin: user.isSuperAdmin,
        orgId: effectiveOrgId,
      },
      organizations, // List of all organizations user belongs to (empty for super admins without orgs)
    };
  }

  async getCurrentUser(userId: string, orgId: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    // Super admins with null orgId don't have organization membership
    let orgMember = null;
    if (orgId) {
      // Get user's role in current organization
      orgMember = await this.prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            userId,
            orgId,
          },
        },
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
      role: user.isSuperAdmin ? 'admin' : orgMember?.role || 'member',
      orgId,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async logout(token: string, ip: string, req?: Request) {
    // Hash the refresh token for database lookup
    const hashedToken = await this.hashToken(token);

    // Find the refresh token and get user with org membership
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
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

    // Revoke the refresh token using TokenService (pass the hashed token)
    await this.tokenService.revokeRefreshToken(hashedToken);

    // Clean up all session-related data
    if (refreshToken.userId) {
      try {
        const sessionIds = req
          ? this.sessionIdentifierService.getAllSessionIds(req, refreshToken.userId)
          : [`user-session:${refreshToken.userId}`];

        await this.sessionCleanupService.cleanupSessions(sessionIds);

        this.logger.info('Session cleanup completed during logout', {
          userId: refreshToken.userId,
          sessionCount: sessionIds.length,
        });
      } catch (error) {
        this.logger.warn('Session cleanup failed during logout', {
          userId: refreshToken.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't fail the logout if session cleanup fails
      }
    }

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
    const tokens = await this.tokenService.generateTokens(
      userId,
      orgMember.orgId,
      ipAddress,
      orgMember.role,
    );

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

  async updatePassword(userId: string, currentPassword: string, newPassword: string, ip: string) {
    // Get user with current password hash
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user) {
      throw new ApiError(ErrorCode.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    // Verify current password
    if (!user.passwordHash) {
      throw new ApiError(
        ErrorCode.INVALID_CREDENTIALS,
        'Current password is invalid',
        HttpStatus.BAD_REQUEST,
      );
    }

    const isCurrentPasswordValid = await verify(user.passwordHash, currentPassword);
    if (!isCurrentPasswordValid) {
      // Log audit event for failed password update attempt
      await this.auditLogService.log({
        actorUserId: userId,
        actorType: AuditActorType.USER,
        action: 'password.update.failed',
        category: AuditCategory.AUTH,
        severity: AuditSeverity.HIGH,
        requestData: {
          method: 'PUT',
          path: '/auth/password',
          ipAddress: ip,
          body: {
            reason: 'Invalid current password',
          },
        },
      });

      throw new ApiError(
        ErrorCode.INVALID_CREDENTIALS,
        'Current password is incorrect',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Hash new password
    const newPasswordHash = await this.userUtilsService.hashPassword(newPassword);

    // Update password in database
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      },
    });

    // Log successful password update
    await this.auditLogService.log({
      actorUserId: userId,
      actorType: AuditActorType.USER,
      action: 'password.updated',
      category: AuditCategory.AUTH,
      severity: AuditSeverity.MEDIUM,
      requestData: {
        method: 'PUT',
        path: '/auth/password',
        ipAddress: ip,
        body: {
          email: user.email,
        },
      },
    });

    this.logger.info(`Password updated successfully for user ${userId}`);
  }

  async refreshToken(
    refreshToken: string,
    ipAddress: string,
  ): Promise<Omit<AuthTokens, 'refreshToken'> & { refreshToken: string }> {
    this.logger.debug('Starting token refresh from IP', { ipAddress });

    const hashedToken = await this.hashToken(refreshToken);

    // Find and validate the refresh token
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: {
        user: {
          include: {
            orgMembers: {
              where: { status: OrgMemberStatus.active },
              include: { org: true },
            },
          },
        },
      },
    });

    if (!tokenRecord || tokenRecord.revokedAt) {
      this.logger.error('Token invalid or revoked', {
        found: !!tokenRecord,
        revokedAt: tokenRecord?.revokedAt,
      });
      throw new ApiError(
        ErrorCode.TOKEN_EXPIRED,
        'Invalid or expired refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Note: JWT refresh tokens have built-in expiry, no need to check expiresAt field

    const user = tokenRecord.user;

    this.logger.debug('User found', {
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      orgMembersCount: user.orgMembers.length,
    });

    // Find primary organization or handle super admins
    const primaryOrgMember = user.orgMembers.find((member) => member.role === OrgRole.owner);
    const primaryOrg = primaryOrgMember?.org || user.orgMembers[0]?.org;
    const userRole = primaryOrgMember?.role || user.orgMembers[0]?.role;

    // Super admins can refresh tokens without organization membership
    if (!primaryOrg && !user.isSuperAdmin) {
      this.logger.error('No org and not super admin, rejecting');
      throw new ApiError(
        ErrorCode.NO_ACTIVE_ORGANIZATION,
        'User has no active organization',
        HttpStatus.FORBIDDEN,
      );
    }

    // For super admins without organizations, use null orgId and 'admin' role
    const effectiveOrgId = primaryOrg?.id || null;
    const effectiveRole = user.isSuperAdmin ? 'admin' : userRole;

    this.logger.debug('Effective auth values for new tokens', {
      effectiveOrgId,
      effectiveOrgIdIsNull: effectiveOrgId === null,
      effectiveRole,
      isSuperAdmin: user.isSuperAdmin,
    });

    // Revoke old refresh token
    await this.tokenService.revokeRefreshToken(hashedToken);

    // Generate new tokens
    const tokens = await this.tokenService.generateTokens(
      user.id,
      effectiveOrgId,
      ipAddress,
      effectiveRole,
    );

    // Log audit event (skip for super admins without organizations)
    if (effectiveOrgId) {
      await this.auditLogService.log({
        action: 'token.refreshed',
        actorUserId: user.id,
        orgId: effectiveOrgId,
        actorType: AuditActorType.USER,
        category: AuditCategory.AUTH,
        severity: AuditSeverity.LOW,
        requestData: {
          method: 'POST',
          path: '/auth/refresh',
          ipAddress,
        },
      });
    }

    return tokens;
  }

  private async hashToken(token: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
