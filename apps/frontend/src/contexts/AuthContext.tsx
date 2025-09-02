import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { authApi, setAuthToken, clearCsrfToken } from '@/lib/api';
import type { User, AuthTokens, SignUpRequest } from '@/types';

// Storage keys
const STORAGE_KEYS = {
  TOKENS: 'auth_tokens',
  USER: 'auth_user',
  ORGANIZATIONS: 'user_organizations',
  REMEMBER_ME: 'auth_remember_me',
} as const;

// Helper functions for storage management
const getStorageType = (rememberMe: boolean) => (rememberMe ? localStorage : sessionStorage);

const saveAuthData = (
  user: User,
  tokens: AuthTokens,
  organizations: unknown[],
  rememberMe: boolean = false
) => {
  const storage = getStorageType(rememberMe);

  // Save auth data to appropriate storage
  storage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
  storage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  storage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify(organizations));

  // Always save remember me preference to localStorage for restoration
  localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, JSON.stringify(rememberMe));
};

const clearAuthData = () => {
  // Clear from both storages to ensure complete cleanup
  [localStorage, sessionStorage].forEach(storage => {
    storage.removeItem(STORAGE_KEYS.TOKENS);
    storage.removeItem(STORAGE_KEYS.USER);
    storage.removeItem(STORAGE_KEYS.ORGANIZATIONS);
  });
  localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
};

const restoreAuthData = () => {
  // Check remember me preference first
  const rememberMeStr = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME);
  const rememberMe = rememberMeStr ? JSON.parse(rememberMeStr) : false;

  // Try to restore from appropriate storage
  const storage = getStorageType(rememberMe);
  const tokensStr = storage.getItem(STORAGE_KEYS.TOKENS);
  const userStr = storage.getItem(STORAGE_KEYS.USER);

  if (tokensStr && userStr) {
    try {
      return {
        tokens: JSON.parse(tokensStr) as AuthTokens,
        user: JSON.parse(userStr) as User,
        rememberMe,
      };
    } catch {
      return null;
    }
  }

  return null;
};

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; tokens: AuthTokens } }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
  | { type: 'RESTORE_SESSION'; payload: { user: User; tokens: AuthTokens } };

interface AuthContextType extends AuthState {
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signup: (data: SignUpRequest) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initialState: AuthState = {
  user: null,
  tokens: null,
  isLoading: true,
  isAuthenticated: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'LOGIN_SUCCESS':
    case 'RESTORE_SESSION':
      return {
        ...state,
        user: action.payload.user,
        tokens: action.payload.tokens,
        isLoading: false,
        isAuthenticated: true,
      };

    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };

    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };

    default:
      return state;
  }
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Restore session from storage on app start
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const authData = restoreAuthData();

        if (authData) {
          const { tokens, user } = authData;

          // Check if token is still valid (not expired)
          const isTokenValid = new Date(tokens.expiresAt) > new Date();

          if (isTokenValid && isMounted) {
            // Set the token in API client
            setAuthToken(tokens.accessToken);
            dispatch({ type: 'RESTORE_SESSION', payload: { user, tokens } });
            return;
          } else {
            // Clear expired tokens
            clearAuthData();
          }
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        // Clear corrupted data
        clearAuthData();
      }

      if (isMounted) {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean = false) => {
      dispatch({ type: 'SET_LOADING', payload: true });

      try {
        // Only send email and password to the backend; rememberMe is client-side only
        const response = await authApi.login({ email, password });

        // Convert backend response to our frontend format
        // Find primary organization or use the first one
        const primaryOrg =
          response.organizations.find(org => org.isPrimary) || response.organizations[0];

        // Get the complete user data with actual timestamps from the database
        let completeUserData;
        try {
          completeUserData = await authApi.getCurrentUser();
        } catch (error) {
          console.warn('Failed to fetch complete user data, using fallback timestamps:', error);
          // Fallback to current timestamps if getCurrentUser fails
          completeUserData = {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }

        const user: User = {
          id: response.user.id,
          email: response.user.email,
          name: response.user.name,
          role: (response.user.role as 'owner' | 'admin' | 'member') ?? 'member',
          orgId: primaryOrg?.id,
          createdAt: completeUserData.createdAt,
          updatedAt: completeUserData.updatedAt,
        };

        // Adjust token expiration based on rememberMe
        const expirationTime = rememberMe
          ? 30 * 24 * 60 * 60 * 1000 // 30 days for remember me
          : response.expiresIn * 1000; // Default expiration from backend

        const tokens: AuthTokens = {
          accessToken: response.accessToken,
          refreshToken: '', // Backend uses HTTP-only cookies for refresh tokens
          expiresAt: new Date(Date.now() + expirationTime).toISOString(),
        };

        // Set token in API client
        setAuthToken(response.accessToken);

        // Save auth data using helper function
        saveAuthData(user, tokens, response.organizations, rememberMe);

        dispatch({ type: 'LOGIN_SUCCESS', payload: { user, tokens } });
      } catch (error) {
        dispatch({ type: 'SET_LOADING', payload: false });
        throw error;
      }
    },
    []
  );

  const signup = useCallback(
    async (data: SignUpRequest) => {
      dispatch({ type: 'SET_LOADING', payload: true });

      try {
        await authApi.signup({
          name: data.name,
          email: data.email,
          password: data.password,
        });

        // After successful signup, automatically log the user in
        await login(data.email, data.password);
      } catch (error) {
        dispatch({ type: 'SET_LOADING', payload: false });
        throw error;
      }
    },
    [login]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Continue with local logout even if API call fails (e.g., missing refresh token)
      console.debug(
        'Server logout failed, continuing with local logout. This is expected if refresh token cookie is missing.'
      );
      // Don't show error to user since local logout will still work
    }

    // Clear API token and CSRF token
    setAuthToken(null);
    clearCsrfToken();

    // Clear all auth data using helper function
    clearAuthData();

    dispatch({ type: 'LOGOUT' });
  }, []);

  const updateUser = useCallback(
    (updates: Partial<User>) => {
      dispatch({ type: 'UPDATE_USER', payload: updates });

      // Update storage (check where the current data is stored)
      if (state.user) {
        const updatedUser = { ...state.user, ...updates };
        const rememberMeStr = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME);
        const rememberMe = rememberMeStr ? JSON.parse(rememberMeStr) : false;
        const storage = getStorageType(rememberMe);

        storage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      }
    },
    [state.user]
  );

  const refreshUser = useCallback(async () => {
    if (!state.isAuthenticated || !state.user) return;

    try {
      // Get fresh user data from the backend
      const freshUserData = await authApi.getCurrentUser();

      // Update the user data while keeping other fields
      const updatedUser = {
        ...state.user,
        ...freshUserData,
      };

      dispatch({ type: 'UPDATE_USER', payload: updatedUser });

      // Update storage
      const rememberMeStr = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME);
      const rememberMe = rememberMeStr ? JSON.parse(rememberMeStr) : false;
      const storage = getStorageType(rememberMe);
      storage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      // Don't throw error to avoid breaking UI
    }
  }, [state.isAuthenticated, state.user]);

  const value = useMemo(
    (): AuthContextType => ({
      ...state,
      login,
      signup,
      logout,
      updateUser,
      refreshUser,
    }),
    [state, login, signup, logout, updateUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
