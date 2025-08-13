import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { SlackMessagingService } from '@/integrations/slack/slack-messaging.service';
import { SlackMessageFormatterService } from '@/integrations/slack/slack-message-formatter.service';
import { AnswerCollectionService } from '@/standups/answer-collection.service';
import { LoggerService } from '@/common/logger.service';
import { PrismaService } from '@/prisma/prisma.service';

interface SlackEvent {
  type: string;
  user?: string;
  channel?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  bot_id?: string;
  [key: string]: unknown;
}

interface InteractiveComponent {
  type: string;
  user: {
    id: string;
    name: string;
  };
  team: {
    id: string;
    domain: string;
  };
  actions?: Array<{
    action_id: string;
    value?: string;
    type: string;
  }>;
  trigger_id?: string;
  view?: {
    callback_id: string;
    state: {
      values: Record<string, Record<string, { value?: string }>>;
    };
  };
}

interface SlashCommandPayload {
  command: string;
  text: string;
  user_id: string;
  user_name: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  trigger_id: string;
  response_url: string;
}

interface SlashCommandResponse {
  response_type: 'ephemeral' | 'in_channel';
  text: string;
  blocks?: unknown[];
}

interface StandupInstance {
  id: string;
  targetDate: Date;
  state: string;
  configSnapshot: {
    questions: string[];
    responseTimeoutHours: number;
    participatingMembers: Array<{
      id: string;
      name: string;
      platformUserId: string;
    }>;
  };
  team?: {
    name: string;
  };
}

