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
let csrfToken: string | null = null;

// Generate a unique session ID for CSRF token consistency
const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2)}`;
api.defaults.headers.common['X-Session-Id'] = sessionId;

// CSRF token management
const getCsrfToken = async (): Promise<string> => {
  if (!csrfToken) {
    try {
      const response = await api.get<{ csrfToken: string }>('/auth/csrf-token');
      csrfToken = response.data.csrfToken;
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error);
      throw error;
    }
  }
  return csrfToken;
};

export const clearCsrfToken = () => {
  csrfToken = null;
};

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
  async config => {
    // Add auth token to requests if available
    if (authToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    // Add CSRF token for state-changing requests
    const method = config.method?.toLowerCase();
    const needsCsrfToken = ['post', 'put', 'patch', 'delete'].includes(method || '');

    if (
      needsCsrfToken &&
      !config.headers['X-CSRF-Token'] &&
      !config.url?.includes('/auth/csrf-token')
    ) {
      try {
        const token = await getCsrfToken();
        config.headers['X-CSRF-Token'] = token;
      } catch (error) {
        console.error('Failed to get CSRF token for request:', error);
        // Continue without CSRF token - let the server handle the error
      }
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
      clearCsrfToken();
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

    // Handle 403 CSRF token errors - clear CSRF token and retry once
    if (error.response?.status === 403) {
      const errorResponse = error.response.data;
      const isCSRFError =
        errorResponse?.response?.error === 'CSRF_TOKEN_MISSING' ||
        errorResponse?.response?.error === 'CSRF_TOKEN_INVALID' ||
        errorResponse?.error === 'CSRF_TOKEN_MISSING' ||
        errorResponse?.error === 'CSRF_TOKEN_INVALID';

      if (isCSRFError && !error.config._csrfRetry) {
        // Clear the invalid CSRF token
        clearCsrfToken();

        // Mark this request as a retry to prevent infinite loops
        error.config._csrfRetry = true;

        // Return a promise that handles the retry
        return getCsrfToken()
          .then(newToken => {
            error.config.headers['X-CSRF-Token'] = newToken;
            return api.request(error.config);
          })
          .catch(retryError => {
            console.error('Failed to retry request with new CSRF token:', retryError);
            return Promise.reject(error);
          });
      }
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
