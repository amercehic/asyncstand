import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/common/logger.service';
import {
  SlackEventPayload,
  SlackEventCallbackPayload,
  SlackInteractivePayload,
  ProcessedSlackEvent,
} from 'shared';

@Injectable()
export class EventTransformerService {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(EventTransformerService.name);
  }

  transformEvent(payload: SlackEventPayload): ProcessedSlackEvent | null {
    try {
      if (payload.type === 'url_verification') {
        this.logger.debug('Skipping URL verification event transformation');
        return null;
      }

      if (payload.type === 'event_callback') {
        return this.transformEventCallback(payload);
      }

      this.logger.warn('Unknown event type', { type: (payload as SlackEventPayload).type });
      return null;
    } catch (error) {
      this.logger.error('Failed to transform event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        payload: this.sanitizePayload(payload),
      });
      return null;
    }
  }

  transformInteractivePayload(payload: SlackInteractivePayload): ProcessedSlackEvent {
    try {
      return {
        eventId: `interactive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        eventType: `interactive.${payload.type}`,
        teamId: payload.team.id,
        userId: payload.user.id,
        channelId: payload.channel?.id,
        timestamp: new Date().toISOString(),
        data: {
          type: payload.type,
          user: payload.user,
          channel: payload.channel,
          message: payload.message,
          actions: payload.actions,
          state: payload.state,
          view: payload.view,
          callbackId: payload.callback_id,
          responseUrl: payload.response_url,
          triggerId: payload.trigger_id,
        },
        metadata: {
          apiAppId: payload.api_app_id,
          isBot: false,
          isEnterpriseInstall: payload.is_enterprise_install,
        },
      };
    } catch (error) {
      this.logger.error('Failed to transform interactive payload', {
        error: error instanceof Error ? error.message : 'Unknown error',
        payload: this.sanitizePayload(payload),
      });
      throw error;
    }
  }

  private transformEventCallback(payload: SlackEventCallbackPayload): ProcessedSlackEvent {
    const event = payload.event;
    const authorization = payload.authorizations[0];

    return {
      eventId: payload.event_id,
      eventType: event.type,
      teamId: payload.team_id,
      userId: authorization?.user_id,
      channelId: this.extractChannelId(event as unknown as Record<string, unknown>),
      timestamp: new Date(parseInt(event.event_ts) * 1000).toISOString(),
      data: {
        ...event,
        teamId: payload.team_id,
        apiAppId: payload.api_app_id,
      },
      metadata: {
        apiAppId: payload.api_app_id,
        isBot: authorization?.is_bot || false,
        isEnterpriseInstall: authorization?.is_enterprise_install || false,
        eventContext: payload.event_context,
      },
    };
  }

  private extractChannelId(event: Record<string, unknown>): string | undefined {
    // Try common channel ID fields
    const channel = event.channel as string;
    const channelId = event.channel_id as string;
    const itemChannel = (event.item as { channel?: string })?.channel;
    return channel || channelId || itemChannel;
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

    // Remove user emails and other PII if present
    const user = sanitized.user as { profile?: { email?: string; phone?: string } } | undefined;
    if (user?.profile) {
      delete user.profile.email;
      delete user.profile.phone;
    }

    return sanitized;
  }
}
