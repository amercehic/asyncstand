export interface ISlackApiService {
  /**
   * Make a generic API call to Slack
   */
  callSlackApi<T>(
    integrationId: string,
    endpoint: string,
    params?: Record<string, unknown>,
  ): Promise<T>;

  /**
   * Sync workspace data (users and channels)
   */
  syncWorkspaceData(integrationId: string): Promise<{
    usersAdded: number;
    usersUpdated: number;
    channelsAdded: number;
    channelsUpdated: number;
    errors: string[];
  }>;
}

// Slack API response types
export interface SlackConversationInfo {
  ok: boolean;
  channel: {
    id: string;
    name: string;
    is_channel: boolean;
    is_private: boolean;
    is_archived: boolean;
    topic?: {
      value: string;
    };
    purpose?: {
      value: string;
    };
  };
  error?: string;
}

export interface SlackUserInfo {
  ok: boolean;
  user: {
    id: string;
    name: string;
    profile: {
      display_name?: string;
      real_name?: string;
      email?: string;
      image_512?: string;
      image_192?: string;
    };
    deleted?: boolean;
    is_bot?: boolean;
    is_app_user?: boolean;
  };
  error?: string;
}
