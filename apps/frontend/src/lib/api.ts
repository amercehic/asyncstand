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
  StandupConfig,
  CreateStandupConfigRequest,
  StandupInstance,
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

  async createTeam(data: CreateTeamRequest): Promise<Team> {
    const response = await api.post<Team>('/teams', data);
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
};

// Standups API functions
export const standupsApi = {
  async getTeamStandups(teamId: string): Promise<StandupConfig[]> {
    const response = await api.get<StandupConfig[]>(`/teams/${teamId}/standups`);
    return response.data;
  },

  async getStandup(standupId: string): Promise<StandupConfig> {
    const response = await api.get<StandupConfig>(`/standups/${standupId}`);
    return response.data;
  },

  async createStandup(data: CreateStandupConfigRequest): Promise<StandupConfig> {
    const response = await api.post<StandupConfig>(`/teams/${data.teamId}/standups`, data);
    return response.data;
  },

  async updateStandup(
    standupId: string,
    data: Partial<CreateStandupConfigRequest>
  ): Promise<StandupConfig> {
    const response = await api.put<StandupConfig>(`/standups/${standupId}`, data);
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

  async submitResponse(
    instanceId: string,
    answers: Record<string, string>
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/instances/${instanceId}/responses`, { answers });
    return response.data;
  },

  async updateResponse(
    instanceId: string,
    answers: Record<string, string>
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.put(`/instances/${instanceId}/responses`, { answers });
    return response.data;
  },
};
