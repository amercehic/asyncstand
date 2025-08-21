import type { AuthResponse, LoginRequest, SignUpRequest } from '@/types';
import { api } from '@/lib/api-client/client';

export const authApi = {
  async getCsrfToken(): Promise<string> {
    const response = await api.get<{ csrfToken: string }>('/auth/csrf-token');
    return response.data.csrfToken;
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    // CSRF token will be automatically added by the request interceptor
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

  async resetPassword(
    token: string,
    password: string,
    email: string
  ): Promise<{ message: string; success: boolean }> {
    const response = await api.post('/auth/reset-password', { token, password, email });
    return response.data;
  },
};
