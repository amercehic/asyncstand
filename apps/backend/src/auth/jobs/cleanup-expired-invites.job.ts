import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditActorType, AuditCategory, AuditSeverity } from '@/common/audit/types';
import { OrgMemberStatus } from '@prisma/client';

@Injectable()
export class CleanupExpiredInvitesJob {
  private readonly logger = new Logger(CleanupExpiredInvitesJob.name);

  constructor(
    private prisma: PrismaService,
    private readonly loggerService: LoggerService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.loggerService.setContext(CleanupExpiredInvitesJob.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredInvites() {
    this.logger.log('Starting cleanup of expired organization invitations');

    try {
      // Find invitations older than 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const expiredInvites = await this.prisma.orgMember.findMany({
        where: {
          status: OrgMemberStatus.invited,
          invitedAt: {
            lt: sevenDaysAgo,
          },
          inviteToken: {
            not: null,
          },
        },
        include: {
          org: true,
        },
      });

      if (expiredInvites.length === 0) {
        this.logger.log('No expired invitations found');
        return;
      }

      // Delete expired invitations
      const result = await this.prisma.orgMember.deleteMany({
        where: {
          status: OrgMemberStatus.invited,
          invitedAt: {
            lt: sevenDaysAgo,
          },
          inviteToken: {
            not: null,
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} expired invitations`);

      for (const invite of expiredInvites) {
        await this.auditLogService.log({
          action: 'org.member.invite.expired',
          orgId: invite.orgId,
          actorType: AuditActorType.SYSTEM,
          category: AuditCategory.USER_MANAGEMENT,
          severity: AuditSeverity.LOW,
          requestData: {
            method: 'CRON',
            path: '/jobs/cleanup-expired-invites',
            ipAddress: 'system',
            body: {
              email: invite.userId,
              invitedAt: invite.invitedAt,
              expiredAt: new Date(),
            },
          },
        });
      }
    } catch (error) {
      this.logger.error('Error cleaning up expired invitations', error);
    }
  }
}
