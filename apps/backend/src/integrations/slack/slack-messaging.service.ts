import { Injectable } from '@nestjs/common';
import { WebClient, Block, KnownBlock } from '@slack/web-api';
import { SlackOauthService } from '@/integrations/slack/slack-oauth.service';
import { SlackMessageFormatterService } from '@/integrations/slack/slack-message-formatter.service';
import { LoggerService } from '@/common/logger.service';
import { PrismaService } from '@/prisma/prisma.service';
import { StandupDeliveryType } from '@prisma/client';

export interface MessageResponse {
  ok: boolean;
  ts?: string;
  channel?: string;
  error?: string;
}

export interface SlackModalView {
  type: 'modal';
  callback_id: string;
  title: {
    type: 'plain_text';
    text: string;
  };
  blocks: (Block | KnownBlock)[];
  submit?: {
    type: 'plain_text';
    text: string;
  };
  close?: {
    type: 'plain_text';
    text: string;
  };
}

@Injectable()
export class SlackMessagingService {
  constructor(
    private readonly slackOauth: SlackOauthService,
    private readonly formatter: SlackMessageFormatterService,
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {}

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  async sendChannelMessage(
    integrationId: string,
    channelId: string,
    text: string,
    blocks?: (Block | KnownBlock)[],
  ): Promise<MessageResponse> {
    try {
      const token = await this.slackOauth.getDecryptedToken(integrationId, 'bot');
      const client = new WebClient(token);

      const result = await client.chat.postMessage({
        channel: channelId,
        text,
        blocks,
        unfurl_links: false,
        unfurl_media: false,
      });

      this.logger.info('Channel message sent successfully', {
        integrationId,
        channelId,
        messageTs: result.ts,
      });

      return {
        ok: result.ok || false,
        ts: result.ts,
        channel: result.channel,
      };
    } catch (error) {
      this.logger.error('Failed to send channel message', {
        integrationId,
        channelId,
        error: this.getErrorMessage(error),
      });

      return {
        ok: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  async sendDirectMessage(
    integrationId: string,
    userId: string,
    text: string,
    blocks?: (Block | KnownBlock)[],
  ): Promise<MessageResponse> {
    try {
      const token = await this.slackOauth.getDecryptedToken(integrationId, 'bot');
      const client = new WebClient(token);

      // Open DM channel with user
      const dmResult = await client.conversations.open({
        users: userId,
      });

      if (!dmResult.ok || !dmResult.channel?.id) {
        throw new Error('Failed to open DM channel');
      }

      const result = await client.chat.postMessage({
        channel: dmResult.channel.id,
        text,
        blocks,
        unfurl_links: false,
        unfurl_media: false,
      });

      this.logger.info('Direct message sent successfully', {
        integrationId,
        userId,
        messageTs: result.ts,
      });

      return {
        ok: result.ok || false,
        ts: result.ts,
        channel: result.channel,
      };
    } catch (error) {
      this.logger.error('Failed to send direct message', {
        integrationId,
        userId,
        error: this.getErrorMessage(error),
      });

      return {
        ok: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  async updateMessage(
    integrationId: string,
    channelId: string,
    messageTs: string,
    text: string,
    blocks?: (Block | KnownBlock)[],
  ): Promise<MessageResponse> {
    try {
      const token = await this.slackOauth.getDecryptedToken(integrationId, 'bot');
      const client = new WebClient(token);

      const result = await client.chat.update({
        channel: channelId,
        ts: messageTs,
        text,
        blocks,
      });

      this.logger.info('Message updated successfully', {
        integrationId,
        channelId,
        messageTs,
      });

      return {
        ok: result.ok || false,
        ts: result.ts,
        channel: result.channel,
      };
    } catch (error) {
      this.logger.error('Failed to update message', {
        integrationId,
        channelId,
        messageTs,
        error: this.getErrorMessage(error),
      });

      return {
        ok: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  async openModal(
    integrationId: string,
    triggerId: string,
    view: SlackModalView,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const token = await this.slackOauth.getDecryptedToken(integrationId, 'bot');
      const client = new WebClient(token);

      const result = await client.views.open({
        trigger_id: triggerId,
        view,
      });

      this.logger.info('Modal opened successfully', {
        integrationId,
        triggerId,
        callbackId: view.callback_id,
      });

      return {
        ok: result.ok || false,
        error: result.error,
      };
    } catch (error) {
      this.logger.error('Failed to open modal', {
        integrationId,
        triggerId,
        error: this.getErrorMessage(error),
      });

      return {
        ok: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  async getTeamInfo(integrationId: string): Promise<{ name: string; id: string } | null> {
    try {
      const token = await this.slackOauth.getDecryptedToken(integrationId, 'bot');
      const client = new WebClient(token);

      const result = await client.team.info();

      if (!result.ok || !result.team) {
        return null;
      }

      return {
        name: result.team.name || 'Unknown Team',
        id: result.team.id || '',
      };
    } catch (error) {
      this.logger.error('Failed to get team info', {
        integrationId,
        error: this.getErrorMessage(error),
      });
      return null;
    }
  }

  async getUserInfo(
    integrationId: string,
    userId: string,
  ): Promise<{ name: string; realName: string } | null> {
    try {
      const token = await this.slackOauth.getDecryptedToken(integrationId, 'bot');
      const client = new WebClient(token);

      const result = await client.users.info({
        user: userId,
      });

      if (!result.ok || !result.user) {
        return null;
      }

      return {
        name: result.user.name || 'Unknown User',
        realName: result.user.real_name || result.user.name || 'Unknown User',
      };
    } catch (error) {
      this.logger.error('Failed to get user info', {
        integrationId,
        userId,
        error: this.getErrorMessage(error),
      });
      return null;
    }
  }

  // Standup-specific messaging methods

  /**
   * Validates that a Slack channel exists and the bot has access to it
   */
  async validateChannelAccess(
    integrationId: string,
    channelId: string,
  ): Promise<{
    isValid: boolean;
    error?: string;
    channelName?: string;
  }> {
    try {
      const token = await this.slackOauth.getDecryptedToken(integrationId, 'bot');
      const client = new WebClient(token);

      const result = await client.conversations.info({
        channel: channelId,
      });

      if (result.ok && result.channel) {
        return {
          isValid: true,
          channelName: result.channel.name || 'Unknown Channel',
        };
      } else {
        return {
          isValid: false,
          error: 'Channel not found or bot lacks access',
        };
      }
    } catch (error) {
      this.logger.error('Failed to validate channel access', {
        integrationId,
        channelId,
        error: this.getErrorMessage(error),
      });

      return {
        isValid: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  async sendStandupReminder(instanceId: string): Promise<MessageResponse> {
    try {
      // Get instance with team and config details
      const instance = await this.prisma.standupInstance.findFirst({
        where: { id: instanceId },
        include: {
          team: {
            select: {
              name: true,
              orgId: true,
              slackChannelId: true,
              integrationId: true,
              configs: {
                where: { isActive: true },
                select: { deliveryType: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      if (!instance || !instance.team) {
        throw new Error('Standup instance or team not found');
      }

      // Validate team integration and channel configuration
      if (!instance.team.integrationId) {
        throw new Error('Team does not have a Slack integration configured');
      }

      if (!instance.team.slackChannelId) {
        throw new Error('Team does not have a Slack channel configured');
      }

      // Validate channel access before attempting to send
      const channelValidation = await this.validateChannelAccess(
        instance.team.integrationId,
        instance.team.slackChannelId,
      );

      if (!channelValidation.isValid) {
        const errorMsg = `Channel validation failed: ${channelValidation.error}. Channel ID: ${instance.team.slackChannelId}`;
        this.logger.error('Channel validation failed for standup reminder', {
          instanceId,
          teamId: instance.teamId,
          channelId: instance.team.slackChannelId,
          integrationId: instance.team.integrationId,
          validationError: channelValidation.error,
        });

        return {
          ok: false,
          error: errorMsg,
        };
      }

      const configSnapshot = instance.configSnapshot as {
        questions: string[];
        responseTimeoutHours: number;
        participatingMembers: Array<{
          id: string;
          name: string;
          platformUserId: string;
        }>;
      };

      const teamInfo = await this.getTeamInfo(instance.team.integrationId);
      const teamName = teamInfo?.name || instance.team.name;

      const instanceData = {
        ...instance,
        configSnapshot: {
          questions: configSnapshot.questions,
          responseTimeoutHours: configSnapshot.responseTimeoutHours || 2,
          participatingMembers: configSnapshot.participatingMembers,
        },
      };

      // Get the delivery type from the active config
      const config = instance.team.configs[0];
      const deliveryType = config?.deliveryType || StandupDeliveryType.channel;

      const { text, blocks } = await this.formatter.formatStandupReminderWithMagicLinks(
        instanceData,
        teamName,
        instance.team.orgId,
      );

      let result: MessageResponse;

      if (deliveryType === StandupDeliveryType.direct_message) {
        // Send direct messages to each participating member
        result = await this.sendStandupReminderDMs(
          instance.team.integrationId,
          configSnapshot.participatingMembers,
          text,
          blocks,
        );
      } else {
        // Send to channel (default behavior)
        this.logger.info('Attempting to send standup reminder to channel', {
          instanceId,
          teamId: instance.teamId,
          teamName: instance.team.name,
          channelId: instance.team.slackChannelId,
          integrationId: instance.team.integrationId,
        });

        result = await this.sendChannelMessage(
          instance.team.integrationId,
          instance.team.slackChannelId,
          text,
          blocks,
        );
      }

      // Store the message timestamp for future updates
      if (result.ok && result.ts) {
        await this.prisma.standupInstance.update({
          where: { id: instanceId },
          data: { reminderMessageTs: result.ts },
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to send standup reminder', {
        instanceId,
        error: this.getErrorMessage(error),
      });

      return {
        ok: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  /**
   * Send standup reminder as direct messages to all participating members
   */
  async sendStandupReminderDMs(
    integrationId: string,
    participatingMembers: Array<{
      id: string;
      name: string;
      platformUserId: string;
    }>,
    text: string,
    blocks: (Block | KnownBlock)[],
  ): Promise<MessageResponse> {
    try {
      const results: MessageResponse[] = [];
      let successCount = 0;
      let firstSuccessTs: string | undefined;

      // Send DM to each participating member
      for (const member of participatingMembers) {
        if (!member.platformUserId) {
          this.logger.warn('Skipping member without platformUserId', {
            memberId: member.id,
            memberName: member.name,
          });
          continue;
        }

        const result = await this.sendDirectMessage(
          integrationId,
          member.platformUserId,
          text,
          blocks,
        );

        results.push(result);

        if (result.ok) {
          successCount++;
          if (!firstSuccessTs && result.ts) {
            firstSuccessTs = result.ts;
          }
          this.logger.debug('Sent DM standup reminder', {
            memberId: member.id,
            memberName: member.name,
            platformUserId: member.platformUserId,
            ts: result.ts,
          });
        } else {
          this.logger.warn('Failed to send DM standup reminder', {
            memberId: member.id,
            memberName: member.name,
            platformUserId: member.platformUserId,
            error: result.error,
          });
        }
      }

      // Return aggregate result
      const isSuccess = successCount > 0;
      const allSucceeded =
        successCount === participatingMembers.filter((m) => m.platformUserId).length;

      return {
        ok: isSuccess,
        ts: firstSuccessTs, // Use first successful message timestamp
        error: isSuccess
          ? allSucceeded
            ? undefined
            : `Sent to ${successCount}/${participatingMembers.length} members`
          : 'Failed to send to any members',
      };
    } catch (error) {
      this.logger.error('Failed to send standup reminder DMs', {
        integrationId,
        memberCount: participatingMembers.length,
        error: this.getErrorMessage(error),
      });

      return {
        ok: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  async sendIndividualReminder(
    instanceId: string,
    platformUserId: string,
  ): Promise<MessageResponse> {
    try {
      const instance = await this.prisma.standupInstance.findFirst({
        where: { id: instanceId },
        include: {
          team: {
            select: {
              integrationId: true,
              name: true,
            },
          },
        },
      });

      if (!instance || !instance.team) {
        throw new Error('Standup instance or team not found');
      }

      const userInfo = await this.getUserInfo(instance.team.integrationId, platformUserId);
      const userName = userInfo?.realName || 'there';

      const text = `Hi ${userName}! 👋 Don't forget to submit your daily standup responses. You can use the /standup submit command or click the button in the team channel.`;

      return await this.sendDirectMessage(instance.team.integrationId, platformUserId, text);
    } catch (error) {
      this.logger.error('Failed to send individual reminder', {
        instanceId,
        platformUserId,
        error: this.getErrorMessage(error),
      });

      return {
        ok: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  async postStandupSummary(instanceId: string): Promise<MessageResponse> {
    try {
      const instance = await this.prisma.standupInstance.findFirst({
        where: { id: instanceId },
        include: {
          team: {
            select: {
              name: true,
              slackChannelId: true,
              integrationId: true,
            },
          },
          answers: {
            include: {
              teamMember: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!instance || !instance.team) {
        throw new Error('Standup instance or team not found');
      }

      const configSnapshot = instance.configSnapshot as {
        questions: string[];
        responseTimeoutHours: number;
        participatingMembers: Array<{
          id: string;
          name: string;
          platformUserId: string;
        }>;
      };

      // Group answers by member
      const memberAnswersMap = new Map();
      instance.answers.forEach((answer) => {
        if (!memberAnswersMap.has(answer.teamMemberId)) {
          memberAnswersMap.set(answer.teamMemberId, {
            teamMemberId: answer.teamMemberId,
            memberName: answer.teamMember.name || 'Unknown',
            answers: [],
            isComplete: false,
          });
        }

        memberAnswersMap.get(answer.teamMemberId).answers.push({
          questionIndex: answer.questionIndex,
          answer: answer.text,
        });
      });

      const memberAnswers = Array.from(memberAnswersMap.values());

      // Calculate participation stats
      const totalMembers = configSnapshot.participatingMembers.length;
      const respondedMembers = memberAnswers.length;
      const responseRate = totalMembers > 0 ? (respondedMembers / totalMembers) * 100 : 0;

      const respondedMemberIds = new Set(memberAnswers.map((m) => m.teamMemberId));
      const missingMembers = configSnapshot.participatingMembers
        .filter((member) => !respondedMemberIds.has(member.id))
        .map((member) => member.name);

      const participation = {
        totalMembers,
        respondedMembers,
        responseRate,
        missingMembers,
      };

      const teamInfo = await this.getTeamInfo(instance.team.integrationId);
      const teamName = teamInfo?.name || instance.team.name;

      const instanceData = {
        ...instance,
        configSnapshot: {
          questions: configSnapshot.questions,
          responseTimeoutHours: configSnapshot.responseTimeoutHours || 2,
          participatingMembers: configSnapshot.participatingMembers,
        },
      };

      const { text, blocks } = this.formatter.formatStandupSummary(
        instanceData,
        memberAnswers,
        participation,
        teamName,
      );

      const result = await this.sendChannelMessage(
        instance.team.integrationId,
        instance.team.slackChannelId,
        text,
        blocks,
      );

      // Store the summary message timestamp
      if (result.ok && result.ts) {
        await this.prisma.standupInstance.update({
          where: { id: instanceId },
          data: { summaryMessageTs: result.ts },
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to post standup summary', {
        instanceId,
        error: this.getErrorMessage(error),
      });

      return {
        ok: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  async sendFollowupReminder(
    instanceId: string,
    missingUserIds: string[],
  ): Promise<MessageResponse[]> {
    try {
      const instance = await this.prisma.standupInstance.findFirst({
        where: { id: instanceId },
        include: {
          team: {
            select: {
              name: true,
              orgId: true,
              integrationId: true,
              slackChannelId: true,
            },
          },
        },
      });

      if (!instance || !instance.team) {
        throw new Error('Standup instance or team not found');
      }

      const configSnapshot = instance.configSnapshot as {
        questions: string[];
        responseTimeoutHours: number;
        participatingMembers: Array<{
          id: string;
          name: string;
          platformUserId: string;
        }>;
      };

      // Calculate time remaining
      const deadline = new Date(
        instance.createdAt.getTime() + configSnapshot.responseTimeoutHours * 60 * 60 * 1000,
      );
      const now = new Date();
      const diffMs = deadline.getTime() - now.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const timeRemaining = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      // Get missing members with full details for magic link generation
      const missingMembers = configSnapshot.participatingMembers.filter((member) =>
        missingUserIds.includes(member.platformUserId),
      );

      const instanceData = {
        ...instance,
        configSnapshot: {
          questions: configSnapshot.questions,
          responseTimeoutHours: configSnapshot.responseTimeoutHours,
          participatingMembers: configSnapshot.participatingMembers,
        },
      };

      const { text, blocks } = await this.formatter.formatFollowupReminderWithMagicLinks(
        instanceData,
        timeRemaining,
        missingMembers,
        instance.team.orgId,
      );

      // Send to channel
      const channelResult = await this.sendChannelMessage(
        instance.team.integrationId,
        instance.team.slackChannelId,
        text,
        blocks,
      );

      // Also send individual DMs to missing users
      const dmResults = await Promise.all(
        missingUserIds.map((userId) => this.sendIndividualReminder(instanceId, userId)),
      );

      return [channelResult, ...dmResults];
    } catch (error) {
      this.logger.error('Failed to send followup reminder', {
        instanceId,
        missingUserIds,
        error: this.getErrorMessage(error),
      });

      return [
        {
          ok: false,
          error: this.getErrorMessage(error),
        },
      ];
    }
  }
}
