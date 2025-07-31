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
  StandupConfig,
  StandupConfigMember,
} from '@prisma/client';
// import { SlackInstallService } from '../services/slack-install.service';
// import { HttpClientService } from '../services/http-client.service';

// Type definitions for complex relations
type TeamWithRelations = Team & {
  configs: (StandupConfig & {
    configMembers: (StandupConfigMember & {
      teamMember: TeamMember;
    })[];
  })[];
  integration: Integration | null;
  members: TeamMember[];
  activeConfig?: StandupConfig & {
    configMembers: (StandupConfigMember & {
      teamMember: TeamMember;
    })[];
  };
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
export class StandupSchedulerJob {
  private readonly logger = new Logger(StandupSchedulerJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loggerService: LoggerService,
    private readonly auditLogService: AuditLogService,
    // private readonly slackInstallService: SlackInstallService,
    // private readonly httpClient: HttpClientService,
  ) {
    this.loggerService.setContext(StandupSchedulerJob.name);
  }

  // Run every minute to check for scheduled standups
  @Cron('* * * * *')
  async processScheduledStandups() {
    try {
      const now = new Date();
      const teams = await this.findTeamsForStandup(now);

      for (const team of teams) {
        await this.createStandupInstance(team, now);
      }
    } catch (error) {
      this.logger.error('Error processing scheduled standups', error);
    }
  }

  private async findTeamsForStandup(now: Date): Promise<TeamWithRelations[]> {
    // Find teams that have standup configs matching current time
    const teams = await this.prisma.team.findMany({
      where: {
        configs: {
          some: {
            // Check if current day of week and time match
            weekdays: {
              has: now.getDay(), // 0 = Sunday, 1 = Monday, etc.
            },
          },
        },
      },
      include: {
        configs: {
          include: {
            configMembers: {
              include: {
                teamMember: true,
              },
            },
          },
        },
        integration: true,
        members: true,
      },
    });

    // Filter teams where the current time matches the standup time
    const matchingTeams = [];

    for (const team of teams) {
      for (const config of team.configs) {
        if (this.isTimeForStandup(config, now, team.timezone)) {
          // Check if we already have an active standup instance today
          const existingInstance = await this.prisma.standupInstance.findFirst({
            where: {
              teamId: team.id,
              targetDate: {
                gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
              },
            },
          });

          if (!existingInstance) {
            matchingTeams.push({ ...team, activeConfig: config });
          }
        }
      }
    }

    return matchingTeams;
  }

  private isTimeForStandup(config: StandupConfig, now: Date, timezone: string = 'UTC'): boolean {
    // Parse the timeLocal (format: "HH:MM")
    const [hours, minutes] = config.timeLocal.split(':').map(Number);

    // Convert current time to team's timezone
    const teamTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));

    // Check if current time matches standup time (within 1 minute window)
    const standupTime = new Date(teamTime);
    standupTime.setHours(hours, minutes, 0, 0);

    const timeDiff = Math.abs(teamTime.getTime() - standupTime.getTime());
    return timeDiff < 60000; // Within 1 minute
  }

  private async createStandupInstance(team: TeamWithRelations, now: Date): Promise<void> {
    try {
      // Create standup instance
      const standupInstance = await this.prisma.standupInstance.create({
        data: {
          teamId: team.id,
          configSnapshot: team.activeConfig as any,
          targetDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          state: StandupInstanceState.collecting,
        },
      });

      this.logger.log(`Created standup instance ${standupInstance.id} for team ${team.name}`);

      // Send standup prompts to team members
      await this.sendStandupPrompts(team, standupInstance);

      // Log the standup creation
      await this.auditLogService.log({
        orgId: team.orgId,
        actorType: AuditActorType.SYSTEM,
        action: 'standup.instance.created',
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.LOW,
        requestData: {
          method: 'CRON',
          path: '/jobs/standup-scheduler',
          ipAddress: 'system',
        },
        tags: ['standup', 'scheduler', 'automation'],
      });
    } catch (error) {
      this.logger.error(`Failed to create standup instance for team ${team.id}`, error);
    }
  }

  private async sendStandupPrompts(
    team: TeamWithRelations,
    standupInstance: StandupInstance,
  ): Promise<void> {
    if (!team.integration?.botToken) {
      this.logger.warn(`No bot token found for team ${team.id}`);
      return;
    }

    const config = standupInstance.configSnapshot as StandupConfigSnapshot;
    const questions = config.questions;
    const activeMembers = team
      .activeConfig!.configMembers.filter((cm) => cm.include && cm.teamMember.active)
      .map((cm) => cm.teamMember);

    for (const member of activeMembers) {
      await this.sendStandupPromptToMember(
        team.integration.botToken,
        member,
        questions,
        standupInstance.id,
        team.channelId,
      );
    }
  }

  private async sendStandupPromptToMember(
    botToken: string,
    member: TeamMember,
    questions: string[],
    standupInstanceId: string,
    channelId: string,
  ): Promise<void> {
    try {
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🌟 *Time for your daily standup!* 🌟\n\nHi <@${member.platformUserId}>, please share your updates:`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: questions.map((q, i) => `*${i + 1}.* ${q}`).join('\n'),
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📝 Submit in Channel',
              },
              style: 'primary',
              action_id: 'submit_standup_in_channel',
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
              text: `💡 *Tip:* You can respond directly in <#${channelId}> or use the buttons above.`,
            },
          ],
        },
      ];

      // Send DM to user
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: member.platformUserId!,
          text: 'Time for your daily standup!',
          blocks,
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Failed to send standup prompt to ${member.platformUserId}`);
      } else {
        this.logger.debug(`Sent standup prompt to ${member.name} (${member.platformUserId})`);
      }
    } catch (error) {
      this.logger.error(`Error sending standup prompt to ${member.platformUserId}`, error);
    }
  }
}
