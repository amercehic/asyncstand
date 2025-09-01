import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditActorType, AuditCategory, AuditSeverity, ResourceAction } from '@/common/audit/types';
import { OrgRole } from '@prisma/client';
import { UpdateOrganizationDto } from '@/auth/dto/update-organization.dto';
import { CacheService } from '@/common/cache/cache.service';
import { Cacheable } from '@/common/cache/decorators/cacheable.decorator';

@Injectable()
export class OrganizationService {
  constructor(
    private prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly cacheService: CacheService,
  ) {
    this.logger.setContext(OrganizationService.name);
  }

  async updateOrganizationName(orgId: string, actorUserId: string, dto: UpdateOrganizationDto) {
    // Verify the user has permission to update the organization
    const member = await this.getOrgMemberWithCache(orgId, actorUserId);

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
    const currentOrg = await this.findById(orgId);

    if (!currentOrg) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Organization not found', HttpStatus.NOT_FOUND);
    }

    // Update the organization name
    const updatedOrg = await this.prisma.organization.update({
      where: { id: orgId },
      data: { name: dto.name },
    });

    // Invalidate related caches
    await this.invalidateOrganizationCaches(orgId);

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
      createdAt: updatedOrg.createdAt,
      updatedAt: updatedOrg.updatedAt,
    };
  }

  async getOrganization(orgId: string, actorUserId: string) {
    // Verify the user has access to the organization
    const member = await this.getOrgMemberWithCache(orgId, actorUserId);

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
      createdAt: member.org.createdAt,
      updatedAt: member.org.updatedAt,
    };
  }

  /**
   * Find organization by ID with caching
   */
  @Cacheable('org', 1800) // 30 minutes
  async findById(orgId: string, includeMembers = false) {
    const cacheKey = this.cacheService.buildKey('org', orgId, includeMembers.toString());

    return this.cacheService.getOrSet(
      cacheKey,
      () =>
        this.prisma.organization.findUnique({
          where: { id: orgId },
          include: includeMembers
            ? {
                members: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
              }
            : undefined,
        }),
      1800, // 30 minutes
    );
  }

  /**
   * Get organization member with caching
   */
  @Cacheable('org-member', 900) // 15 minutes
  async getOrgMemberWithCache(orgId: string, userId: string) {
    const cacheKey = this.cacheService.buildKey('org-member', orgId, userId);

    return this.cacheService.getOrSet(
      cacheKey,
      () =>
        this.prisma.orgMember.findUnique({
          where: {
            orgId_userId: {
              orgId,
              userId,
            },
          },
          include: {
            org: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
      900, // 15 minutes
    );
  }

  /**
   * Get organization members with pagination and caching
   */
  async getOrganizationMembers(orgId: string, page = 1, limit = 20, includeInactive = false) {
    const cacheKey = this.cacheService.buildKey(
      'org-members',
      orgId,
      page.toString(),
      limit.toString(),
      includeInactive.toString(),
    );

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const skip = (page - 1) * limit;

        const whereClause = {
          orgId,
          ...(includeInactive ? {} : { status: 'active' as const }),
        };

        const [members, totalCount] = await Promise.all([
          this.prisma.orgMember.findMany({
            where: whereClause,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            skip,
            take: limit,
            orderBy: { acceptedAt: 'desc' },
          }),
          this.prisma.orgMember.count({ where: whereClause }),
        ]);

        return {
          members,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: page,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1,
        };
      },
      600, // 10 minutes
    );
  }

  /**
   * Invalidate organization-related caches
   */
  private async invalidateOrganizationCaches(orgId: string) {
    await Promise.all([
      this.cacheService.invalidate(`org:${orgId}:*`),
      this.cacheService.invalidate(`org-member:${orgId}:*`),
      this.cacheService.invalidate(`org-members:${orgId}:*`),
    ]);

    this.logger.debug(`Invalidated caches for organization ${orgId}`);
  }

  /**
   * Invalidate user-specific organization caches
   */
  async invalidateUserOrganizationCaches(userId: string) {
    await this.cacheService.invalidate(`org-member:*:${userId}`);
    this.logger.debug(`Invalidated organization caches for user ${userId}`);
  }
}
