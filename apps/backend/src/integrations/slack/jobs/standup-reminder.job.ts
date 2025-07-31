import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditActorType, AuditCategory, AuditSeverity } from '@/common/audit/types';
import {
  StandupInstanceState,
  StandupInstance,
  Team,
  Integration,
  TeamMember,
  Answer,
  StandupConfig,
  StandupConfigMember,
} from '@prisma/client';

// Type definitions for complex relations
type StandupInstanceWithRelations = StandupInstance & {
  team: Team & {
    integration: Integration | null;
    configs: (StandupConfig & {
      configMembers: (StandupConfigMember & {
        teamMember: TeamMember;
      })[];
    })[];
  };
  answers: {
    teamMemberId: string;
  }[];
};

type StandupConfigSnapshot = {
  id: string;
  questions: string[];
  weekdays: number[];
  timeLocal: string;
  reminderMinutesBefore: number;
  configMembers?: StandupConfigMemberWithTeamMember[];
};

type StandupConfigMemberWithTeamMember = {
  include: boolean;
  teamMember: TeamMember;
};

@Injectable()
export class StandupReminderJob {
  private readonly logger = new Logger(StandupReminderJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loggerService: LoggerService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.loggerService.setContext(StandupReminderJob.name);
  }

  // Run every 15 minutes to send reminders
  @Cron('*/15 * * * *')
  async sendStandupReminders() {
    try {
      const instances = await this.findInstancesNeedingReminders();

      for (const instance of instances) {
        await this.sendRemindersForInstance(instance);
      }
    } catch (error) {
      this.logger.error('Error sending standup reminders', error);
    }
  }

  private async findInstancesNeedingReminders(): Promise<StandupInstanceWithRelations[]> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    return this.prisma.standupInstance.findMany({
      where: {
        state: StandupInstanceState.collecting,
        createdAt: {
          gte: twoHoursAgo, // Not too old
          lte: oneHourAgo, // At least 1 hour old
        },
      },
      include: {
        team: {
          include: {
            integration: true,
            configs: {
              include: {
                configMembers: {
                  include: {
                    teamMember: true,
                  },
                },
              },
            },
          },
        },
        answers: {
          select: {
            teamMemberId: true,
          },
        },
      },
    });
  }

  private async sendRemindersForInstance(instance: StandupInstanceWithRelations): Promise<void> {
    if (!instance.team.integration?.botToken) {
      this.logger.warn(`No bot token found for team ${instance.team.id}`);
      return;
    }

    const config = instance.configSnapshot as StandupConfigSnapshot;
    const expectedMembers =
      config.configMembers
        ?.filter((cm: StandupConfigMemberWithTeamMember) => cm.include && cm.teamMember.active)
        .map((cm: StandupConfigMemberWithTeamMember) => cm.teamMember) || [];

    const respondedMemberIds = new Set(instance.answers.map((a) => a.teamMemberId));
    const nonRespondedMembers = expectedMembers.filter(
      (member: TeamMember) => !respondedMemberIds.has(member.id),
    );

    if (nonRespondedMembers.length === 0) {
      this.logger.debug(`All members have responded for instance ${instance.id}`);
      return;
    }

    // Determine reminder type based on time elapsed
    const timeSinceStart = new Date().getTime() - instance.createdAt.getTime();
    const reminderType = this.getReminderType(timeSinceStart);

    for (const member of nonRespondedMembers) {
      await this.sendReminderToMember(
        instance.team.integration.botToken,
        member,
        config.questions,
        instance.id,
        instance.team.channelId,
        reminderType,
      );
    }

    // Log reminder activity
    await this.auditLogService.log({
      orgId: instance.team.orgId,
      actorType: AuditActorType.SYSTEM,
      action: `standup.reminder.${reminderType}`,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.LOW,
      requestData: {
        method: 'CRON',
        path: '/jobs/standup-reminder',
        ipAddress: 'system',
      },
      tags: ['standup', 'reminder', reminderType],
    });

    this.logger.log(
      `Sent ${reminderType} reminders to ${nonRespondedMembers.length} members for instance ${instance.id}`,
    );
  }

  private getReminderType(timeSinceStart: number): 'gentle' | 'urgent' | 'final' {
    const oneHour = 60 * 60 * 1000;
    const twoHours = 2 * 60 * 60 * 1000;

    if (timeSinceStart < oneHour + 30 * 60 * 1000) {
      // 1.5 hours
      return 'gentle';
    } else if (timeSinceStart < twoHours) {
      return 'urgent';
    } else {
      return 'final';
    }
  }

  private async sendReminderToMember(
    botToken: string,
    member: TeamMember,
    questions: string[],
    standupInstanceId: string,
    channelId: string,
    reminderType: 'gentle' | 'urgent' | 'final',
  ): Promise<void> {
    try {
      const reminderMessages = {
        gentle: {
          emoji: '👋',
          title: 'Gentle reminder',
          message: "Just a friendly reminder about today's standup!",
        },
        urgent: {
          emoji: '⏰',
          title: 'Standup reminder',
          message: "Don't forget to share your standup updates!",
        },
        final: {
          emoji: '🚨',
          title: 'Final reminder',
          message: 'Last chance to share your standup before the summary is posted!',
        },
      };

      const reminder = reminderMessages[reminderType];

      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${reminder.emoji} *${reminder.title}* ${reminder.emoji}\n\nHi <@${member.platformUserId}>, ${reminder.message}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Questions to answer:*\n${questions.map((q, i) => `*${i + 1}.* ${q}`).join('\n')}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📝 Submit Now',
              },
              style: reminderType === 'final' ? 'danger' : 'primary',
              action_id: 'submit_standup_reminder',
              value: standupInstanceId,
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '⏭️ Skip Today',
              },
              action_id: 'skip_standup_today',
              value: standupInstanceId,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `💬 You can respond directly in <#${channelId}> or click the button above.`,
            },
          ],
        },
      ];

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: member.platformUserId!,
          text: `${reminder.title} - Standup reminder`,
          blocks,
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Failed to send ${reminderType} reminder to ${member.platformUserId}`);
      } else {
        this.logger.debug(
          `Sent ${reminderType} reminder to ${member.name} (${member.platformUserId})`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error sending ${reminderType} reminder to ${member.platformUserId}`,
        error,
      );
    }
  }
}
