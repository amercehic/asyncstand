import { api } from '@/lib/api-client/client';

export interface SlackIntegration {
  id: string;
  externalTeamId: string;
  tokenStatus: 'ok' | 'expired' | 'revoked' | 'error';
  scopes: string[];
  installedAt: string;
  syncState?: {
    lastUsersSyncAt?: string;
    lastChannelsSyncAt?: string;
    errorMsg?: string;
    userCount?: number;
    channelCount?: number;
  };
}

export interface SlackSyncResponse {
  success: boolean;
  usersAdded: number;
  usersUpdated: number;
  channelsAdded: number;
  channelsUpdated: number;
  errors: string[];
}

export const integrationsApi = {
  async getSlackIntegrations(): Promise<SlackIntegration[]> {
    const response = await api.get<SlackIntegration[]>('/slack/integrations');
    return response.data;
  },

  async triggerSlackSync(integrationId: string): Promise<SlackSyncResponse> {
    const response = await api.post<SlackSyncResponse>(`/slack/integrations/${integrationId}/sync`);
    return response.data;
  },

  async removeSlackIntegration(integrationId: string): Promise<{ success: boolean }> {
    const response = await api.delete<{ success: boolean }>(`/slack/integrations/${integrationId}`);
    return response.data;
  },

  // Helper method for the Create Team modal
  async getSlackIntegrationsForTeamCreation(): Promise<
    Array<{ id: string; teamName: string; isActive: boolean; platform: string }>
  > {
    const integrations = await this.getSlackIntegrations();
    return integrations.map(integration => ({
      id: integration.id,
      teamName: integration.externalTeamId,
      isActive: integration.tokenStatus === 'ok',
      platform: 'Slack',
    }));
  },

  // OAuth flow methods
  async startSlackOAuth(orgId: string): Promise<string> {
    // This returns the OAuth URL for redirection
    const response = await api.get(`/slack/oauth/start?orgId=${orgId}`, {
      maxRedirects: 0,
      validateStatus: status => status === 302, // Accept redirect response
    });
    return response.headers.location as string;
  },
};
