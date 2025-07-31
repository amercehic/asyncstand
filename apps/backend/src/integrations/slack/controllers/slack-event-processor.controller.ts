import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { LoggerService } from '@/common/logger.service';
import { ProcessedSlackEvent } from 'shared';
import { HmacVerificationGuard } from '@/integrations/slack/guards/hmac-verification.guard';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { SlackInstallService } from '@/integrations/slack/services/slack-install.service';
import { HttpClientService } from '@/integrations/slack/services/http-client.service';
import { AuditActorType, AuditCategory, AuditSeverity, ResourceAction } from '@/common/audit/types';

@Controller('integrations/slack')
@UseGuards(HmacVerificationGuard)
export class SlackEventProcessorController {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly slackInstall: SlackInstallService,
    private readonly httpClient: HttpClientService,
  ) {
    this.logger.setContext(SlackEventProcessorController.name);
  }

  @Post('events')
  async processEvent(@Body() event: ProcessedSlackEvent): Promise<{ status: string }> {
    try {
      this.logger.info('Processing Slack event', {
        eventId: event.eventId,
        eventType: event.eventType,
        teamId: event.teamId,
        userId: event.userId,
        channelId: event.channelId,
        timestamp: event.timestamp,
      });

      // 1. Validate the event data
      const validationResult = await this.validateEventData(event);
      if (!validationResult.isValid) {
        this.logger.warn('Event validation failed', {
          eventId: event.eventId,
          reason: validationResult.reason,
        });
        return { status: 'validation_failed' };
      }

      // 2. Get organization context
      const connectionStatus = await this.slackInstall.getConnectionStatus(event.teamId);
      if (!connectionStatus.connected || !connectionStatus.orgId) {
        this.logger.warn('Event from unconnected team', {
          eventId: event.eventId,
          teamId: event.teamId,
        });
        return { status: 'team_not_connected' };
      }

      // 3. Apply business logic based on event type
      await this.processEventByType(event, connectionStatus.orgId);

      // 4. Log the event processing for audit trail
      await this.auditLog.log({
        orgId: connectionStatus.orgId,
        actorType: AuditActorType.SERVICE,
        action: `slack_event_processed.${event.eventType}`,
        category: AuditCategory.INTEGRATION,
        severity: AuditSeverity.LOW,
        resources: [
          {
            type: 'slack_event',
            id: event.eventId,
            action: ResourceAction.ACCESSED,
          },
        ],
        requestData: {
          method: 'POST',
          path: '/integrations/slack/events',
          ipAddress: 'slack-platform',
        },
        tags: ['slack', 'event_processing'],
      });

      this.logger.info('Slack event processed successfully', {
        eventId: event.eventId,
        eventType: event.eventType,
      });

      return { status: 'processed' };
    } catch (error) {
      this.logger.error('Failed to process Slack event', {
        eventId: event.eventId,
        eventType: event.eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Don't throw - return success to prevent Slack retries
      // Log the error for monitoring and debugging
      return { status: 'error' };
    }
  }

  private async processEventByType(event: ProcessedSlackEvent, orgId: string): Promise<void> {
    switch (event.eventType) {
      case 'message':
        await this.handleMessageEvent(event, orgId);
        break;

      case 'app_mention':
        await this.handleAppMentionEvent(event, orgId);
        break;

      case 'member_joined_channel':
        await this.handleMemberJoinedEvent(event, orgId);
        break;

      case 'interactive.block_actions':
        await this.handleInteractiveBlockActions(event, orgId);
        break;

      case 'interactive.message_action':
        await this.handleInteractiveMessageAction(event, orgId);
        break;

      default:
        this.logger.debug('Unhandled event type', {
          eventType: event.eventType,
          eventId: event.eventId,
        });
        break;
    }
  }

  private async handleMessageEvent(event: ProcessedSlackEvent, orgId: string): Promise<void> {
    this.logger.debug('Processing message event', {
      eventId: event.eventId,
      channelId: event.channelId,
      userId: event.userId,
    });

    // Skip bot messages to prevent loops
    if (event.metadata.isBot) {
      this.logger.debug('Skipping bot message', { eventId: event.eventId });
      return;
    }

    // Check if this channel is associated with a team
    const team = await this.prisma.team.findFirst({
      where: {
        orgId,
        channelId: event.channelId,
      },
      include: {
        members: true,
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
    });

    if (!team) {
      this.logger.debug('Message in non-team channel, ignoring', {
        eventId: event.eventId,
        channelId: event.channelId,
      });
      return;
    }

    // Find or create team member
    let teamMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_platformUserId: {
          teamId: team.id,
          platformUserId: event.userId!,
        },
      },
    });

    if (!teamMember) {
      // Create team member if they don't exist
      teamMember = await this.prisma.teamMember.create({
        data: {
          teamId: team.id,
          platformUserId: event.userId!,
          name: (event.data.user as { name?: string })?.name || 'Unknown User',
          active: true,
        },
      });

      this.logger.info('Created new team member', {
        teamMemberId: teamMember.id,
        platformUserId: event.userId,
        teamId: team.id,
      });
    }

    // Check if this message could be a standup answer
    const messageText = event.data.text as string;
    if (messageText && this.looksLikeStandupAnswer(messageText)) {
      await this.handlePotentialStandupAnswer(event, team, teamMember, messageText);
    }
  }

  private async handleAppMentionEvent(event: ProcessedSlackEvent, orgId: string): Promise<void> {
    this.logger.debug('Processing app mention event', {
      eventId: event.eventId,
      channelId: event.channelId,
      userId: event.userId,
    });

    const messageText = ((event.data.text as string) || '').toLowerCase();
    const channelId = event.channelId!;
    const integration = await this.prisma.integration.findFirst({
      where: {
        orgId,
        externalTeamId: event.teamId,
      },
    });

    if (!integration?.botToken) {
      this.logger.error('No bot token found for team', { teamId: event.teamId });
      return;
    }

    // Handle different mention commands
    if (messageText.includes('help')) {
      await this.sendHelpMessage(integration.botToken, channelId);
    } else if (messageText.includes('status')) {
      await this.sendStatusMessage(integration.botToken, channelId, orgId);
    } else if (messageText.includes('setup') || messageText.includes('configure')) {
      await this.sendSetupMessage(integration.botToken, channelId);
    } else {
      // Default response
      await this.sendDefaultMentionResponse(integration.botToken, channelId);
    }
  }

  private async handleMemberJoinedEvent(event: ProcessedSlackEvent, orgId: string): Promise<void> {
    this.logger.debug('Processing member joined event', {
      eventId: event.eventId,
      channelId: event.channelId,
      userId: event.userId,
    });

    // Check if this channel is associated with a team
    const team = await this.prisma.team.findFirst({
      where: {
        orgId,
        channelId: event.channelId,
      },
      include: {
        integration: true,
      },
    });

    if (!team) {
      this.logger.debug('Member joined non-team channel, ignoring', {
        eventId: event.eventId,
        channelId: event.channelId,
      });
      return;
    }

    // Create team member if they don't exist
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_platformUserId: {
          teamId: team.id,
          platformUserId: event.userId!,
        },
      },
    });

    if (!existingMember) {
      const teamMember = await this.prisma.teamMember.create({
        data: {
          teamId: team.id,
          platformUserId: event.userId!,
          name: (event.data.user as { name?: string })?.name || 'Unknown User',
          active: true,
        },
      });

      this.logger.info('Created team member for new channel member', {
        teamMemberId: teamMember.id,
        platformUserId: event.userId,
        teamId: team.id,
      });

      // Send welcome message
      if (team.integration?.botToken) {
        await this.sendWelcomeMessage(team.integration.botToken, event.channelId!, event.userId!);
      }
    }
  }

  private async handleInteractiveBlockActions(
    event: ProcessedSlackEvent,
    orgId: string,
  ): Promise<void> {
    this.logger.debug('Processing interactive block actions', {
      eventId: event.eventId,
      userId: event.userId,
      actions: event.data.actions,
    });

    const actions = event.data.actions as Array<{
      action_id: string;
      value?: string;
      selected_option?: { value: string };
    }>;

    for (const action of actions) {
      switch (action.action_id) {
        case 'submit_standup_answer':
          await this.handleSubmitStandupAnswer(event, orgId, action);
          break;
        case 'submit_standup_in_channel':
          await this.handleSubmitStandupInChannel(event, orgId, action);
          break;
        case 'submit_standup_reminder':
          await this.handleSubmitStandupReminder(event, orgId, action);
          break;
        case 'skip_standup':
          await this.handleSkipStandup(event);
          break;
        case 'skip_standup_today':
          await this.handleSkipStandupToday(event, orgId, action);
          break;
        case 'request_help':
          await this.handleHelpRequest(event, orgId);
          break;
        default:
          this.logger.debug('Unknown block action', {
            actionId: action.action_id,
            eventId: event.eventId,
          });
          break;
      }
    }
  }

  private async handleInteractiveMessageAction(
    event: ProcessedSlackEvent,
    orgId: string,
  ): Promise<void> {
    this.logger.debug('Processing interactive message action', {
      eventId: event.eventId,
      userId: event.userId,
      callbackId: event.data.callbackId,
    });

    const callbackId = event.data.callbackId as string;

    switch (callbackId) {
      case 'create_standup_from_message':
        await this.handleCreateStandupFromMessage(event);
        break;
      case 'add_to_standup_team':
        await this.handleAddToStandupTeam(event);
        break;
      case 'report_message':
        await this.handleReportMessage(event, orgId);
        break;
      default:
        this.logger.debug('Unknown message action', {
          callbackId,
          eventId: event.eventId,
        });
        break;
    }
  }

  // Helper methods for event validation and processing
  private async validateEventData(
    event: ProcessedSlackEvent,
  ): Promise<{ isValid: boolean; reason?: string }> {
    if (!event.eventType) {
      return { isValid: false, reason: 'Missing event type' };
    }

    if (!event.teamId) {
      return { isValid: false, reason: 'Missing team ID' };
    }

    if (!event.timestamp) {
      return { isValid: false, reason: 'Missing timestamp' };
    }

    // Check if event is too old (more than 5 minutes)
    const eventTime = new Date(event.timestamp).getTime();
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    if (eventTime < fiveMinutesAgo) {
      return { isValid: false, reason: 'Event too old' };
    }

    return { isValid: true };
  }

  private looksLikeStandupAnswer(text: string): boolean {
    const standupIndicators = [
      'yesterday',
      'today',
      'tomorrow',
      '1.',
      '2.',
      '3.',
      'did:',
      'doing:',
      'will do:',
      'blockers:',
      'blocked by:',
    ];

    const lowerText = text.toLowerCase();
    return standupIndicators.some((indicator) => lowerText.includes(indicator));
  }

  private async handlePotentialStandupAnswer(
    event: ProcessedSlackEvent,
    team: { id: string; members: unknown[]; configs: unknown[] },
    teamMember: { id: string },
    messageText: string,
  ): Promise<void> {
    // Find the most recent active standup instance for this team
    const activeStandup = await this.prisma.standupInstance.findFirst({
      where: {
        teamId: team.id,
        state: 'collecting',
        targetDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)), // Today
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!activeStandup) {
      this.logger.debug('No active standup found for potential answer', {
        teamId: team.id,
        eventId: event.eventId,
      });
      return;
    }

    // Parse the message into answers
    const answers = this.parseStandupAnswers(messageText);

    // Store answers in database
    for (let i = 0; i < answers.length; i++) {
      await this.prisma.answer.upsert({
        where: {
          standupInstanceId_teamMemberId_questionIndex: {
            standupInstanceId: activeStandup.id,
            teamMemberId: teamMember.id,
            questionIndex: i,
          },
        },
        create: {
          standupInstanceId: activeStandup.id,
          teamMemberId: teamMember.id,
          questionIndex: i,
          text: answers[i],
        },
        update: {
          text: answers[i],
          submittedAt: new Date(),
        },
      });
    }

    this.logger.info('Standup answers saved', {
      standupInstanceId: activeStandup.id,
      teamMemberId: teamMember.id,
      answersCount: answers.length,
    });
  }

  private parseStandupAnswers(text: string): string[] {
    // Simple parsing logic - split by numbers or common separators
    const lines = text.split('\n').filter((line) => line.trim());
    const answers: string[] = [];

    let currentAnswer = '';
    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.match(/^[0-9]+\./) || trimmedLine.match(/^[•\-*]/)) {
        if (currentAnswer) {
          answers.push(currentAnswer.trim());
        }
        currentAnswer = trimmedLine.replace(/^[0-9]+\.|\s*[•\-*]\s*/, '');
      } else {
        currentAnswer += ' ' + trimmedLine;
      }
    }

    if (currentAnswer) {
      answers.push(currentAnswer.trim());
    }

    return answers.length > 0 ? answers : [text.trim()];
  }

  // Slack API helper methods
  private async sendHelpMessage(botToken: string, channelId: string): Promise<void> {
    const helpMessage = {
      channel: channelId,
      text: 'AsyncStand Help',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*AsyncStand Help* 🤖',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Available commands:\n• `@asyncstand help` - Show this help message\n• `@asyncstand status` - Check team setup status\n• `@asyncstand setup` - Get setup instructions',
          },
        },
      ],
    };

    await this.sendSlackMessage(botToken, helpMessage);
  }

  private async sendStatusMessage(
    botToken: string,
    channelId: string,
    orgId: string,
  ): Promise<void> {
    const team = await this.prisma.team.findFirst({
      where: {
        orgId,
        channelId,
      },
      include: {
        members: true,
        configs: true,
      },
    });

    const statusMessage = {
      channel: channelId,
      text: team ? 'Team Status' : 'No Team Setup',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: team
              ? `*Team Status* ✅\n• Members: ${team.members.length}\n• Configs: ${team.configs.length}\n• Channel: <#${channelId}>`
              : '*No Team Setup* ❌\nThis channel is not configured for standups yet.',
          },
        },
      ],
    };

    await this.sendSlackMessage(botToken, statusMessage);
  }

  private async sendSetupMessage(botToken: string, channelId: string): Promise<void> {
    const setupMessage = {
      channel: channelId,
      text: 'Setup Instructions',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Setup AsyncStand* 🚀\n\n1. Visit your AsyncStand dashboard\n2. Create a new team\n3. Link this channel to the team\n4. Configure your standup schedule',
          },
        },
      ],
    };

    await this.sendSlackMessage(botToken, setupMessage);
  }

  private async sendDefaultMentionResponse(botToken: string, channelId: string): Promise<void> {
    const defaultMessage = {
      channel: channelId,
      text: 'Hello! 👋',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: "👋 Hello! I'm the AsyncStand bot.\n\nTry `@asyncstand help` for available commands.",
          },
        },
      ],
    };

    await this.sendSlackMessage(botToken, defaultMessage);
  }

  private async sendWelcomeMessage(
    botToken: string,
    channelId: string,
    userId: string,
  ): Promise<void> {
    const welcomeMessage = {
      channel: channelId,
      text: `Welcome <@${userId}>!`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `👋 Welcome to the team, <@${userId}>! \n\nThis channel is set up for AsyncStand standups. You'll receive notifications when it's time to share your updates.`,
          },
        },
      ],
    };

    await this.sendSlackMessage(botToken, welcomeMessage);
  }

  private async sendSlackMessage(
    botToken: string,
    message: Record<string, unknown>,
  ): Promise<void> {
    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        this.logger.error('Failed to send Slack message', {
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (error) {
      this.logger.error('Error sending Slack message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Interactive action handlers
  private async handleSubmitStandupAnswer(
    event: ProcessedSlackEvent,
    orgId: string,
    action: { action_id: string; value?: string; selected_option?: { value: string } },
  ): Promise<void> {
    this.logger.info('Handling standup answer submission', {
      eventId: event.eventId,
      userId: event.userId,
      actionValue: action.value,
    });

    // Implementation would depend on the specific UI flow
    // This is a placeholder for handling standup answer submissions
  }

  private async handleSubmitStandupInChannel(
    event: ProcessedSlackEvent,
    orgId: string,
    action: { action_id: string; value?: string; selected_option?: { value: string } },
  ): Promise<void> {
    const standupInstanceId = action.value;

    if (!standupInstanceId) {
      this.logger.warn('No standup instance ID provided', { eventId: event.eventId });
      return;
    }

    // Get integration for bot token
    const integration = await this.prisma.integration.findFirst({
      where: {
        orgId,
        externalTeamId: event.teamId,
      },
    });

    if (!integration?.botToken) {
      this.logger.error('No bot token found for team', { teamId: event.teamId });
      return;
    }

    // Get standup instance to get questions
    const standupInstance = await this.prisma.standupInstance.findUnique({
      where: { id: standupInstanceId },
      include: {
        team: true,
      },
    });

    if (!standupInstance) {
      this.logger.warn('Standup instance not found', { standupInstanceId });
      return;
    }

    const questions = (standupInstance.configSnapshot as any)?.questions || [];

    // Send instructions to channel
    const instructionMessage = {
      channel: standupInstance.team.channelId,
      text: `<@${event.userId}> is submitting their standup!`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📝 <@${event.userId}> please share your standup answers here!\n\n*Questions:*\n${questions.map((q: any, i: number) => `*${i + 1}.* ${q}`).join('\n')}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: "💡 Just type your answers naturally - I'll detect and save them automatically!",
            },
          ],
        },
      ],
    };

    await this.sendSlackMessage(integration.botToken, instructionMessage);
  }

  private async handleSubmitStandupReminder(
    event: ProcessedSlackEvent,
    orgId: string,
    action: { action_id: string; value?: string; selected_option?: { value: string } },
  ): Promise<void> {
    // Same as handleSubmitStandupInChannel - redirect to channel
    await this.handleSubmitStandupInChannel(event, orgId, action);
  }

  private async handleSkipStandupToday(
    event: ProcessedSlackEvent,
    orgId: string,
    action: { action_id: string; value?: string; selected_option?: { value: string } },
  ): Promise<void> {
    const standupInstanceId = action.value;

    if (!standupInstanceId) {
      this.logger.warn('No standup instance ID provided', { eventId: event.eventId });
      return;
    }

    // Find team member
    const team = await this.prisma.team.findFirst({
      where: {
        orgId,
        integration: {
          externalTeamId: event.teamId,
        },
      },
    });

    if (!team) {
      this.logger.warn('Team not found', { eventId: event.eventId });
      return;
    }

    const teamMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_platformUserId: {
          teamId: team.id,
          platformUserId: event.userId!,
        },
      },
    });

    if (!teamMember) {
      this.logger.warn('Team member not found', { eventId: event.eventId });
      return;
    }

    // Record skip by creating empty answers for all questions
    const standupInstance = await this.prisma.standupInstance.findUnique({
      where: { id: standupInstanceId },
    });

    if (!standupInstance) {
      this.logger.warn('Standup instance not found', { standupInstanceId });
      return;
    }

    const questions = (standupInstance.configSnapshot as any)?.questions || [];

    // Create "skip" answers
    for (let i = 0; i < questions.length; i++) {
      await this.prisma.answer.upsert({
        where: {
          standupInstanceId_teamMemberId_questionIndex: {
            standupInstanceId,
            teamMemberId: teamMember.id,
            questionIndex: i,
          },
        },
        create: {
          standupInstanceId,
          teamMemberId: teamMember.id,
          questionIndex: i,
          text: '_Skipped today_',
        },
        update: {
          text: '_Skipped today_',
          submittedAt: new Date(),
        },
      });
    }

    // Get integration for response
    const integration = await this.prisma.integration.findFirst({
      where: {
        orgId,
        externalTeamId: event.teamId,
      },
    });

    if (integration?.botToken) {
      // Send confirmation DM
      const confirmationMessage = {
        channel: event.userId!,
        text: 'Standup skipped',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: "✅ *Standup skipped for today*\n\nNo worries! We'll catch up with you tomorrow.",
            },
          },
        ],
      };

      await this.sendSlackMessage(integration.botToken, confirmationMessage);
    }

    this.logger.info('User skipped standup', {
      standupInstanceId,
      teamMemberId: teamMember.id,
      userId: event.userId,
    });
  }

  private async handleSkipStandup(event: ProcessedSlackEvent): Promise<void> {
    this.logger.info('Handling standup skip', {
      eventId: event.eventId,
      userId: event.userId,
    });

    // Mark user as skipped for today's standup
    // Implementation would depend on business logic
  }

  private async handleHelpRequest(event: ProcessedSlackEvent, orgId: string): Promise<void> {
    const integration = await this.prisma.integration.findFirst({
      where: {
        orgId,
        externalTeamId: event.teamId,
      },
    });

    if (integration?.botToken && event.channelId) {
      await this.sendHelpMessage(integration.botToken, event.channelId);
    }
  }

  private async handleCreateStandupFromMessage(event: ProcessedSlackEvent): Promise<void> {
    this.logger.info('Handling create standup from message', {
      eventId: event.eventId,
      userId: event.userId,
    });

    // Implementation for creating standup from a message context
  }

  private async handleAddToStandupTeam(event: ProcessedSlackEvent): Promise<void> {
    this.logger.info('Handling add to standup team', {
      eventId: event.eventId,
      userId: event.userId,
    });

    // Implementation for adding user to standup team
  }

  private async handleReportMessage(event: ProcessedSlackEvent, orgId: string): Promise<void> {
    this.logger.info('Handling message report', {
      eventId: event.eventId,
      userId: event.userId,
    });

    // Log the report for moderation
    await this.auditLog.log({
      orgId,
      actorType: AuditActorType.USER,
      action: 'slack_message_reported',
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.MEDIUM,
      resources: [
        {
          type: 'slack_message',
          id: event.eventId,
          action: ResourceAction.ACCESSED,
        },
      ],
      requestData: {
        method: 'POST',
        path: '/integrations/slack/events',
        ipAddress: 'slack-platform',
      },
      tags: ['slack', 'moderation', 'report'],
    });
  }
}
