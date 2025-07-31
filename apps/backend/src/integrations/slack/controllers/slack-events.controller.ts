import { Controller, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { LoggerService } from '@/common/logger.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import {
  SlackEventPayload,
  SlackInteractivePayload,
  SlackUrlVerificationEvent,
  ProcessedSlackEvent,
} from 'shared';
import { EventTransformerService } from '@/integrations/slack/services/event-transformer.service';
import { DeduplicationService } from '@/integrations/slack/services/deduplication.service';
import { HttpClientService } from '@/integrations/slack/services/http-client.service';
import { SlackInstallService } from '@/integrations/slack/services/slack-install.service';

@Controller('slack')
export class SlackEventsController {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly eventTransformer: EventTransformerService,
    private readonly deduplicationService: DeduplicationService,
    private readonly httpClient: HttpClientService,
    private readonly slackInstallService: SlackInstallService,
  ) {
    this.logger.setContext(SlackEventsController.name);
  }

  @Post('events')
  async handleEvents(@Body() payload: SlackEventPayload, @Res() res: Response): Promise<void> {
    try {
      // Handle URL verification
      if (payload.type === 'url_verification') {
        const verificationPayload = payload as SlackUrlVerificationEvent;
        this.logger.info('Handling URL verification challenge');

        res.status(HttpStatus.OK).json({
          challenge: verificationPayload.challenge,
        });
        return;
      }

      // Handle event callbacks
      if (payload.type === 'event_callback') {
        const eventId = payload.event_id;
        const teamId = payload.team_id;

        // Check if this team is connected to an organization
        const connectionStatus = await this.slackInstallService.getConnectionStatus(teamId);
        if (!connectionStatus.connected) {
          this.logger.debug(`Ignoring event from unconnected team: ${teamId}`);
          res.status(HttpStatus.OK).send('OK');
          return;
        }

        // Check for duplicates
        const isDuplicate = await this.deduplicationService.isDuplicate(eventId);
        if (isDuplicate) {
          this.logger.warn('Dropping duplicate event', { eventId });
          res.status(HttpStatus.OK).send('OK');
          return;
        }

        // Transform event
        const processedEvent = this.eventTransformer.transformEvent(payload);
        if (!processedEvent) {
          this.logger.warn('Event transformation returned null', { eventId });
          res.status(HttpStatus.OK).send('OK');
          return;
        }

        // Forward to backend processing endpoint
        await this.forwardEventToBackend(processedEvent);

        this.logger.info('Event processed successfully', {
          eventId,
          eventType: processedEvent.eventType,
          teamId: processedEvent.teamId,
        });

        res.status(HttpStatus.OK).send('OK');
        return;
      }

      // Unknown event type
      this.logger.warn('Unknown event type received', {
        type: (payload as SlackEventPayload).type,
      });
      res.status(HttpStatus.OK).send('OK');
    } catch (error) {
      this.logger.error('Failed to process Slack event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        payload: this.sanitizePayload(payload),
      });

      if (error instanceof ApiError) {
        res.status(error.getStatus()).json({
          code: (error.getResponse() as any)?.code,
          message: error.message,
        });
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          code: ErrorCode.INTERNAL,
          message: 'Internal server error',
        });
      }
    }
  }

  @Post('interactive')
  async handleInteractive(
    @Body() payload: SlackInteractivePayload,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const teamId = payload.team.id;

      // Check if this team is connected to an organization
      const connectionStatus = await this.slackInstallService.getConnectionStatus(teamId);
      if (!connectionStatus.connected) {
        this.logger.debug(`Ignoring interactive event from unconnected team: ${teamId}`);
        res.status(HttpStatus.OK).json({
          response_type: 'ephemeral',
          text: '❌ This workspace is not connected to AsyncStand. Use `/connect your-org-id` to link it.',
        });
        return;
      }

      // Generate event ID for interactive payloads
      const eventId = `interactive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Check for duplicates (using a custom ID since interactive payloads don't have event_id)
      const isDuplicate = await this.deduplicationService.isDuplicate(eventId);
      if (isDuplicate) {
        this.logger.warn('Dropping duplicate interactive event', { eventId });
        res.status(HttpStatus.OK).send('OK');
        return;
      }

      // Transform interactive payload
      const processedEvent = this.eventTransformer.transformInteractivePayload(payload);

      // Forward to backend processing endpoint
      await this.forwardEventToBackend(processedEvent);

      this.logger.info('Interactive event processed successfully', {
        eventId,
        eventType: processedEvent.eventType,
        teamId: processedEvent.teamId,
        userId: processedEvent.userId,
      });

      res.status(HttpStatus.OK).send('OK');
    } catch (error) {
      this.logger.error('Failed to process Slack interactive event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        payload: this.sanitizePayload(payload),
      });

      if (error instanceof ApiError) {
        res.status(error.getStatus()).json({
          code: (error.getResponse() as any)?.code,
          message: error.message,
        });
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          code: ErrorCode.INTERNAL,
          message: 'Internal server error',
        });
      }
    }
  }

  private async forwardEventToBackend(processedEvent: ProcessedSlackEvent): Promise<void> {
    const backendUrl = this.configService.get<string>('backendUrl') || 'http://localhost:3000';
    const endpoint = `${backendUrl}/integrations/slack/events`;

    try {
      await this.httpClient.postWithHmacSignature(
        endpoint,
        processedEvent,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
        {
          maxRetries: 5,
        },
      );

      this.logger.debug('Event forwarded to backend successfully', {
        eventId: processedEvent.eventId,
        endpoint,
      });
    } catch (error) {
      this.logger.error('Failed to forward event to backend', {
        eventId: processedEvent.eventId,
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Re-throw to trigger error response to Slack
      throw error;
    }
  }

  private sanitizePayload(
    payload: SlackEventPayload | SlackInteractivePayload,
  ): Record<string, unknown> {
    // Remove sensitive information for logging
    const sanitized = { ...payload } as Record<string, unknown>;

    // Remove tokens and secrets
    delete sanitized.token;
    delete sanitized.bot_access_token;
    delete sanitized.user_access_token;

    return sanitized;
  }
}
