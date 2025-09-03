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
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

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

// Helper function to decode JWT for debugging
function decodeJWT(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    return null;
  }
}

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Debug: Log what's in the token
    const decoded = decodeJWT(token);
    console.log('[Frontend] Setting auth token with payload:', {
      sub: decoded?.sub,
      orgId: decoded?.orgId,
      orgIdType: typeof decoded?.orgId,
      role: decoded?.role,
      exp: decoded?.exp,
      expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
    });
  } else {
    delete api.defaults.headers.common['Authorization'];
    console.log('[Frontend] Clearing auth token');
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

    // Skip logging logout requests since errors are handled gracefully
    const isLogoutRequest = config.url?.includes('/auth/logout');
    if (env.enableDebug && !isLogoutRequest) {
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
  async error => {
    // Skip logging logout errors since they're handled gracefully
    const isLogoutError = error.config?.url?.includes('/auth/logout');
    if (env.enableDebug && !isLogoutError) {
      console.error('API Response Error:', error);
    }

    // Handle 401 Unauthorized - attempt token refresh first
    if (
      error.response?.status === 401 &&
      authToken &&
      !error.config?.url?.includes('/auth/refresh')
    ) {
      // Check if user has "Remember Me" enabled
      const rememberMeStr = localStorage.getItem('auth_remember_me');
      const rememberMe = rememberMeStr ? JSON.parse(rememberMeStr) : false;

      console.log('[Frontend Interceptor] 401 error detected:', {
        rememberMe,
        url: error.config?.url,
        hasAuthToken: !!authToken,
        authTokenLength: authToken?.length,
      });

      if (rememberMe) {
        console.log('Attempting token refresh...');
        // Attempt to refresh the token
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = attemptTokenRefresh();
        }

        try {
          const newToken = await refreshPromise;
          if (newToken) {
            console.log('Token refresh successful, retrying original request');
            // Retry the original request with the new token
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return api(error.config);
          } else {
            console.log('Token refresh failed - no new token received');
          }
        } catch (refreshError) {
          console.error('[Frontend] Token refresh failed:', refreshError);
          console.error('[Frontend] Refresh error details:', {
            status: refreshError?.response?.status,
            statusText: refreshError?.response?.statusText,
            data: refreshError?.response?.data,
            message: refreshError?.message,
          });
        } finally {
          isRefreshing = false;
          refreshPromise = null;
        }
      } else {
        console.log('Remember me not enabled, proceeding with logout');
      }

      // Token refresh failed or not enabled - clear auth and redirect
      handleAuthFailure();
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
      // Organization endpoints - handled by SettingsPage and other components
      error.config?.url?.includes('/org/'),
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

// Helper function to attempt token refresh
async function attemptTokenRefresh(): Promise<string | null> {
  console.log('[Frontend] attemptTokenRefresh called');
  try {
    // Use the same base URL as the API client
    const baseURL = api.defaults.baseURL || '';
    const url = `${baseURL}/auth/refresh`;
    console.log('[Frontend] Attempting refresh at URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('[Frontend] Refresh response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      const newToken = data.accessToken;

      console.log('[Frontend] Refresh successful, new token received');

      // Update the stored token
      setAuthToken(newToken);

      // Update stored auth data with new token and expiration
      const rememberMeStr = localStorage.getItem('auth_remember_me');
      const rememberMe = rememberMeStr ? JSON.parse(rememberMeStr) : false;
      const storage = rememberMe ? localStorage : sessionStorage;

      const storedTokens = storage.getItem('auth_tokens');
      if (storedTokens) {
        const tokens = JSON.parse(storedTokens);
        tokens.accessToken = newToken;
        tokens.expiresAt = new Date(Date.now() + data.expiresIn * 1000).toISOString();
        storage.setItem('auth_tokens', JSON.stringify(tokens));
        console.log('Updated stored tokens with new expiration');
      }

      return newToken;
    } else {
      console.log('Refresh failed with status:', response.status);
      const errorText = await response.text();
      console.log('Refresh error response:', errorText);
    }
  } catch (error) {
    console.error('Token refresh request failed:', error);
  }

  return null;
}

// Helper function to handle authentication failures
function handleAuthFailure() {
  console.log('[Frontend] handleAuthFailure called - clearing auth and redirecting to login');
  // Clear invalid token and auth data
  setAuthToken(null);
  clearCsrfToken();
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
}
