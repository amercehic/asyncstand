import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditActorType, AuditCategory, AuditSeverity, ResourceAction } from '@/common/audit/types';
import { OrgRole } from '@prisma/client';
import { UpdateOrganizationDto } from '@/auth/dto/update-organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.logger.setContext(OrganizationService.name);
  }

  async updateOrganizationName(orgId: string, actorUserId: string, dto: UpdateOrganizationDto) {
    // Verify the user has permission to update the organization
    const member = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: actorUserId,
        },
      },
      include: {
        org: true,
        user: true,
      },
    });

    if (!member) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'User is not a member of this organization',
        HttpStatus.FORBIDDEN,
      );
    }

    // Only owners can update organization name
    if (member.role !== OrgRole.owner) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'Only organization owners can update organization name',
        HttpStatus.FORBIDDEN,
      );
    }

    // Get the current organization data for audit logging
    const currentOrg = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!currentOrg) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Organization not found', HttpStatus.NOT_FOUND);
    }

    // Update the organization name
    const updatedOrg = await this.prisma.organization.update({
      where: { id: orgId },
      data: { name: dto.name },
    });

    // Log the audit event
    await this.auditLogService.log({
      orgId,
      actorUserId,
      actorType: AuditActorType.USER,
      action: 'organization_name_updated',
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.LOW,
      resources: [
        {
          type: 'organization',
          id: orgId,
          action: ResourceAction.UPDATED,
          previousValues: { name: currentOrg.name },
          newValues: { name: dto.name },
        },
      ],
      requestData: {
        method: 'PATCH',
        path: `/org`,
        body: dto,
        ipAddress: 'unknown', // Will be provided by the controller
      },
    });

    this.logger.info(
      `Organization name updated: ${currentOrg.name} -> ${dto.name} by user ${actorUserId}`,
    );

    return {
      id: updatedOrg.id,
      name: updatedOrg.name,
    };
  }

  async getOrganization(orgId: string, actorUserId: string) {
    // Verify the user has access to the organization
    const member = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: actorUserId,
        },
      },
      include: {
        org: true,
      },
    });

    if (!member) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'User is not a member of this organization',
        HttpStatus.FORBIDDEN,
      );
    }

    return {
      id: member.org.id,
      name: member.org.name,
    };
  }
}
