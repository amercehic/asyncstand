import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UserUtilsService } from '@/auth/services/user-utils.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditActorType, AuditCategory, AuditSeverity } from '@/common/audit/types';
import { OrgRole, OrgMemberStatus, User } from '@prisma/client';

export interface CreateUserOptions {
  email: string;
  name?: string;
  password?: string;
  isTemporary?: boolean; // For invite placeholders
}

export interface CreateUserWithOrgOptions extends CreateUserOptions {
  orgId: string;
  role: OrgRole;
  status: OrgMemberStatus;
  inviteToken?: string;
  invitedAt?: Date;
  invitedById?: string;
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userUtilsService: UserUtilsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Create a user with optional organization membership
   */
  async createUserWithOrganization(options: CreateUserWithOrgOptions): Promise<User> {
    const {
      email,
      name,
      password,
      isTemporary,
      orgId,
      role,
      status,
      inviteToken,
      invitedAt,
      invitedById,
    } = options;

    let passwordHash: string;
    if (isTemporary) {
      passwordHash = 'temp_hash';
    } else if (password) {
      passwordHash = await this.userUtilsService.hashPassword(password);
    } else {
      throw new Error('Password is required for non-temporary users');
    }

    const finalName = name || (isTemporary ? email.split('@')[0] : undefined);

    return await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: finalName,
        },
      });

      // Create org membership
      await tx.orgMember.create({
        data: {
          orgId,
          userId: user.id,
          role,
          status,
          inviteToken,
          invitedAt,
          invitedById,
        },
      });

      return user;
    });
  }

  /**
   * Create a new organization with owner
   */
  async createUserWithNewOrganization(
    email: string,
    password: string,
    name?: string,
    orgName?: string,
  ): Promise<{
    user: User;
    org: { id: string; name: string };
  }> {
    const passwordHash = await this.userUtilsService.hashPassword(password);
    const organizationName = orgName || `${name || email}'s Organization`;

    const result = await this.prisma.$transaction(async (tx) => {
      // Create new organization
      const org = await tx.organization.create({
        data: {
          name: organizationName,
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
          role: OrgRole.owner,
          status: OrgMemberStatus.active,
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

    return result;
  }

  /**
   * Add user to existing organization
   */
  async addUserToOrganization(
    email: string,
    password: string,
    name: string | undefined,
    orgId: string,
    role: OrgRole = OrgRole.member,
  ): Promise<User> {
    const passwordHash = await this.userUtilsService.hashPassword(password);

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
        role,
        status: OrgMemberStatus.active,
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
}
