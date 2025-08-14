import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import {
  AuditLogEntry,
  AuditLogFilter,
  PaginatedResult,
  ActivitySummary,
  SecurityEvent,
  AuditCategory,
  AuditSeverity,
} from '@/common/audit/types';
import { OrgMemberStatus } from '@prisma/client';

@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(AuditLogService.name);
  }

  async log(data: AuditLogEntry): Promise<void> {
    try {
      // If no orgId is provided, try to find the user's primary organization
      let orgId = data.orgId;

      if (!orgId && data.actorUserId) {
        const userOrg = await this.prisma.orgMember.findFirst({
          where: {
            userId: data.actorUserId,
            status: OrgMemberStatus.active,
          },
          select: {
            orgId: true,
          },
        });

        if (userOrg) {
          orgId = userOrg.orgId;
        } else {
          this.logger.warn('No active organization found for user - skipping audit log', {
            userId: data.actorUserId,
            action: data.action,
          });
          return;
        }
      }

      if (!orgId) {
        this.logger.warn('No orgId provided and unable to resolve - skipping audit log', {
          action: data.action,
          actorUserId: data.actorUserId,
        });
        return;
      }

      await this.prisma.auditLog.create({
        data: {
          orgId,
          actorUserId: data.actorUserId || null, // Explicitly set to null if undefined
          actorType: data.actorType,
          action: data.action,
          category: data.category,
          severity: data.severity,
          requestData: data.requestData ? (data.requestData as never) : undefined,
          responseData: data.responseData ? (data.responseData as never) : undefined,
          resources: data.resources ? (data.resources as never) : undefined,
          sessionId: data.sessionId,
          correlationId: data.correlationId,
          tags: data.tags || [],
          executionTime: data.executionTime,
        },
      });

      this.logger.debug('Audit log created', {
        action: data.action,
        category: data.category,
        severity: data.severity,
        orgId,
        actorUserId: data.actorUserId,
        correlationId: data.correlationId,
      });
    } catch (error) {
      this.logger.logError(error as Error, {
        context: 'audit log creation',
        action: data.action,
        actorUserId: data.actorUserId,
        orgId: data.orgId,
      });
      // Don't throw error to avoid breaking the main flow
    }
  }

  async logWithTransaction(data: AuditLogEntry, tx: unknown): Promise<void> {
    try {
      const transaction = tx as typeof this.prisma;

      // If no orgId is provided, try to find the user's primary organization
      let orgId = data.orgId;

      if (!orgId && data.actorUserId) {
        const userOrg = await transaction.orgMember.findFirst({
          where: {
            userId: data.actorUserId,
            status: OrgMemberStatus.active,
          },
          select: {
            orgId: true,
          },
        });

        if (userOrg) {
          orgId = userOrg.orgId;
        } else {
          this.logger.warn('No active organization found for user - skipping audit log', {
            userId: data.actorUserId,
            action: data.action,
          });
          return;
        }
      }

      if (!orgId) {
        this.logger.warn('No orgId provided and unable to resolve - skipping audit log', {
          action: data.action,
          actorUserId: data.actorUserId,
        });
        return;
      }

      await transaction.auditLog.create({
        data: {
          orgId,
          actorUserId: data.actorUserId,
          actorType: data.actorType,
          action: data.action,
          category: data.category,
          severity: data.severity,
          requestData: data.requestData ? (data.requestData as never) : undefined,
          responseData: data.responseData ? (data.responseData as never) : undefined,
          resources: data.resources ? (data.resources as never) : undefined,
          sessionId: data.sessionId,
          correlationId: data.correlationId,
          tags: data.tags || [],
          executionTime: data.executionTime,
        },
      });

      this.logger.debug('Audit log created within transaction', {
        action: data.action,
        category: data.category,
        severity: data.severity,
        orgId,
        actorUserId: data.actorUserId,
        correlationId: data.correlationId,
      });
    } catch (error) {
      this.logger.logError(error as Error, {
        context: 'audit log creation within transaction',
        action: data.action,
        actorUserId: data.actorUserId,
        orgId: data.orgId,
      });
      // Don't throw error to avoid breaking the main flow
    }
  }

  async findLogs(filter: AuditLogFilter): Promise<PaginatedResult<unknown>> {
    const where: Record<string, unknown> = {
      orgId: filter.orgId,
    };

    if (filter.actorUserId) {
      where.actorUserId = filter.actorUserId;
    }

    if (filter.category) {
      where.category = filter.category;
    }

    if (filter.severity) {
      where.severity = filter.severity;
    }

    if (filter.action) {
      where.action = { contains: filter.action, mode: 'insensitive' };
    }

    if (filter.fromDate || filter.toDate) {
      where.createdAt = {} as Record<string, unknown>;
      if (filter.fromDate) {
        (where.createdAt as Record<string, unknown>).gte = filter.fromDate;
      }
      if (filter.toDate) {
        (where.createdAt as Record<string, unknown>).lte = filter.toDate;
      }
    }

    if (filter.tags && filter.tags.length > 0) {
      where.tags = { hasSome: filter.tags };
    }

    if (filter.resourceType || filter.resourceId) {
      where.resources = {
        path: filter.resourceType ? ['$[*].type'] : filter.resourceId ? ['$[*].id'] : undefined,
        equals: filter.resourceType || filter.resourceId,
      };
    }

    const limit = Math.min(filter.limit || 50, 500); // Cap at 500
    const offset = filter.offset || 0;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actorUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async findByResource(
    resourceType: string,
    resourceId: string,
    orgId: string,
  ): Promise<unknown[]> {
    return this.prisma.auditLog.findMany({
      where: {
        orgId,
        resources: {
          path: ['$[*].type', '$[*].id'],
          array_contains: [resourceType, resourceId],
        },
      },
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUser(userId: string, orgId: string): Promise<unknown[]> {
    return this.prisma.auditLog.findMany({
      where: {
        orgId,
        actorUserId: userId,
      },
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit for performance
    });
  }

  async findByTimeRange(from: Date, to: Date, orgId: string): Promise<unknown[]> {
    return this.prisma.auditLog.findMany({
      where: {
        orgId,
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActivitySummary(
    orgId: string,
    period: 'day' | 'week' | 'month',
  ): Promise<ActivitySummary> {
    const now = new Date();
    const from = new Date();

    switch (period) {
      case 'day':
        from.setDate(now.getDate() - 1);
        break;
      case 'week':
        from.setDate(now.getDate() - 7);
        break;
      case 'month':
        from.setMonth(now.getMonth() - 1);
        break;
    }

    const logs = await this.prisma.auditLog.findMany({
      where: {
        orgId,
        createdAt: {
          gte: from,
          lte: now,
        },
      },
      include: {
        actorUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const eventsByCategory = logs.reduce(
      (acc, log) => {
        acc[log.category as AuditCategory] = (acc[log.category as AuditCategory] || 0) + 1;
        return acc;
      },
      {} as Record<AuditCategory, number>,
    );

    const eventsBySeverity = logs.reduce(
      (acc, log) => {
        acc[log.severity as AuditSeverity] = (acc[log.severity as AuditSeverity] || 0) + 1;
        return acc;
      },
      {} as Record<AuditSeverity, number>,
    );

    const userCounts = logs.reduce(
      (acc, log) => {
        if (log.actorUserId) {
          acc[log.actorUserId] = (acc[log.actorUserId] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const topUsers = Object.entries(userCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([userId, eventCount]) => {
        const user = logs.find((log) => log.actorUserId === userId)?.actorUser;
        return {
          userId,
          userName: user?.name,
          eventCount,
        };
      });

    return {
      totalEvents: logs.length,
      eventsByCategory,
      eventsBySeverity,
      topUsers,
      timeRange: { from, to: now },
    };
  }

  async getSecurityEvents(orgId: string): Promise<SecurityEvent[]> {
    const securityLogs = await this.prisma.auditLog.findMany({
      where: {
        orgId,
        OR: [
          { severity: AuditSeverity.HIGH },
          { severity: AuditSeverity.CRITICAL },
          { category: AuditCategory.AUTH },
          { action: { contains: 'failed' } },
          { action: { contains: 'error' } },
        ],
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return securityLogs.map((log) => ({
      id: log.id,
      type: this.classifySecurityEventType(log.action),
      severity: log.severity as AuditSeverity,
      description: `${log.action}: ${log.category}`,
      actorUserId: log.actorUserId,
      timestamp: log.createdAt,
      metadata: {
        action: log.action,
        category: log.category,
        requestData: log.requestData,
        correlationId: log.correlationId,
      },
    }));
  }

  async exportLogs(orgId: string, format: 'json' | 'csv'): Promise<string> {
    const logs = await this.findByTimeRange(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      new Date(),
      orgId,
    );

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    const headers = [
      'id',
      'timestamp',
      'actor',
      'action',
      'category',
      'severity',
      'resource_type',
      'resource_id',
      'ip_address',
    ];

    const rows = (logs as Record<string, unknown>[]).map((log) => [
      log.id,
      (log.createdAt as Date).toISOString(),
      (log.actorUser as { email?: string })?.email || log.actorUserId || 'system',
      log.action,
      log.category,
      log.severity,
      (log.resources as { type?: string; id?: string }[])?.[0]?.type || '',
      (log.resources as { type?: string; id?: string }[])?.[0]?.id || '',
      (log.requestData as { ipAddress?: string })?.ipAddress || '',
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  async verifyIntegrity(logId: string): Promise<boolean> {
    // Placeholder for cryptographic verification
    // In a real implementation, this would verify signatures/hashes
    const log = await this.prisma.auditLog.findUnique({
      where: { id: logId },
    });

    return !!log; // Simple existence check for now
  }

  private classifySecurityEventType(
    action: string,
  ): 'failed_login' | 'password_reset' | 'suspicious_activity' | 'privilege_escalation' {
    if (action.includes('login') && action.includes('failed')) {
      return 'failed_login';
    }
    if (action.includes('password') && action.includes('reset')) {
      return 'password_reset';
    }
    if (action.includes('privilege') || action.includes('role')) {
      return 'privilege_escalation';
    }
    return 'suspicious_activity';
  }
}
