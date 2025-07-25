import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';

export interface AuditLogData {
  action: string;
  actorUserId: string;
  orgId?: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(AuditLogService.name);
  }

  async log(data: AuditLogData): Promise<void> {
    try {
      // If no orgId is provided, try to find the user's primary organization
      let orgId = data.orgId;

      if (!orgId) {
        const userOrg = await this.prisma.orgMember.findFirst({
          where: {
            userId: data.actorUserId,
            status: 'active',
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

      await this.prisma.auditLog.create({
        data: {
          orgId,
          actorUserId: data.actorUserId,
          action: data.action,
          payload: {
            ...data.payload,
            ...(data.ipAddress && { ipAddress: data.ipAddress }),
            ...(data.userAgent && { userAgent: data.userAgent }),
          },
        },
      });

      this.logger.debug('Audit log created', {
        action: data.action,
        orgId,
        actorUserId: data.actorUserId,
      });
    } catch (error) {
      this.logger.logError(error as Error, {
        context: 'audit log creation',
        action: data.action,
        actorUserId: data.actorUserId,
      });
      // Don't throw error to avoid breaking the main flow
    }
  }

  // Method to use within transactions - accepts a Prisma transaction client
  async logWithTransaction(data: AuditLogData, tx: unknown): Promise<void> {
    try {
      const transaction = tx as typeof this.prisma;

      // If no orgId is provided, try to find the user's primary organization
      let orgId = data.orgId;

      if (!orgId) {
        const userOrg = await transaction.orgMember.findFirst({
          where: {
            userId: data.actorUserId,
            status: 'active',
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

      await transaction.auditLog.create({
        data: {
          orgId,
          actorUserId: data.actorUserId,
          action: data.action,
          payload: {
            ...data.payload,
            ...(data.ipAddress && { ipAddress: data.ipAddress }),
            ...(data.userAgent && { userAgent: data.userAgent }),
          },
        },
      });

      this.logger.debug('Audit log created within transaction', {
        action: data.action,
        orgId,
        actorUserId: data.actorUserId,
      });
    } catch (error) {
      this.logger.logError(error as Error, {
        context: 'audit log creation within transaction',
        action: data.action,
        actorUserId: data.actorUserId,
      });
      // Don't throw error to avoid breaking the main flow
    }
  }
}