@Injectable()
export class SlackEventService {
  private readonly signingSecret: string;

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  constructor(
    private readonly slackMessaging: SlackMessagingService,
    private readonly formatter: SlackMessageFormatterService,
    private readonly answerCollection: AnswerCollectionService,
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {
    this.signingSecret = process.env.SLACK_SIGNING_SECRET || '';
    if (!this.signingSecret) {
      this.logger.warn('SLACK_SIGNING_SECRET not configured - webhook verification disabled');
    }
  }

  async verifySlackRequest(headers: Record<string, string>, body: unknown): Promise<boolean> {
    if (!this.signingSecret) {
      this.logger.warn('Slack signing secret not configured, skipping verification');
      return true; // Allow in development
    }

    const signature = headers['x-slack-signature'];
    const timestamp = headers['x-slack-request-timestamp'];

    if (!signature || !timestamp) {
      this.logger.warn('Missing signature or timestamp headers');
      return false;
    }

    // Check timestamp to prevent replay attacks (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      this.logger.warn('Request timestamp too old');
      return false;
    }

    // Create the signature base string
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const sigBaseString = `v0:${timestamp}:${bodyStr}`;

    // Generate the expected signature
    const expectedSignature =
      'v0=' + createHmac('sha256', this.signingSecret).update(sigBaseString).digest('hex');

    // Compare signatures using timing-safe comparison
    try {
      return timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8'),
      );
    } catch (error) {
      this.logger.error('Error comparing signatures', { error: this.getErrorMessage(error) });
      return false;
    }
  }

  async handleSlackEvent(event: SlackEvent, teamId: string): Promise<void> {
    try {
      this.logger.info('Processing Slack event', {
        eventType: event.type,
        teamId,
        userId: event.user,
      });

      switch (event.type) {
        case 'app_mention':
          await this.handleAppMention(event, teamId);
          break;

        case 'message':
          await this.handleMessage(event, teamId);
          break;

        default:
          this.logger.debug('Unhandled event type', { eventType: event.type });
      }
    } catch (error) {
      this.logger.error('Error processing Slack event', {
        error: this.getErrorMessage(error),
        eventType: event?.type,
        teamId,
      });
    }
  }

  async processInteractiveComponent(payload: InteractiveComponent): Promise<void> {
    try {
      const { type, user, team } = payload;

      this.logger.info('Processing interactive component', {
        type,
        userId: user.id,
        teamId: team.id,
      });

      switch (type) {
        case 'block_actions':
          await this.handleBlockActions(payload);
          break;

        case 'view_submission':
          await this.handleViewSubmission(payload);
          break;

        default:
          this.logger.debug('Unhandled interactive component type', { type });
      }
    } catch (error) {
      this.logger.error('Error processing interactive component', {
        error: this.getErrorMessage(error),
        type: payload.type,
        userId: payload.user?.id,
      });
    }
  }

  async processSlashCommand(payload: SlashCommandPayload): Promise<SlashCommandResponse> {
    try {
      const { command, text, user_id, team_id, trigger_id } = payload;

      this.logger.info('Processing slash command', {
        command,
        text,
        userId: user_id,
        teamId: team_id,
      });

      // Find the integration for this team
      const integration = await this.findIntegrationByTeamId(team_id);
      if (!integration) {
        return {
          response_type: 'ephemeral',
          text: 'Sorry, I could not find your team integration. Please contact your administrator.',
        };
      }

      switch (command) {
        case '/standup':
          return await this.handleStandupCommand(text.trim(), user_id, integration.id, trigger_id);

        default:
          return {
            response_type: 'ephemeral',
            text: 'Unknown command. Type `/standup help` for available commands.',
          };
      }
    } catch (error) {
      this.logger.error('Error processing slash command', {
        error: this.getErrorMessage(error),
        command: payload.command,
        userId: payload.user_id,
      });

      return {
        response_type: 'ephemeral',
        text: 'Sorry, something went wrong processing your command. Please try again.',
      };
    }
  }

  private async handleAppMention(event: SlackEvent, _teamId: string): Promise<void> {
    // Handle when bot is mentioned in a channel
    this.logger.info('Bot mentioned', {
      channel: event.channel,
      user: event.user,
      text: event.text,
    });

    // Could implement help response here
  }

  private async handleMessage(event: SlackEvent, _teamId: string): Promise<void> {
    // Handle direct messages to the bot
    if (event.channel?.startsWith('D')) {
      this.logger.info('Direct message received', {
        user: event.user,
        text: event.text,
      });

      // Handle standup responses via DM text
      if (event.text && event.user && !event.bot_id) {
        await this.handleDirectMessageResponse(event.user, event.text, _teamId);
      }
    }

    // Handle thread replies to standup reminders
    if (event.thread_ts && event.text && event.user && !event.bot_id) {
      this.logger.debug('Thread reply received', {
        user: event.user,
        text: event.text,
        thread_ts: event.thread_ts,
        channel: event.channel,
      });

      // Handle standup responses via thread replies
      await this.handleThreadReply(event.user, event.text, event.thread_ts, event.channel, _teamId);
    }
  }

  /**
   * Handle thread reply responses to standup reminders
   */
  private async handleThreadReply(
    userId: string,
    text: string,
    threadTs: string,
    channelId: string,
    teamId: string,
  ): Promise<void> {
    try {
      // Find active standup instance by looking for the thread message
      // We need to check if this thread is associated with a standup reminder
      const activeInstance = await this.findActiveStandupInstanceForUser(userId, teamId);

      if (!activeInstance) {
        this.logger.debug('No active standup found for thread reply', { userId, teamId, threadTs });
        return;
      }

      this.logger.info('Processing thread reply standup response', {
        userId,
        instanceId: activeInstance.id,
        threadTs,
        channelId,
        responseLength: text.length,
      });

      // Parse and submit the response similar to DM handling
      await this.submitParsedResponse(activeInstance.id, userId, text);
    } catch (error) {
      this.logger.error('Error handling thread reply', {
        userId,
        teamId,
        threadTs,
        channelId,
        error: this.getErrorMessage(error),
      });
    }
  }

  /**
   * Handle direct message responses to standup questions
   */
  private async handleDirectMessageResponse(
    userId: string,
    text: string,
    teamId: string,
  ): Promise<void> {
    try {
      // Find active standup instance for this user
      const activeInstance = await this.findActiveStandupInstanceForUser(userId, teamId);

      if (!activeInstance) {
        this.logger.debug('No active standup found for user DM', { userId, teamId });
        return;
      }

      this.logger.info('Processing DM standup response', {
        userId,
        instanceId: activeInstance.id,
        responseLength: text.length,
      });

      // Parse the response - for now, treat the entire message as one response
      // In a more sophisticated implementation, we could parse multi-line responses
      // or implement a conversational interface
      await this.submitParsedResponse(activeInstance.id, userId, text);
    } catch (error) {
      this.logger.error('Error handling DM response', {
        userId,
        teamId,
        error: this.getErrorMessage(error),
      });
    }
  }

  /**
   * Find the most recent active standup instance for a user
   */
  private async findActiveStandupInstanceForUser(platformUserId: string, teamId: string) {
    // Find team member by platform user ID
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        platformUserId,
        team: {
          integration: { externalTeamId: teamId },
        },
        active: true,
      },
      include: {
        team: {
          include: {
            instances: {
              where: {
                state: { in: ['pending', 'collecting'] },
                targetDate: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Within last 24 hours
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    return teamMember?.team.instances[0] || null;
  }

  /**
   * Submit a parsed response for a user
   */
  private async submitParsedResponse(
    instanceId: string,
    platformUserId: string,
    responseText: string,
  ): Promise<void> {
    // For simplicity, treat the entire message as an answer to all questions
    // A more sophisticated implementation could parse structured responses

    const instance = await this.prisma.standupInstance.findFirst({
      where: { id: instanceId },
      include: {
        team: {
          include: {
            members: {
              where: { platformUserId, active: true },
            },
          },
        },
      },
    });

    if (!instance || !instance.team.members[0]) {
      this.logger.warn('Instance or team member not found for response', {
        instanceId,
        platformUserId,
      });
      return;
    }

    const configSnapshot = instance.configSnapshot as {
      questions: string[];
    };
    const teamMember = instance.team.members[0];

    // Submit response for each question (using the same text for all)
    const answers = configSnapshot.questions.map((_, index) => ({
      questionIndex: index,
      text: responseText,
    }));

    this.logger.info('Submitting DM response', {
      instanceId,
      teamMemberId: teamMember.id,
      questionCount: answers.length,
    });

    try {
      // Use the AnswerCollectionService to submit the parsed response
      await this.answerCollection.submitFullResponse(
        {
          standupInstanceId: instanceId,
          answers: answers,
        },
        teamMember.id,
        instance.team.orgId,
      );

      this.logger.info('DM response submitted successfully', {
        instanceId,
        teamMemberId: teamMember.id,
        answersCount: answers.length,
      });
    } catch (error) {
      this.logger.error('Failed to submit DM response', {
        instanceId,
        teamMemberId: teamMember.id,
        error: this.getErrorMessage(error),
      });
    }
  }

  private async handleBlockActions(payload: InteractiveComponent): Promise<void> {
    const action = payload.actions?.[0];
    if (!action) return;

    const { action_id, value } = action;
    const { user, team, trigger_id } = payload;

    switch (action_id) {
      case 'submit_standup_response':
        await this.handleSubmitStandupResponse(value!, user.id, team.id, trigger_id!);
        break;

      case 'skip_standup':
        await this.handleSkipStandup(value!, user.id, team.id);
        break;

      default:
        this.logger.debug('Unhandled block action', { action_id });
    }
  }

  private async handleViewSubmission(payload: InteractiveComponent): Promise<void> {
    const { view, user, team } = payload;
    if (!view) return;

    const { callback_id, state } = view;

    // Extract instance ID from callback_id
    const match = callback_id.match(/^standup_response_(.+)$/);
    if (!match) {
      this.logger.warn('Invalid callback_id format', { callback_id });
      return;
    }

    const instanceId = match[1];
    await this.collectModalResponse(instanceId, user.id, team.id, state.values);
  }

  private async handleStandupCommand(
    text: string,
    userId: string,
    integrationId: string,
    triggerId: string,
  ): Promise<SlashCommandResponse> {
    const [subcommand, ...args] = text.split(' ');

    switch (subcommand.toLowerCase()) {
      case 'status':
        return await this.handleStatusCommand(userId, integrationId);

      case 'submit':
        return await this.handleSubmitCommand(userId, integrationId, triggerId);

      case 'skip':
        return await this.handleSkipCommand(userId, integrationId, args.join(' '));

      case 'help':
      case '':
        return this.handleHelpCommand();

      default:
        return {
          response_type: 'ephemeral',
          text: `Unknown subcommand: ${subcommand}. Type \`/standup help\` for available commands.`,
        };
    }
  }

  private async handleSubmitStandupResponse(
    instanceId: string,
    userId: string,
    teamId: string,
    triggerId: string,
  ): Promise<void> {
    try {
      const integration = await this.findIntegrationByTeamId(teamId);
      if (!integration) {
        this.logger.error('Integration not found for team', { teamId });
        return;
      }

      // Get the standup instance
      const instance = await this.prisma.standupInstance.findFirst({
        where: {
          id: instanceId,
          team: { orgId: integration.orgId },
        },
        include: {
          team: true,
        },
      });

      if (!instance) {
        this.logger.error('Standup instance not found', { instanceId });
        return;
      }

      const configSnapshot = instance.configSnapshot as { questions: string[] };
      const modal = this.formatter.createResponseModal(
        instanceId,
        configSnapshot.questions,
        userId,
      );

      await this.slackMessaging.openModal(integration.id, triggerId, modal);
    } catch (error) {
      this.logger.error('Error handling submit standup response', {
        error: this.getErrorMessage(error),
        instanceId,
        userId,
      });
    }
  }

  private async handleSkipStandup(
    instanceId: string,
    userId: string,
    teamId: string,
  ): Promise<void> {
    try {
      const integration = await this.findIntegrationByTeamId(teamId);
      if (!integration) return;

      // Find the team member
      const teamMember = await this.prisma.teamMember.findFirst({
        where: {
          team: { integrationId: integration.id },
          integrationUser: { externalUserId: userId },
        },
      });

      if (!teamMember) {
        this.logger.warn('Team member not found', { userId, integrationId: integration.id });
        return;
      }

      // Record skip (could create a separate skip table or use a special answer)
      this.logger.info('User skipped standup', {
        instanceId,
        userId,
        memberId: teamMember.id,
      });

      // Send confirmation DM
      await this.slackMessaging.sendDirectMessage(
        integration.id,
        userId,
        "✅ You've been marked as skipping today's standup.",
      );
    } catch (error) {
      this.logger.error('Error handling skip standup', {
        error: this.getErrorMessage(error),
        instanceId,
        userId,
      });
    }
  }

  private async collectModalResponse(
    instanceId: string,
    userId: string,
    teamId: string,
    values: Record<string, Record<string, { value?: string }>>,
  ): Promise<void> {
    try {
      const integration = await this.findIntegrationByTeamId(teamId);
      if (!integration) return;

      // Find the team member
      const teamMember = await this.prisma.teamMember.findFirst({
        where: {
          team: { integrationId: integration.id },
          integrationUser: { externalUserId: userId },
        },
      });

      if (!teamMember) {
        this.logger.warn('Team member not found for modal response', {
          userId,
          integrationId: integration.id,
        });
        return;
      }

      // Extract answers from the modal values
      const answers = [];
      for (const [blockId, blockValue] of Object.entries(values)) {
        const match = blockId.match(/^question_(\d+)$/);
        if (match) {
          const questionIndex = parseInt(match[1]);
          const answerValue = Object.values(blockValue)[0]?.value;

          if (answerValue && answerValue.trim()) {
            answers.push({
              questionIndex,
              answer: answerValue.trim(),
            });
          }
        }
      }

      if (answers.length === 0) {
        this.logger.warn('No answers found in modal response', { instanceId, userId });
        return;
      }

      // Submit the answers directly to the database
      for (const answer of answers) {
        await this.prisma.answer.upsert({
          where: {
            standupInstanceId_teamMemberId_questionIndex: {
              standupInstanceId: instanceId,
              teamMemberId: teamMember.id,
              questionIndex: answer.questionIndex,
            },
          },
          update: {
            text: answer.answer,
            submittedAt: new Date(),
          },
          create: {
            standupInstanceId: instanceId,
            teamMemberId: teamMember.id,
            questionIndex: answer.questionIndex,
            text: answer.answer,
            submittedAt: new Date(),
          },
        });
      }

      // Send confirmation DM
      await this.slackMessaging.sendDirectMessage(
        integration.id,
        userId,
        `✅ Your standup responses have been submitted! Thank you.`,
      );

      this.logger.info('Modal response processed successfully', {
        instanceId,
        userId,
        answersCount: answers.length,
      });
    } catch (error) {
      this.logger.error('Error collecting modal response', {
        error: this.getErrorMessage(error),
        instanceId,
        userId,
      });

      // Try to send error message to user
      try {
        const integration = await this.findIntegrationByTeamId(teamId);
        if (integration) {
          await this.slackMessaging.sendDirectMessage(
            integration.id,
            userId,
            '❌ Sorry, there was an error saving your responses. Please try again or contact your team admin.',
          );
        }
      } catch (dmError) {
        this.logger.error('Failed to send error DM', { error: this.getErrorMessage(dmError) });
      }
    }
  }

  private async handleStatusCommand(
    userId: string,
    integrationId: string,
  ): Promise<SlashCommandResponse> {
    try {
      // Find current active standup for user's team
      const teamMember = await this.prisma.teamMember.findFirst({
        where: {
          team: { integrationId },
          integrationUser: { externalUserId: userId },
        },
        include: {
          team: true,
        },
      });

      if (!teamMember) {
        return {
          response_type: 'ephemeral',
          text: 'You are not a member of any team configured for standups.',
        };
      }

      const activeInstance = await this.prisma.standupInstance.findFirst({
        where: {
          teamId: teamMember.teamId,
          state: 'collecting',
        },
        orderBy: { createdAt: 'desc' },
      });

      // Check if user has responded
      let userHasResponded = false;
      if (activeInstance) {
        const userAnswer = await this.prisma.answer.findFirst({
          where: {
            standupInstanceId: activeInstance.id,
            teamMemberId: teamMember.id,
          },
        });
        userHasResponded = !!userAnswer;
      }

      const { text, blocks } = this.formatter.formatUserStatusResponse(
        activeInstance as unknown as StandupInstance | null,
        userHasResponded,
        teamMember.team.name,
      );

      return {
        response_type: 'ephemeral',
        text,
        blocks,
      };
    } catch (error) {
      this.logger.error('Error handling status command', {
        error: this.getErrorMessage(error),
        userId,
        integrationId,
      });

      return {
        response_type: 'ephemeral',
        text: 'Sorry, I could not retrieve your standup status. Please try again.',
      };
    }
  }

  private async handleSubmitCommand(
    userId: string,
    integrationId: string,
    triggerId: string,
  ): Promise<SlashCommandResponse> {
    try {
      // Find current active standup
      const teamMember = await this.prisma.teamMember.findFirst({
        where: {
          team: { integrationId },
          integrationUser: { externalUserId: userId },
        },
      });

      if (!teamMember) {
        return {
          response_type: 'ephemeral',
          text: 'You are not a member of any team configured for standups.',
        };
      }

      const activeInstance = await this.prisma.standupInstance.findFirst({
        where: {
          teamId: teamMember.teamId,
          state: 'collecting',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!activeInstance) {
        return {
          response_type: 'ephemeral',
          text: 'No active standup found for your team.',
        };
      }

      const configSnapshot = activeInstance.configSnapshot as { questions: string[] };
      const modal = this.formatter.createResponseModal(
        activeInstance.id,
        configSnapshot.questions,
        userId,
      );

      await this.slackMessaging.openModal(integrationId, triggerId, modal);

      return {
        response_type: 'ephemeral',
        text: 'Opening standup form...',
      };
    } catch (error) {
      this.logger.error('Error handling submit command', {
        error: this.getErrorMessage(error),
        userId,
        integrationId,
      });

      return {
        response_type: 'ephemeral',
        text: 'Sorry, I could not open the standup form. Please try again.',
      };
    }
  }

  private async handleSkipCommand(
    userId: string,
    integrationId: string,
    reason: string,
  ): Promise<SlashCommandResponse> {
    try {
      // Find current active standup
      const teamMember = await this.prisma.teamMember.findFirst({
        where: {
          team: { integrationId },
          integrationUser: { externalUserId: userId },
        },
      });

      if (!teamMember) {
        return {
          response_type: 'ephemeral',
          text: 'You are not a member of any team configured for standups.',
        };
      }

      const activeInstance = await this.prisma.standupInstance.findFirst({
        where: {
          teamId: teamMember.teamId,
          state: 'collecting',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!activeInstance) {
        return {
          response_type: 'ephemeral',
          text: 'No active standup found for your team.',
        };
      }

      // Record the skip (implementation depends on how you want to track skips)
      this.logger.info('User skipped standup via command', {
        instanceId: activeInstance.id,
        userId,
        reason,
      });

      return {
        response_type: 'ephemeral',
        text:
          "✅ You've been marked as skipping today's standup." +
          (reason ? ` Reason: ${reason}` : ''),
      };
    } catch (error) {
      this.logger.error('Error handling skip command', {
        error: this.getErrorMessage(error),
        userId,
        integrationId,
      });

      return {
        response_type: 'ephemeral',
        text: 'Sorry, I could not process your skip request. Please try again.',
      };
    }
  }

  private handleHelpCommand(): SlashCommandResponse {
    const { text, blocks } = this.formatter.formatHelpMessage();

    return {
      response_type: 'ephemeral',
      text,
      blocks,
    };
  }

  private async findIntegrationByTeamId(
    teamId: string,
  ): Promise<{ id: string; orgId: string } | null> {
    try {
      const integration = await this.prisma.integration.findFirst({
        where: {
          platform: 'slack',
          externalTeamId: teamId,
        },
        select: {
          id: true,
          orgId: true,
        },
      });

      return integration;
    } catch (error) {
      this.logger.error('Error finding integration by team ID', {
        error: this.getErrorMessage(error),
        teamId,
      });
      return null;
    }
  }
}
