import { Controller, Post, Body, Headers, HttpStatus, Res, Req } from '@nestjs/common';
import { Request, Response } from 'express';
import { SlackEventService } from '@/integrations/slack/slack-event.service';
import { LoggerService } from '@/common/logger.service';

@Controller('slack')
export class SlackWebhookController {
  constructor(
    private readonly slackEventService: SlackEventService,
    private readonly logger: LoggerService,
  ) {}

  @Post('events')
  async handleSlackEvents(
    @Headers() headers: Record<string, string>,
    @Body() body: unknown,
    @Req() req: Request,
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

      // Verify the request is from Slack using the exact raw body
      const rawBuffer = (req as unknown as { body?: unknown; rawBody?: Buffer }).body;
      const rawFromRawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
      const rawBodyStr = Buffer.isBuffer(rawBuffer)
        ? rawBuffer.toString('utf8')
        : rawFromRawBody instanceof Buffer
          ? rawFromRawBody.toString('utf8')
          : typeof body === 'string'
            ? (body as string)
            : JSON.stringify(body);

      const isValid = await this.slackEventService.verifySlackRequest(headers, rawBodyStr);
      if (!isValid) {
        this.logger.warn('Invalid Slack request signature');
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid signature' });
      }

      let payload: {
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
      try {
        payload = JSON.parse(rawBodyStr);
      } catch {
        payload = (
          typeof body === 'object' && body !== null
            ? (body as Record<string, unknown>)
            : { type: 'unknown' }
        ) as typeof payload;
      }

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
        err: error,
      });

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Internal server error',
      });
    }
  }

  @Post('interactive-components')
  async handleInteractiveComponents(
    @Headers() headers: Record<string, string>,
    @Body() _body: { payload?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      this.logger.debug('Received interactive component event');

      // Verify the request is from Slack using the exact raw body
      const rawBuffer = (req as unknown as { body?: unknown; rawBody?: Buffer }).body;
      const rawFromRawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
      const rawBodyStr = Buffer.isBuffer(rawBuffer)
        ? rawBuffer.toString('utf8')
        : rawFromRawBody instanceof Buffer
          ? rawFromRawBody.toString('utf8')
          : '';

      const isValid = await this.slackEventService.verifySlackRequest(headers, rawBodyStr);
      if (!isValid) {
        this.logger.warn('Invalid Slack interactive component signature');
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid signature' });
      }

      // Slack sends the payload as a URL-encoded form parameter named "payload"
      const form = new URLSearchParams(rawBodyStr);
      const payloadParam = form.get('payload');
      if (!payloadParam) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Missing payload' });
      }

      const payload = JSON.parse(payloadParam);

      this.logger.info('Processing interactive component', {
        type: payload.type,
        teamId: payload.team?.id,
        userId: payload.user?.id,
        actionId: payload.actions?.[0]?.action_id,
      });

      // For modal submissions, we need to respond synchronously
      if (payload.type === 'view_submission') {
        try {
          await this.slackEventService.processInteractiveComponent(payload);
          // Return proper modal response - this closes the modal
          return res.json({});
        } catch (error) {
          this.logger.error('Error processing modal submission', { err: error });
          // Return error response that keeps modal open
          return res.json({
            response_action: 'errors',
            errors: {
              general: 'There was an error submitting your response. Please try again.',
            },
          });
        }
      }

      // For other interactions, process asynchronously
      setImmediate(() => {
        this.slackEventService.processInteractiveComponent(payload);
      });

      return res.json({ ok: true });
    } catch (error) {
      this.logger.error('Error handling interactive component', {
        err: error,
      });

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Internal server error',
      });
    }
  }

  @Post('slash-commands')
  async handleSlashCommands(
    @Headers() headers: Record<string, string>,
    @Body() _body: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      // Verify the request is from Slack using the exact raw body
      const rawBuffer = (req as unknown as { body?: unknown; rawBody?: Buffer }).body;
      const rawFromRawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
      const rawBodyStr = Buffer.isBuffer(rawBuffer)
        ? rawBuffer.toString('utf8')
        : rawFromRawBody instanceof Buffer
          ? rawFromRawBody.toString('utf8')
          : '';

      const isValid = await this.slackEventService.verifySlackRequest(headers, rawBodyStr);
      if (!isValid) {
        this.logger.warn('Invalid Slack slash command signature');
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid signature' });
      }

      // Form-encoded body → parse with URLSearchParams
      const form = new URLSearchParams(rawBodyStr);
      const body = Object.fromEntries(form.entries()) as Record<string, string>;

      this.logger.debug('Received slash command', {
        command: body.command,
        text: body.text,
        userId: body.user_id,
        teamId: body.team_id,
      });

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
        err: error,
        command: _body.command,
        userId: _body.user_id,
      });

      return res.json({
        response_type: 'ephemeral',
        text: 'Sorry, something went wrong processing your command. Please try again.',
      });
    }
  }
}
