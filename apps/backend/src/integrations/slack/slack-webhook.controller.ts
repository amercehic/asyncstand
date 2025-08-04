import { Controller, Post, Body, Headers, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { SlackEventService } from '@/integrations/slack/slack-event.service';
import { LoggerService } from '@/common/logger.service';

@Controller('slack')
export class SlackWebhookController {
  constructor(
    private readonly slackEventService: SlackEventService,
    private readonly logger: LoggerService,
  ) {}

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) return error.stack;
    return undefined;
  }

  @Post('events')
  async handleSlackEvents(
    @Headers() headers: Record<string, string>,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    try {
      this.logger.debug('Received Slack event', {
        headers: {
          'x-slack-signature': headers['x-slack-signature'],
          'x-slack-request-timestamp': headers['x-slack-request-timestamp'],
        },
        bodyType: typeof body,
      });

      // Verify the request is from Slack
      const isValid = await this.slackEventService.verifySlackRequest(headers, body);
      if (!isValid) {
        this.logger.warn('Invalid Slack request signature');
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid signature' });
      }

      const payload = body as {
        type: string;
        challenge?: string;
        team_id?: string;
        event?: {
          type: string;
          user?: string;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      };

      // Handle URL verification challenge
      if (payload.type === 'url_verification') {
        this.logger.info('Handling URL verification challenge');
        return res.json({ challenge: payload.challenge });
      }

      // Handle event callbacks
      if (payload.type === 'event_callback') {
        this.logger.info('Processing Slack event', {
          eventType: payload.event?.type,
          teamId: payload.team_id,
        });

        // Process event asynchronously to respond quickly to Slack
        setImmediate(() => {
          this.slackEventService.handleSlackEvent(payload.event, payload.team_id);
        });

        return res.json({ ok: true });
      }

      this.logger.warn('Unknown Slack event type', { type: payload.type });
      return res.json({ ok: true });
    } catch (error) {
      this.logger.error('Error handling Slack event', {
        error: this.getErrorMessage(error),
        stack: this.getErrorStack(error),
      });

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Internal server error',
      });
    }
  }

  @Post('interactive-components')
  async handleInteractiveComponents(
    @Headers() headers: Record<string, string>,
    @Body() body: { payload?: string },
    @Res() res: Response,
  ) {
    try {
      this.logger.debug('Received interactive component event');

      // Slack sends the payload as a URL-encoded form parameter
      const payloadStr = body.payload;
      if (!payloadStr) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Missing payload' });
      }

      const payload = JSON.parse(payloadStr);

      // Verify the request is from Slack
      const isValid = await this.slackEventService.verifySlackRequest(headers, payloadStr);
      if (!isValid) {
        this.logger.warn('Invalid Slack interactive component signature');
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid signature' });
      }

      this.logger.info('Processing interactive component', {
        type: payload.type,
        teamId: payload.team?.id,
        userId: payload.user?.id,
        actionId: payload.actions?.[0]?.action_id,
      });

      // Process interaction asynchronously
      setImmediate(() => {
        this.slackEventService.processInteractiveComponent(payload);
      });

      return res.json({ ok: true });
    } catch (error) {
      this.logger.error('Error handling interactive component', {
        error: this.getErrorMessage(error),
        stack: this.getErrorStack(error),
      });

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Internal server error',
      });
    }
  }

  @Post('slash-commands')
  async handleSlashCommands(
    @Headers() headers: Record<string, string>,
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ) {
    try {
      this.logger.debug('Received slash command', {
        command: body.command,
        text: body.text,
        userId: body.user_id,
        teamId: body.team_id,
      });

      // Verify the request is from Slack
      const isValid = await this.slackEventService.verifySlackRequest(headers, body);
      if (!isValid) {
        this.logger.warn('Invalid Slack slash command signature');
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid signature' });
      }

      // Process command and get response
      const response = await this.slackEventService.processSlashCommand(
        body as {
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
        },
      );

      return res.json(response);
    } catch (error) {
      this.logger.error('Error handling slash command', {
        error: this.getErrorMessage(error),
        stack: this.getErrorStack(error),
        command: body.command,
        userId: body.user_id,
      });

      return res.json({
        response_type: 'ephemeral',
        text: 'Sorry, something went wrong processing your command. Please try again.',
      });
    }
  }
}
