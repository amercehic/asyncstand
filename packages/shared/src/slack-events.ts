export interface SlackEventBase {
  type: string;
  event_ts: string;
  event_id?: string;
}

export interface SlackUrlVerificationEvent {
  token: string;
  challenge: string;
  type: 'url_verification';
}

export interface SlackEventCallbackPayload {
  token: string;
  team_id: string;
  api_app_id: string;
  event: SlackEventBase;
  type: 'event_callback';
  event_id: string;
  event_time: number;
  authorizations: Array<{
    enterprise_id?: string;
    team_id: string;
    user_id: string;
    is_bot: boolean;
    is_enterprise_install: boolean;
  }>;
  is_ext_shared_channel: boolean;
  event_context?: string;
}

export interface SlackInteractivePayload {
  type:
    | 'block_actions'
    | 'interactive_message'
    | 'dialog_submission'
    | 'message_action'
    | 'shortcut'
    | 'view_submission'
    | 'view_closed';
  user: {
    id: string;
    username: string;
    name: string;
    team_id: string;
  };
  api_app_id: string;
  token: string;
  trigger_id?: string;
  team: {
    id: string;
    domain: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  is_enterprise_install: boolean;
  channel?: {
    id: string;
    name: string;
  };
  message?: Record<string, unknown>;
  state?: Record<string, unknown>;
  response_url?: string;
  actions?: Record<string, unknown>[];
  callback_id?: string;
  view?: Record<string, unknown>;
}

export type SlackEventPayload = SlackUrlVerificationEvent | SlackEventCallbackPayload;

export interface ProcessedSlackEvent {
  eventId: string;
  eventType: string;
  teamId: string;
  userId?: string;
  channelId?: string;
  timestamp: string;
  data: Record<string, unknown>;
  metadata: {
    apiAppId: string;
    isBot: boolean;
    isEnterpriseInstall: boolean;
    eventContext?: string;
  };
}
