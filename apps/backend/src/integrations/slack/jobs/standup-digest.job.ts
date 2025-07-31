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
  StandupConfigMember
} from '@prisma/client';
// import { HttpClientService } from '../services/http-client.service';

// Type definitions for complex relations
type StandupInstanceWithRelations = StandupInstance & {
  team: Team & {
    integration: Integration | null;
    members: TeamMember[];
  };
  answers: (Answer & {
    teamMember: TeamMember;
  })[];
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
export class StandupDigestJob {
  private readonly logger = new Logger(StandupDigestJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loggerService: LoggerService,
    private readonly auditLogService: AuditLogService,
    // private readonly httpClient: HttpClientService,
  ) {
    this.loggerService.setContext(StandupDigestJob.name);
  }

  // Run every 30 minutes to check for standups ready for digest
  @Cron('*/30 * * * *')
  async processStandupDigests() {
    try {
      const candidateInstances = await this.findInstancesReadyForDigest();

      for (const instance of candidateInstances) {
        const shouldPostDigest = await this.shouldPostDigest(instance);

        if (shouldPostDigest) {
          await this.generateAndPostDigest(instance);
        }
      }
    } catch (error) {
      this.logger.error('Error processing standup digests', error);
    }
  }

  private async findInstancesReadyForDigest(): Promise<StandupInstanceWithRelations[]> {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

    return this.prisma.standupInstance.findMany({
      where: {
        state: StandupInstanceState.collecting,
        createdAt: {
          lt: cutoffTime, // Instance is at least 2 hours old
        },
        digestPost: null, // No digest posted yet
      },
      include: {
        team: {
          include: {
            integration: true,
            members: true,
          },
        },
        answers: {
          include: {
            teamMember: true,
          },
        },
      },
    });
  }

  private async shouldPostDigest(instance: StandupInstanceWithRelations): Promise<boolean> {
    const config = instance.configSnapshot as StandupConfigSnapshot;
    const totalMembers = config.configMembers?.filter((cm: StandupConfigMemberWithTeamMember) => cm.include).length || 0;
    const answersCount = instance.answers.length;

    // Post digest if:
    // 1. At least 50% of members have responded, OR
    // 2. It's been more than 4 hours since standup started, OR
    // 3. All members have responded
    const responseRate = totalMembers > 0 ? answersCount / totalMembers : 0;
    const timeSinceStart = new Date().getTime() - instance.createdAt.getTime();
    const fourHours = 4 * 60 * 60 * 1000;

    return responseRate >= 0.5 || timeSinceStart > fourHours || responseRate === 1;
  }

  private async generateAndPostDigest(instance: StandupInstanceWithRelations): Promise<void> {
    try {
      if (!instance.team.integration?.botToken) {
        this.logger.warn(`No bot token found for team ${instance.team.id}`);
        return;
      }

      const digestBlocks = await this.buildDigestBlocks(instance);

      // Post digest to channel
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${instance.team.integration.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: instance.team.channelId,
          text: 'Daily Standup Summary',
          blocks: digestBlocks,
        }),
      });

      if (!response.ok) {
        this.logger.error(`Failed to post digest for instance ${instance.id}`);
        return;
      }

      const result = await response.json() as { ok: boolean; ts?: string };

      if (result.ok) {
        // Record the digest post
        await this.prisma.standupDigestPost.create({
          data: {
            standupInstanceId: instance.id,
            integrationId: instance.team.integration.id,
            channelId: instance.team.channelId!,
            messageTs: result.ts!,
          },
        });

        // Update instance state
        await this.prisma.standupInstance.update({
          where: { id: instance.id },
          data: { state: StandupInstanceState.posted },
        });

        // Create participation snapshot
        await this.createParticipationSnapshot(instance);

        this.logger.log(`Posted digest for standup instance ${instance.id}`);

        // Log the digest creation
        await this.auditLogService.log({
          orgId: instance.team.orgId,
          actorType: AuditActorType.SYSTEM,
          action: 'standup.digest.posted',
          category: AuditCategory.SYSTEM,
          severity: AuditSeverity.LOW,
          requestData: {
            method: 'CRON',
            path: '/jobs/standup-digest',
            ipAddress: 'system',
          },
          tags: ['standup', 'digest', 'automation'],
        });
      }
    } catch (error) {
      this.logger.error(`Failed to generate digest for instance ${instance.id}`, error);
    }
  }

  private async buildDigestBlocks(instance: StandupInstanceWithRelations): Promise<any[]> {
    const config = instance.configSnapshot as StandupConfigSnapshot;
    const questions = config.questions || [];
    const answers = instance.answers;
    const targetDate = instance.targetDate.toDateString();

    // Group answers by team member
    const memberAnswers = new Map<string, { member: TeamMember; answers: string[] }>();
    answers.forEach((answer) => {
      if (!memberAnswers.has(answer.teamMemberId)) {
        memberAnswers.set(answer.teamMemberId, {
          member: answer.teamMember,
          answers: [],
        });
      }
      memberAnswers.get(answer.teamMemberId)!.answers[answer.questionIndex] = answer.text;
    });

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📊 Daily Standup Summary - ${targetDate}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Participation:* ${answers.length > 0 ? memberAnswers.size : 0} members responded`,
        },
      },
    ];

    if (memberAnswers.size === 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '😴 *No responses yet today.* Team members will be reminded to share their updates.',
        },
      });
    } else {
      blocks.push({
        type: 'divider',
      } as any);

      // Add each member's responses
      for (const [, data] of memberAnswers.entries()) {
        const memberBlocks = this.buildMemberSection(data.member, data.answers, questions);
        blocks.push(...memberBlocks);
      }
    }

    // Add footer with participation stats
    const totalConfigMembers =
      config.configMembers?.filter((cm: StandupConfigMemberWithTeamMember) => cm.include).length || 0;
    const responseRate =
      totalConfigMembers > 0 ? Math.round((memberAnswers.size / totalConfigMembers) * 100) : 0;

    blocks.push(
      {
        type: 'divider',
      } as any,
      {
        type: 'context',
        text: {
          type: 'mrkdwn',
          text: 'No responses yet',
        },
          {
            type: 'mrkdwn',
            text: `📈 Response rate: ${responseRate}% (${memberAnswers.size}/${totalConfigMembers})`,
          },
        ],
      },
    );

    return blocks;
  }

  private buildMemberSection(member: TeamMember, answers: string[], questions: string[]): any[] {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${member.name}* <@${member.platformUserId}>`,
        },
      },
    ];

    if (answers.length === 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '_No response provided_',
        },
      });
    } else {
      const responseText = questions
        .map((question, index) => {
          const answer = answers[index] || '_No answer provided_';
          return `*${question}*\n${answer}`;
        })
        .join('\n\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: responseText,
        },
      });
    }

    blocks.push({
      type: 'divider',
    } as any);

    return blocks;
  }

  private async createParticipationSnapshot(instance: StandupInstanceWithRelations): Promise<void> {
    const config = instance.configSnapshot as StandupConfigSnapshot;
    const totalMembers = config.configMembers?.filter((cm: StandupConfigMemberWithTeamMember) => cm.include).length || 0;
    const answersCount = instance.answers.length;
    const membersMissing = Math.max(0, totalMembers - answersCount);

    await this.prisma.participationSnapshot.create({
      data: {
        standupInstanceId: instance.id,
        answersCount,
        membersMissing,
      },
    });
  }
}
