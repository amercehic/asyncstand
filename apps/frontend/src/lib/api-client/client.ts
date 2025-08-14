import axios from 'axios';
import { toast } from '@/components/ui';
import { ApiErrorPayload } from 'shared';
import { env } from '@/config/env';

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
    const errorCode =
      (payload as { code?: string })?.code ||
      (error?.response?.data as { response?: { code?: string } })?.response?.code;

    // Extract message from various possible locations in the error response
    const message =
      (error?.response?.data as { title?: string })?.title || // RFC 7807 Problem Details format
      payload?.message ||
      (error?.response?.data as { response?: { message?: string } })?.response?.message ||
      (error.code === 'ERR_NETWORK' ? 'Network error – check connection' : 'Unexpected error');

    // Don't show automatic toast for endpoints that components/contexts handle specifically
    const shouldSuppressToast = [
      // Auth endpoints - handled by login/signup pages
      error.config?.url?.includes('/auth/'),
      // Standup endpoints - handled by StandupsContext
      error.config?.url?.includes('/standups'),
      // Team endpoints - handled by TeamsContext
      error.config?.url?.includes('/teams'),
      // Integration endpoints - handled by IntegrationsContext
      error.config?.url?.includes('/integrations'),
      // Missing standup config is expected for new teams
      error.response?.status === 404 && errorCode === 'STANDUP_CONFIG_NOT_FOUND',
      // Standup config conflicts are handled by components
      error.response?.status === 409 && errorCode === 'STANDUP_CONFIG_ALREADY_EXISTS',
    ].some(Boolean);

    // Only show automatic error toasts for endpoints that don't have custom handling
    if (!shouldSuppressToast) {
      toast.error('Request Failed', {
        description: message,
        duration: 5000,
      });
    }

    return Promise.reject(error);
  }
);
