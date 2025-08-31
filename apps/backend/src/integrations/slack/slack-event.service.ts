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

  constructor(
    private readonly slackMessaging: SlackMessagingService,
    private readonly formatter: SlackMessageFormatterService,
    private readonly answerCollection: AnswerCollectionService,
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {
    this.signingSecret = process.env.SLACK_SIGNING_SECRET || '';
    this.logger.setContext(SlackEventService.name);
    if (!this.signingSecret) {
      this.logger.warn('SLACK_SIGNING_SECRET not configured - webhook verification disabled');
    }
  }

  async verifySlackRequest(
    headers: Record<string, string>,
    body: unknown | string,
  ): Promise<boolean> {
    // Skip verification in test environment
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    if (!this.signingSecret) {
      this.logger.warn('Slack signing secret not configured, skipping verification');
      return true; // Allow in development
    }

    const signature = headers['x-slack-signature'];
    const timestamp = headers['x-slack-request-timestamp'];

    this.logger.debug('Signature verification details', {
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
      signature,
      timestamp,
      signingSecretLength: this.signingSecret.length,
    });

    if (!signature || !timestamp) {
      this.logger.warn('Missing signature or timestamp headers');
      return false;
    }

    // Check timestamp to prevent replay attacks (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const timestampInt = parseInt(timestamp);
    const timeDiff = Math.abs(now - timestampInt);

    this.logger.debug('Timestamp validation', {
      now,
      timestampInt,
      timeDiff,
      maxAllowed: 300,
    });

    if (timeDiff > 300) {
      this.logger.warn('Request timestamp too old', {
        now,
        timestamp: timestampInt,
        timeDiff,
      });
      return false;
    }

    // Create the signature base string
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const sigBaseString = `v0:${timestamp}:${bodyStr}`;

    this.logger.debug('Signature base string details', {
      bodyType: typeof body,
      bodyLength: bodyStr.length,
      sigBaseStringLength: sigBaseString.length,
      sigBaseStringPreview: sigBaseString.substring(0, 100) + '...',
      bodyStrPreview: bodyStr.substring(0, 100) + '...',
    });

    // Generate the expected signature
    const expectedSignature =
      'v0=' + createHmac('sha256', this.signingSecret).update(sigBaseString).digest('hex');

    this.logger.debug('Signature comparison', {
      receivedSignature: signature,
      expectedSignature,
      match: signature === expectedSignature,
    });

    // Compare signatures using timing-safe comparison
    try {
      return timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8'),
      );
    } catch (error) {
      this.logger.error('Error comparing signatures', { err: error });
      return false;
    }
  }

  async handleSlackEvent(event: SlackEvent, teamId: string): Promise<void> {
    try {
      this.logger.info('Processing Slack event', {
        eventType: event.type,
        teamId,
        userId: event.user,
        thread_ts: event.thread_ts,
        channel: event.channel,
        text: event.text?.substring(0, 50) + (event.text?.length > 50 ? '...' : ''),
        bot_id: event.bot_id,
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
      this.logger.logError(error as Error, {
        message: 'Error processing Slack event',
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
        err: error,
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
        err: error,
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
    this.logger.info('handleMessage called', {
      channel: event.channel,
      thread_ts: event.thread_ts,
      bot_id: event.bot_id,
      user: event.user,
      text_preview: event.text?.substring(0, 50),
    });

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
      this.logger.info('Thread reply detected', {
        user: event.user,
        text_length: event.text.length,
        text_preview: event.text.substring(0, 100),
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
      this.logger.info('Looking for standup instance by thread timestamp', {
        threadTs,
        channelId,
        teamId,
      });

      // Find standup instance by matching the thread timestamp to the reminder message
      // First try to find by exact thread timestamp and team
      const activeInstance = await this.prisma.standupInstance.findFirst({
        where: {
          reminderMessageTs: threadTs,
          state: { in: ['pending', 'collecting'] },
          team: {
            integration: { externalTeamId: teamId },
          },
        },
        include: {
          team: {
            select: {
              orgId: true,
              members: {
                where: {
                  OR: [
                    {
                      integrationUser: { externalUserId: userId },
                      active: true,
                    },
                    {
                      platformUserId: userId,
                      active: true,
                    },
                  ],
                },
              },
            },
          },
        },
      });

      if (!activeInstance) {
        this.logger.warn('No active standup found for thread reply', {
          userId,
          teamId,
          threadTs,
          channelId,
        });

        // Let's check what instances exist to debug
        const allInstances = await this.prisma.standupInstance.findMany({
          where: {
            state: { in: ['pending', 'collecting'] },
            team: {
              integration: { externalTeamId: teamId },
            },
          },
          select: {
            id: true,
            reminderMessageTs: true,
            state: true,
            targetDate: true,
          },
        });

        this.logger.info('Active instances for debugging', {
          instanceCount: allInstances.length,
          searchedThreadTs: threadTs,
          instances: allInstances.map((i) => ({
            id: i.id,
            reminderMessageTs: i.reminderMessageTs,
            state: i.state,
            targetDate: i.targetDate,
            timestampMatch: i.reminderMessageTs === threadTs,
          })),
        });

        // Also check team members for this user
        const teamMembers = await this.prisma.teamMember.findMany({
          where: {
            team: {
              integration: { externalTeamId: teamId },
            },
            OR: [
              {
                integrationUser: { externalUserId: userId },
                active: true,
              },
              {
                platformUserId: userId,
                active: true,
              },
            ],
          },
          select: {
            id: true,
            name: true,
            platformUserId: true,
            integrationUser: {
              select: {
                externalUserId: true,
                name: true,
              },
            },
          },
        });

        this.logger.info('Team members found for user', {
          userId,
          teamId,
          memberCount: teamMembers.length,
          members: teamMembers.map((m) => ({
            id: m.id,
            name: m.name,
            platformUserId: m.platformUserId,
            integrationUserId: m.integrationUser?.externalUserId,
            integrationUserName: m.integrationUser?.name,
          })),
        });

        return;
      }

      if (!activeInstance.team.members[0]) {
        this.logger.warn('User not a member of the team', {
          userId,
          teamId,
          instanceId: activeInstance.id,
          membersFound: activeInstance.team.members.length,
        });
        return;
      }

      const member = activeInstance.team.members[0];
      this.logger.info('Processing thread reply standup response', {
        userId,
        instanceId: activeInstance.id,
        threadTs,
        channelId,
        responseLength: text.length,
        memberInfo: {
          id: member.id,
          name: member.name,
          platformUserId: member.platformUserId,
        },
      });

      // Submit the response using the team member ID
      // Allow late submissions for Slack thread replies (extend timeout)
      await this.submitParsedResponseWithMember(
        activeInstance.id,
        activeInstance.team.members[0],
        activeInstance.team.orgId,
        text,
        true,
      );
    } catch (error) {
      this.logger.logError(error as Error, {
        message: 'Error handling thread reply',
        userId,
        teamId,
        threadTs,
        channelId,
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
      // Find active standup instance for this user with team member info
      const teamMember = await this.prisma.teamMember.findFirst({
        where: {
          platformUserId: userId,
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

      const activeInstance = teamMember?.team.instances[0];

      if (!activeInstance || !teamMember) {
        this.logger.debug('No active standup found for user DM', { userId, teamId });
        return;
      }

      this.logger.info('Processing DM standup response', {
        userId,
        instanceId: activeInstance.id,
        responseLength: text.length,
      });

      // Submit the response using the team member
      await this.submitParsedResponseWithMember(
        activeInstance.id,
        teamMember,
        teamMember.team.orgId,
        text,
      );
    } catch (error) {
      this.logger.error('Error handling DM response', {
        userId,
        teamId,
        err: error,
      });
    }
  }

  /**
   * Submit a parsed response with a known team member
   */
  private async submitParsedResponseWithMember(
    instanceId: string,
    teamMember: { id: string; name: string },
    orgId: string,
    responseText: string,
    allowNonParticipating: boolean = false,
  ): Promise<void> {
    try {
      this.logger.info('Starting submitParsedResponseWithMember', {
        instanceId,
        teamMemberId: teamMember.id,
        teamMemberName: teamMember.name,
        orgId,
        responseLength: responseText.length,
      });

      // Get the standup config to know the questions
      const instance = await this.prisma.standupInstance.findUnique({
        where: { id: instanceId },
      });

      this.logger.info('Found instance', {
        instanceId,
        found: !!instance,
        instanceTeamId: instance?.teamId,
        instanceState: instance?.state,
      });

      if (!instance) {
        this.logger.warn('Instance not found for response', { instanceId });
        return;
      }

      const configSnapshot = instance.configSnapshot as {
        questions: string[];
      };

      // Parse the response intelligently
      const answers = this.parseStandupResponse(responseText, configSnapshot.questions.length);

      this.logger.info('Submitting parsed response', {
        instanceId,
        teamMemberId: teamMember.id,
        questionCount: answers.length,
        orgId,
        answersSample: answers.slice(0, 1), // Log first answer as sample
      });

      // Use the AnswerCollectionService to submit the response
      await this.answerCollection.submitFullResponse(
        {
          standupInstanceId: instanceId,
          answers: answers,
        },
        teamMember.id, // This is the team member UUID from the database
        orgId,
        allowNonParticipating,
        true, // allowLateSubmission - bypass timeout for Slack responses
      );

      this.logger.info('Thread reply response submitted successfully', {
        instanceId,
        teamMemberId: teamMember.id,
        answersCount: answers.length,
      });
    } catch (error) {
      this.logger.logError(error as Error, {
        message: 'Failed to submit parsed response',
        instanceId,
        teamMemberId: teamMember.id,
      });
    }
  }

  /**
   * Parse standup response text into individual answers
   * Supports multiple formats:
   * 1. Numbered lists (1. answer, 2. answer, etc.)
   * 2. Bullet points (•, -, * answer)
   * 3. Line-by-line (separate lines = separate answers)
   * 4. Single response (goes to first question only)
   */
  private parseStandupResponse(
    responseText: string,
    questionCount: number,
  ): Array<{ questionIndex: number; text: string }> {
    const trimmedText = responseText.trim();
    this.logger.debug('Parsing standup response', {
      textLength: trimmedText.length,
      questionCount,
      preview: trimmedText.substring(0, 100),
    });

    // Pattern 1: Numbered responses (1. answer, 2. answer, etc.)
    const numberedMatches = this.extractNumberedAnswers(trimmedText);
    if (numberedMatches.length > 1 || (numberedMatches.length === 1 && questionCount === 1)) {
      this.logger.debug('Using numbered response format', {
        matchCount: numberedMatches.length,
        questionCount,
      });
      return this.formatAnswers(numberedMatches, questionCount, 'numbered');
    }

    // Pattern 2: Bullet point responses (• answer, - answer, * answer)
    const bulletMatches = this.extractBulletAnswers(trimmedText);
    if (bulletMatches.length > 1) {
      this.logger.debug('Using bullet point response format', {
        matchCount: bulletMatches.length,
        questionCount,
      });
      return this.formatAnswers(bulletMatches, questionCount, 'bullets');
    }

    // Pattern 3: Line-by-line responses (split by newlines)
    const lines = trimmedText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Use line-by-line if we have multiple lines that roughly match question count
    // and the lines don't look like a single narrative (too many lines suggests single response)
    if (lines.length > 1 && lines.length <= questionCount && lines.length <= 5) {
      this.logger.debug('Using line-by-line response format', {
        lineCount: lines.length,
        questionCount,
      });
      return this.formatAnswers(lines, questionCount, 'lines');
    }

    // Pattern 4: Single response for first question only
    this.logger.debug('Using single response format', {
      responseLength: trimmedText.length,
      questionCount,
    });
    return this.formatAnswers([trimmedText], questionCount, 'single');
  }

  /**
   * Extract numbered answers from text (1. answer, 2. answer, etc.)
   */
  private extractNumberedAnswers(text: string): string[] {
    // Match patterns like "1. answer", "2) answer", etc.
    // This regex captures everything from number to next number or end
    const numberedRegex = /^\s*(\d+)[.)]\s*(.+?)(?=\n\s*\d+[.)]|$)/gms;
    const matches: string[] = [];
    let match;

    while ((match = numberedRegex.exec(text)) !== null) {
      const answerText = match[2].trim().replace(/\n\s*[•\-*]\s*/g, '\n'); // Clean up bullet points within numbered items
      if (answerText) {
        matches.push(answerText);
      }
    }

    return matches;
  }

  /**
   * Extract bullet point answers from text (• answer, - answer, * answer)
   */
  private extractBulletAnswers(text: string): string[] {
    // Match patterns like "• answer", "- answer", "* answer"
    // This regex captures everything from bullet to next bullet or end
    const bulletRegex = /^\s*[•\-*]\s*(.+?)(?=\n\s*[•\-*]|\n\s*\d+[.)]|$)/gms;
    const matches: string[] = [];
    let match;

    while ((match = bulletRegex.exec(text)) !== null) {
      const answerText = match[1].trim();
      if (answerText) {
        matches.push(answerText);
      }
    }

    return matches;
  }

  /**
   * Format extracted answers into the required structure
   */
  private formatAnswers(
    extractedAnswers: string[],
    questionCount: number,
    format: string,
  ): Array<{ questionIndex: number; text: string }> {
    const answers: Array<{ questionIndex: number; text: string }> = [];

    for (let i = 0; i < questionCount; i++) {
      let text = '';

      if (format === 'single') {
        // Single response goes to first question only
        text = i === 0 ? extractedAnswers[0] || '' : '';
      } else {
        // For numbered, bullets, and lines - map directly
        text = extractedAnswers[i] || '';
      }

      answers.push({
        questionIndex: i,
        text: text.trim(),
      });
    }

    this.logger.debug('Formatted answers', {
      format,
      inputCount: extractedAnswers.length,
      outputCount: answers.length,
      filledAnswers: answers.filter((a) => a.text.length > 0).length,
    });

    return answers;
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
        err: error,
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

      // Find the team member - first try by integrationUser, then by platformUserId
      let teamMember = await this.prisma.teamMember.findFirst({
        where: {
          team: { integrationId: integration.id },
          integrationUser: { externalUserId: userId },
        },
      });

      // If not found by integrationUser, try to find by platformUserId
      if (!teamMember) {
        teamMember = await this.prisma.teamMember.findFirst({
          where: {
            team: { integrationId: integration.id },
            platformUserId: userId,
          },
        });
      }

      if (!teamMember) {
        this.logger.warn('Team member not found', { userId, integrationId: integration.id });
        return;
      }

      // Check if user has already submitted answers for this standup
      const existingAnswers = await this.prisma.answer.findFirst({
        where: {
          standupInstanceId: instanceId,
          teamMemberId: teamMember.id,
        },
      });

      if (existingAnswers) {
        this.logger.warn('User has already submitted responses, cannot skip', {
          instanceId,
          userId,
          teamMemberId: teamMember.id,
        });

        // Send message to user that they've already submitted
        await this.slackMessaging.sendDirectMessage(
          integration.id,
          userId,
          '⚠️ You have already submitted your responses for this standup and cannot skip it.',
        );
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
        err: error,
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

      // Find the team member - first try by integrationUser, then by platformUserId
      let teamMember = await this.prisma.teamMember.findFirst({
        where: {
          team: { integrationId: integration.id },
          integrationUser: { externalUserId: userId },
        },
      });

      // If not found by integrationUser, try to find by platformUserId
      if (!teamMember) {
        teamMember = await this.prisma.teamMember.findFirst({
          where: {
            team: { integrationId: integration.id },
            platformUserId: userId,
          },
        });
      }

      if (!teamMember) {
        this.logger.warn('Team member not found for modal response', {
          userId,
          integrationId: integration.id,
        });
        return;
      }

      // Check if user has already submitted responses for this standup
      const existingAnswers = await this.prisma.answer.findFirst({
        where: {
          standupInstanceId: instanceId,
          teamMemberId: teamMember.id,
        },
      });

      if (existingAnswers) {
        this.logger.warn('User has already submitted responses for this standup', {
          instanceId,
          userId,
          teamMemberId: teamMember.id,
        });

        // Send message to user that they've already submitted
        try {
          await this.slackMessaging.sendDirectMessage(
            integration.id,
            userId,
            '⚠️ You have already submitted your responses for this standup. Your previous submission remains saved.',
          );
        } catch (dmError) {
          this.logger.error('Failed to send duplicate submission message', { dmError });
        }
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
        err: error,
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
        this.logger.error('Failed to send error DM', { err: dmError });
      }
    }
  }

  private async handleStatusCommand(
    userId: string,
    integrationId: string,
  ): Promise<SlashCommandResponse> {
    try {
      // Find current active standup for user's team - first try by integrationUser, then by platformUserId
      let teamMember = await this.prisma.teamMember.findFirst({
        where: {
          team: { integrationId },
          integrationUser: { externalUserId: userId },
        },
        include: {
          team: true,
        },
      });

      // If not found by integrationUser, try to find by platformUserId
      if (!teamMember) {
        teamMember = await this.prisma.teamMember.findFirst({
          where: {
            team: { integrationId },
            platformUserId: userId,
          },
          include: {
            team: true,
          },
        });
      }

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
        err: error,
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
      // Find current active standup - first try by integrationUser, then by platformUserId
      let teamMember = await this.prisma.teamMember.findFirst({
        where: {
          team: { integrationId },
          integrationUser: { externalUserId: userId },
        },
      });

      // If not found by integrationUser, try to find by platformUserId
      if (!teamMember) {
        teamMember = await this.prisma.teamMember.findFirst({
          where: {
            team: { integrationId },
            platformUserId: userId,
          },
        });
      }

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
        err: error,
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
      // Find current active standup - first try by integrationUser, then by platformUserId
      let teamMember = await this.prisma.teamMember.findFirst({
        where: {
          team: { integrationId },
          integrationUser: { externalUserId: userId },
        },
      });

      // If not found by integrationUser, try to find by platformUserId
      if (!teamMember) {
        teamMember = await this.prisma.teamMember.findFirst({
          where: {
            team: { integrationId },
            platformUserId: userId,
          },
        });
      }

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
        err: error,
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
        err: error,
        teamId,
      });
      return null;
    }
  }
}
