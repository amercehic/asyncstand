export interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  deleted: boolean;
  is_bot: boolean;
  is_app_user: boolean;
  is_admin?: boolean;
  is_owner?: boolean;
  is_primary_owner?: boolean;
  is_restricted?: boolean;
  is_ultra_restricted?: boolean;
  has_2fa?: boolean;
  profile: {
    display_name: string;
    display_name_normalized: string;
    real_name: string;
    real_name_normalized: string;
    email?: string;
    image_24?: string;
    image_32?: string;
    image_48?: string;
    image_72?: string;
    image_192?: string;
    image_512?: string;
    image_1024?: string;
    image_original?: string;
    first_name?: string;
    last_name?: string;
    title?: string;
    phone?: string;
    skype?: string;
    status_text?: string;
    status_emoji?: string;
    status_expiration?: number;
  };
  tz?: string;
  tz_label?: string;
  tz_offset?: number;
  updated?: number;
  team_id?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  is_archived: boolean;
  is_general: boolean;
  is_shared: boolean;
  is_ext_shared: boolean;
  is_org_shared: boolean;
  is_member: boolean;
  created: number;
  creator?: string;
  topic?: {
    value: string;
    creator: string;
    last_set: number;
  };
  purpose?: {
    value: string;
    creator: string;
    last_set: number;
  };
  num_members?: number;
  locale?: string;
}

export interface SlackResponseMetadata {
  next_cursor?: string;
  previous_cursor?: string;
}

export interface SlackBaseResponse {
  ok: boolean;
  error?: string;
  warning?: string;
  response_metadata?: SlackResponseMetadata;
}

export interface SlackUsersListResponse extends SlackBaseResponse {
  members: SlackUser[];
  cache_ts?: number;
}

export interface SlackChannelsListResponse extends SlackBaseResponse {
  channels: SlackChannel[];
}

export interface SlackConversationsListResponse extends SlackBaseResponse {
  channels: SlackChannel[];
}

export interface SlackAuthTestResponse extends SlackBaseResponse {
  url: string;
  team: string;
  user: string;
  team_id: string;
  user_id: string;
  bot_id?: string;
  enterprise_id?: string;
}

export interface SlackTeamInfoResponse extends SlackBaseResponse {
  team: {
    id: string;
    name: string;
    domain: string;
    email_domain?: string;
    icon: {
      image_34?: string;
      image_44?: string;
      image_68?: string;
      image_88?: string;
      image_102?: string;
      image_132?: string;
      image_230?: string;
      image_default?: boolean;
    };
    enterprise_id?: string;
    enterprise_name?: string;
  };
}

export interface SlackError {
  ok: false;
  error: string;
}

export interface SlackRateLimitError extends SlackError {
  error: 'ratelimited';
}

export interface SlackAuthError extends SlackError {
  error: 'invalid_auth' | 'token_revoked' | 'token_expired' | 'not_authed';
}

export type SlackApiError =
  | 'invalid_auth'
  | 'token_revoked'
  | 'token_expired'
  | 'not_authed'
  | 'ratelimited'
  | 'missing_scope'
  | 'account_inactive'
  | 'user_not_found'
  | 'channel_not_found'
  | 'invalid_cursor'
  | 'limit_required'
  | 'invalid_limit'
  | 'fatal_error';

export interface SlackSyncResult {
  usersAdded: number;
  usersUpdated: number;
  channelsAdded: number;
  channelsUpdated: number;
  errors: string[];
}

export interface SlackIntegrationSyncState {
  lastUsersSyncAt?: Date;
  lastChannelsSyncAt?: Date;
  errorMsg?: string;
}

export interface SlackSyncOptions {
  forceFullSync?: boolean;
  includeDeactivatedUsers?: boolean;
  includeArchivedChannels?: boolean;
  limit?: number;
}
