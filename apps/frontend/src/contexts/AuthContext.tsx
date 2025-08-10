import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import type { User, AuthTokens } from '@/types';

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
  logout: () => void;
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
            dispatch({ type: 'RESTORE_SESSION', payload: { user, tokens } });
            return;
          }
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (email: string, password: string) => {
      dispatch({ type: 'SET_LOADING', payload: true });

      try {
        // TODO: Replace with actual API call - password will be used when implementing real auth
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock successful login
        const mockUser: User = {
          id: '1',
          email,
          name: email.split('@')[0],
          role: 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const mockTokens: AuthTokens = {
          accessToken: 'mock_access_token',
          refreshToken: 'mock_refresh_token',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        };

        // Save to localStorage
        localStorage.setItem('auth_tokens', JSON.stringify(mockTokens));
        localStorage.setItem('auth_user', JSON.stringify(mockUser));

        dispatch({ type: 'LOGIN_SUCCESS', payload: { user: mockUser, tokens: mockTokens } });
      } catch (error) {
        dispatch({ type: 'SET_LOADING', payload: false });
        throw error;
      }
    },
    []
  );

  const logout = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem('auth_tokens');
    localStorage.removeItem('auth_user');

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
      logout,
      updateUser,
    }),
    [state, login, logout, updateUser]
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
