import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { authApi, setAuthToken } from '@/lib/api';
import type { User, AuthTokens, SignUpRequest } from '@/types';

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
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignUpRequest) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
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

  // Restore session from localStorage on app start
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const savedTokens = localStorage.getItem('auth_tokens');
        const savedUser = localStorage.getItem('auth_user');

        if (savedTokens && savedUser) {
          const tokens: AuthTokens = JSON.parse(savedTokens);
          const user: User = JSON.parse(savedUser);

          // Check if token is still valid (not expired)
          const isTokenValid = new Date(tokens.expiresAt) > new Date();

          if (isTokenValid && isMounted) {
            // Set the token in API client
            setAuthToken(tokens.accessToken);
            dispatch({ type: 'RESTORE_SESSION', payload: { user, tokens } });
            return;
          } else {
            // Clear expired tokens
            localStorage.removeItem('auth_tokens');
            localStorage.removeItem('auth_user');
          }
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        // Clear corrupted data
        localStorage.removeItem('auth_tokens');
        localStorage.removeItem('auth_user');
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

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response = await authApi.login({ email, password });

      // Convert backend response to our frontend format
      const user: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role as 'user' | 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const tokens: AuthTokens = {
        accessToken: response.accessToken,
        refreshToken: '', // Backend uses HTTP-only cookies for refresh tokens
        expiresAt: new Date(Date.now() + response.expiresIn * 1000).toISOString(),
      };

      // Set token in API client
      setAuthToken(response.accessToken);

      // Save to localStorage
      localStorage.setItem('auth_tokens', JSON.stringify(tokens));
      localStorage.setItem('auth_user', JSON.stringify(user));

      // Store organizations info for future use
      localStorage.setItem('user_organizations', JSON.stringify(response.organizations));

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, tokens } });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  }, []);

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
    } catch (error) {
      // Continue with local logout even if API call fails
      console.warn('Logout API call failed:', error);
    }

    // Clear API token
    setAuthToken(null);

    // Clear localStorage
    localStorage.removeItem('auth_tokens');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('user_organizations');

    dispatch({ type: 'LOGOUT' });
  }, []);

  const updateUser = useCallback(
    (updates: Partial<User>) => {
      dispatch({ type: 'UPDATE_USER', payload: updates });

      // Update localStorage
      if (state.user) {
        const updatedUser = { ...state.user, ...updates };
        localStorage.setItem('auth_user', JSON.stringify(updatedUser));
      }
    },
    [state.user]
  );

  const value = useMemo(
    (): AuthContextType => ({
      ...state,
      login,
      signup,
      logout,
      updateUser,
    }),
    [state, login, signup, logout, updateUser]
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
