import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditActorType, AuditCategory, AuditSeverity } from '@/common/audit/types';
import { InviteMemberDto } from '@/auth/dto/invite-member.dto';
import { UpdateMemberDto } from '@/auth/dto/update-member.dto';
import { OrgRole, OrgMemberStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { UserUtilsService } from '@/auth/services/user-utils.service';
import { UserService } from '@/auth/services/user.service';

@Injectable()
export class OrgMembersService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly userUtilsService: UserUtilsService,
    private readonly userService: UserService,
  ) {
    this.logger.setContext(OrgMembersService.name);
  }

  async listMembers(orgId: string) {
    const members = await this.prisma.orgMember.findMany({
      where: { orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { acceptedAt: 'asc' },
    });

    return {
      members: members.map((member) => ({
        id: member.userId,
        email: member.user.email,
        name: member.user.name,
        role: member.role,
        status: member.status,
        joinedAt: member.acceptedAt,
      })),
    };
  }

  async inviteMember(orgId: string, actorUserId: string, dto: InviteMemberDto) {
    // Check if actor has permission to invite (OWNER or ADMIN)
    const actorMember = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: actorUserId,
        },
      },
    });

    if (!actorMember || actorMember.status !== OrgMemberStatus.active) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'You are not a member of this organization',
        HttpStatus.FORBIDDEN,
      );
    }

    if (actorMember.role !== OrgRole.owner && actorMember.role !== OrgRole.admin) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'Only owners and admins can invite members',
        HttpStatus.FORBIDDEN,
      );
    }

    // Check if user already exists and is already a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        orgMembers: {
          where: { orgId },
        },
      },
    });

    if (existingUser?.orgMembers && existingUser.orgMembers.length > 0) {
      const existingMember = existingUser.orgMembers[0];
      if (existingMember.status === OrgMemberStatus.active) {
        throw new ApiError(
          ErrorCode.CONFLICT,
          'User is already an active member of this organization',
          HttpStatus.CONFLICT,
        );
      }
    }

    // Generate invite token
    const inviteToken = randomBytes(32).toString('hex');
    const inviteTokenHash = await this.hashToken(inviteToken);

    // Create or update OrgMember record
    if (existingUser) {
      // Existing user - create/update invitation
      await this.prisma.orgMember.upsert({
        where: {
          orgId_userId: {
            orgId,
            userId: existingUser.id,
          },
        },
        update: {
          role: dto.role,
          status: OrgMemberStatus.invited,
          inviteToken: inviteTokenHash,
          invitedAt: new Date(),
        },
        create: {
          orgId,
          userId: existingUser.id,
          role: dto.role,
          status: OrgMemberStatus.invited,
          inviteToken: inviteTokenHash,
          invitedAt: new Date(),
        },
      });
    } else {
      // New user - create placeholder user that will be completed on invite acceptance
      await this.userService.createUserWithOrganization({
        email: dto.email,
        isTemporary: true,
        orgId,
        role: dto.role,
        status: OrgMemberStatus.invited,
        inviteToken: inviteTokenHash,
        invitedAt: new Date(),
      });
    }

    // Log audit event
    await this.auditLogService.log({
      action: 'org.member.invited',
      actorUserId,
      orgId,
      actorType: AuditActorType.USER,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.MEDIUM,
      requestData: {
        method: 'POST',
        path: '/org-members/invite',
        ipAddress: 'unknown',
        body: {
          email: dto.email,
          role: dto.role,
        },
      },
    });

    // TODO: Send email with invite token
    this.logger.info(`Invitation sent to ${dto.email} for org ${orgId}`);

    return {
      message: 'Invitation sent successfully',
      invitedEmail: dto.email,
      inviteToken: inviteToken, // TODO: For production, send token via email instead of returning in response
    };
  }

  async updateMember(orgId: string, actorUserId: string, memberId: string, dto: UpdateMemberDto) {
    // Check if actor has permission to update members
    const actorMember = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: actorUserId,
        },
      },
    });

    if (!actorMember || actorMember.status !== OrgMemberStatus.active) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'You are not a member of this organization',
        HttpStatus.FORBIDDEN,
      );
    }

    // Find the member to update
    const targetMember = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: memberId,
        },
      },
      include: { user: true },
    });

    if (!targetMember) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Member not found', HttpStatus.NOT_FOUND);
    }

    // Permission checks
    if (targetMember.role === OrgRole.owner) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'Cannot modify organization owner',
        HttpStatus.FORBIDDEN,
      );
    }

    if (actorMember.role !== OrgRole.owner && targetMember.role === OrgRole.admin) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'Only owners can modify admins',
        HttpStatus.FORBIDDEN,
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    if (dto.role) {
      updateData.role = dto.role; // Keep the enum value as is
    }
    if (dto.suspend !== undefined) {
      updateData.status = dto.suspend ? OrgMemberStatus.suspended : OrgMemberStatus.active;
    }

    // Update the member
    const updatedMember = await this.prisma.orgMember.update({
      where: {
        orgId_userId: {
          orgId,
          userId: memberId,
        },
      },
      data: updateData,
      include: { user: true },
    });

    // If suspending, invalidate all sessions for that user in this org
    if (dto.suspend) {
      await this.invalidateUserSessions(memberId);
    }

    // Log audit event
    await this.auditLogService.log({
      action: 'org.member.updated',
      actorUserId,
      orgId,
      actorType: AuditActorType.USER,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.MEDIUM,
      requestData: {
        method: 'PUT',
        path: `/org-members/${memberId}`,
        ipAddress: 'unknown',
        body: {
          targetUserId: memberId,
          targetEmail: targetMember.user.email,
          changes: updateData,
        },
      },
    });

    return {
      message: 'Member updated successfully',
      member: {
        id: updatedMember.userId,
        email: updatedMember.user.email,
        role: updatedMember.role,
        status: updatedMember.status,
      },
    };
  }

  async deleteMember(orgId: string, actorUserId: string, memberId: string) {
    // Check if actor has permission to delete members
    const actorMember = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: actorUserId,
        },
      },
    });

    if (!actorMember || actorMember.status !== OrgMemberStatus.active) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'You are not a member of this organization',
        HttpStatus.FORBIDDEN,
      );
    }

    // Find the member to delete
    const targetMember = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: memberId,
        },
      },
      include: { user: true },
    });

    if (!targetMember) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Member not found', HttpStatus.NOT_FOUND);
    }

    // Check if this is the last admin/owner (do this before other permission checks)
    if (targetMember.role === OrgRole.owner || targetMember.role === OrgRole.admin) {
      const adminCount = await this.prisma.orgMember.count({
        where: {
          orgId,
          role: { in: [OrgRole.owner, OrgRole.admin] },
          status: OrgMemberStatus.active,
        },
      });

      if (adminCount <= 1) {
        throw new ApiError(
          ErrorCode.FORBIDDEN,
          'Cannot delete the last admin or owner of the organization',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Permission checks
    if (targetMember.role === OrgRole.owner) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'Cannot delete organization owner',
        HttpStatus.FORBIDDEN,
      );
    }

    if (actorMember.role !== OrgRole.owner && targetMember.role === OrgRole.admin) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'Only owners can delete admins',
        HttpStatus.FORBIDDEN,
      );
    }

    // Delete the member
    await this.prisma.orgMember.delete({
      where: {
        orgId_userId: {
          orgId,
          userId: memberId,
        },
      },
    });

    // Invalidate all sessions for that user in this org
    await this.invalidateUserSessions(memberId);

    // Log audit event
    await this.auditLogService.log({
      action: 'org.member.deleted',
      actorUserId,
      orgId,
      actorType: AuditActorType.USER,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.HIGH,
      requestData: {
        method: 'DELETE',
        path: `/org-members/${memberId}`,
        ipAddress: 'unknown',
        body: {
          targetUserId: memberId,
          targetEmail: targetMember.user.email,
          targetRole: targetMember.role,
        },
      },
    });

    return {
      message: 'Member deleted successfully',
    };
  }

  private async hashToken(token: string): Promise<string> {
    // In production, use a proper hashing library like bcrypt or argon2
    // For now, using a simple hash for demonstration
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async invalidateUserSessions(userId: string) {
    // Invalidate all sessions for the user
    await this.prisma.session.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    // Revoke all refresh tokens for the user
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
  }
}
