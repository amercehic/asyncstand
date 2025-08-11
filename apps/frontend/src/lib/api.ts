import axios from 'axios';
import { toast } from 'sonner';
import { ApiErrorPayload } from 'shared';
import { env } from '@/config/env';
import type {
  LoginRequest,
  SignUpRequest,
  AuthResponse,
  Team,
  CreateTeamRequest,
  UpdateTeamRequest,
  Standup,
  StandupInstance,
  StandupResponse,
} from '@/types';

export const api = axios.create({
  baseURL: env.apiUrl,
  timeout: env.apiTimeout,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const getAuthToken = () => authToken;

// Request interceptor
api.interceptors.request.use(
  config => {
    // Add auth token to requests if available
    if (authToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    if (env.enableDebug) {
      console.log('API Request:', config);
    }
    return config;
  },
  error => {
    if (env.enableDebug) {
      console.error('API Request Error:', error);
    }
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  response => {
    if (env.enableDebug) {
      console.log('API Response:', response);
    }
    return response;
  },
  error => {
    if (env.enableDebug) {
      console.error('API Response Error:', error);
    }

    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401 && authToken) {
      // Clear invalid token and redirect to login
      setAuthToken(null);
      // Clear from both localStorage and sessionStorage
      ['auth_tokens', 'auth_user', 'user_organizations'].forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      localStorage.removeItem('auth_remember_me');

      // Only show auth error if not already on login/signup pages
      if (
        !window.location.pathname.includes('/login') &&
        !window.location.pathname.includes('/signup')
      ) {
        toast.error('Session expired', {
          description: 'Please log in again',
        });
        // Redirect to login page
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    const payload = error?.response?.data as ApiErrorPayload | undefined;
    const message =
      payload?.message ??
      (error.code === 'ERR_NETWORK' ? 'Network error – check connection' : 'Unexpected error');

    // Don't show toast for auth endpoints - let components handle these
    if (!error.config?.url?.includes('/auth/')) {
      toast.error('API Error', {
        description: message,
      });
    }

    return Promise.reject(error);
  }
);

// Authentication API functions
export const authApi = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  async signup(data: SignUpRequest): Promise<{ id: string; email: string; name: string }> {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async forgotPassword(email: string): Promise<{ message: string; success: boolean }> {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(data: {
    token: string;
    password: string;
    email: string;
  }): Promise<{ message: string; success: boolean }> {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  },
};

// Teams API functions
export const teamsApi = {
  async getTeams(): Promise<Team[]> {
    const response = await api.get<Team[]>('/teams');
    return response.data;
  },

  async getTeam(teamId: string): Promise<Team> {
    const response = await api.get<Team>(`/teams/${teamId}`);
    return response.data;
  },

  async createTeam(data: CreateTeamRequest): Promise<{ id: string }> {
    const response = await api.post<{ id: string }>('/teams', data);
    return response.data;
  },

  async updateTeam(teamId: string, data: UpdateTeamRequest): Promise<Team> {
    const response = await api.put<Team>(`/teams/${teamId}`, data);
    return response.data;
  },

  async deleteTeam(teamId: string): Promise<void> {
    await api.delete(`/teams/${teamId}`);
  },

  async inviteUser(teamId: string, email: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/teams/${teamId}/invite`, { email });
    return response.data;
  },

  async removeUser(teamId: string, userId: string): Promise<void> {
    await api.delete(`/teams/${teamId}/members/${userId}`);
  },

  async getAvailableChannels(): Promise<{
    channels: Array<{ id: string; name: string; isAssigned: boolean }>;
  }> {
    const response = await api.get('/teams/slack/channels');
    return response.data;
  },

  async getAvailableMembers(): Promise<{
    members: Array<{ id: string; name: string; platformUserId: string }>;
  }> {
    const response = await api.get('/teams/slack/members');
    return response.data;
  },
};

// Slack Integration Types
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

// Integrations API functions
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
    return response.headers.location;
  },
};

// Standups API functions
export const standupsApi = {
  async getStandupsByTeam(teamId: string): Promise<Standup[]> {
    const response = await api.get<Standup[]>(`/teams/${teamId}/standups`);
    return response.data;
  },

  async getStandup(standupId: string): Promise<Standup> {
    const response = await api.get<Standup>(`/standups/${standupId}`);
    return response.data;
  },

  async createStandup(teamId: string, data: Partial<Standup>): Promise<Standup> {
    const response = await api.post<Standup>(`/teams/${teamId}/standups`, data);
    return response.data;
  },

  async updateStandup(standupId: string, data: Partial<Standup>): Promise<Standup> {
    const response = await api.put<Standup>(`/standups/${standupId}`, data);
    return response.data;
  },

  async deleteStandup(standupId: string): Promise<void> {
    await api.delete(`/standups/${standupId}`);
  },

  async getStandupInstances(standupId: string): Promise<StandupInstance[]> {
    const response = await api.get<StandupInstance[]>(`/standups/${standupId}/instances`);
    return response.data;
  },

  async getInstance(instanceId: string): Promise<StandupInstance> {
    const response = await api.get<StandupInstance>(`/instances/${instanceId}`);
    return response.data;
  },

  async triggerStandup(standupId: string): Promise<StandupInstance> {
    const response = await api.post<StandupInstance>(`/standups/${standupId}/trigger`);
    return response.data;
  },

  async getInstanceResponses(instanceId: string): Promise<StandupResponse[]> {
    const response = await api.get<StandupResponse[]>(`/instances/${instanceId}/responses`);
    return response.data;
  },

  async submitResponse(
    instanceId: string,
    answers: Record<string, string>
  ): Promise<StandupResponse> {
    const response = await api.post<StandupResponse>(`/instances/${instanceId}/responses`, {
      answers,
    });
    return response.data;
  },

  async updateResponse(
    responseId: string,
    answers: Record<string, string>
  ): Promise<StandupResponse> {
    const response = await api.put<StandupResponse>(`/responses/${responseId}`, { answers });
    return response.data;
  },
};
