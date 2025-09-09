import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FeatureProtectedRoute } from '@/components/FeatureProtectedRoute';
import type { User } from '@/types/api';

// Mock the hooks and dependencies
vi.mock('@/contexts', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: vi.fn(),
}));

vi.mock('@/pages/NotFoundPage', () => ({
  NotFoundPage: () => <div>Not Found Page</div>,
}));

const mockLocation = { pathname: '/test-path' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to, replace }: { to: string; replace?: boolean }) => (
      <div data-testid="navigate" data-to={to} data-replace={replace?.toString() || 'false'}>
        Navigate to {to}
      </div>
    ),
    useLocation: () => mockLocation,
  };
});

const { useAuth } = await import('@/contexts');
const { useFeatureFlag } = await import('@/hooks/useFeatureFlag');
const mockUseAuth = vi.mocked(useAuth);
const mockUseFeatureFlag = vi.mocked(useFeatureFlag);

// Helper functions for creating mock objects
const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'member',
  orgId: 'org-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const createMockAuthContext = (overrides: Record<string, unknown> = {}) =>
  ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    tokens: null,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
    refreshUser: vi.fn(),
    ...overrides,
  }) as unknown as ReturnType<typeof useAuth>;

const createMockFeatureFlag = (overrides: Record<string, unknown> = {}) => ({
  isEnabled: false,
  loading: false,
  error: null,
  refetch: vi.fn(),
  ...overrides,
});

describe('FeatureProtectedRoute', () => {
  const defaultProps = {
    featureKey: 'test-feature',
    children: <div>Protected Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state when auth is loading', () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: false,
        isLoading: true,
        user: null,
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: false,
        loading: false,
      })
    );

    render(
      <MemoryRouter>
        <FeatureProtectedRoute {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    // Check for loading spinner by class
    const spinner = screen.getByText('Loading...').parentElement?.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should show loading state when feature is loading', () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: createMockUser({ id: '1', orgId: 'org-1' }),
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: false,
        loading: true,
      })
    );

    render(
      <MemoryRouter>
        <FeatureProtectedRoute {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should redirect to login when not authenticated', () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: true,
        loading: false,
      })
    );

    render(
      <MemoryRouter>
        <FeatureProtectedRoute {...defaultProps} />
      </MemoryRouter>
    );

    const navigate = screen.getByTestId('navigate');
    expect(navigate).toHaveAttribute('data-to', '/login');
    expect(navigate).toHaveAttribute('data-replace', 'true');
  });

  it('should redirect super admin to admin page', () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: createMockUser({ id: '1', isSuperAdmin: true }),
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: true,
        loading: false,
      })
    );

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <FeatureProtectedRoute {...defaultProps} />
      </MemoryRouter>
    );

    const navigate = screen.getByTestId('navigate');
    expect(navigate).toHaveAttribute('data-to', '/admin');
    expect(navigate).toHaveAttribute('data-replace', 'true');
  });

  it('should allow super admin access to admin routes', () => {
    // Change the mock location to admin path
    mockLocation.pathname = '/admin/features';

    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: createMockUser({ id: '1', isSuperAdmin: true }),
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: true,
        loading: false,
      })
    );

    render(
      <MemoryRouter initialEntries={['/admin/features']}>
        <FeatureProtectedRoute {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();

    // Reset location for other tests
    mockLocation.pathname = '/test-path';
  });

  it('should render children when feature is enabled', () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: createMockUser({ id: '1', orgId: 'org-1' }),
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: true,
        loading: false,
      })
    );

    render(
      <MemoryRouter>
        <FeatureProtectedRoute {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should show 404 page when feature is disabled and return404 is true', () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: createMockUser({ id: '1', orgId: 'org-1' }),
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: false,
        loading: false,
      })
    );

    render(
      <MemoryRouter>
        <FeatureProtectedRoute {...defaultProps} return404={true} />
      </MemoryRouter>
    );

    expect(screen.getByText('Not Found Page')).toBeInTheDocument();
  });

  it('should redirect to custom path when feature is disabled and return404 is false', () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: createMockUser({ id: '1', orgId: 'org-1' }),
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: false,
        loading: false,
      })
    );

    render(
      <MemoryRouter>
        <FeatureProtectedRoute {...defaultProps} return404={false} redirectTo="/custom-redirect" />
      </MemoryRouter>
    );

    const navigate = screen.getByTestId('navigate');
    expect(navigate).toHaveAttribute('data-to', '/custom-redirect');
  });

  it('should use default redirect when feature is disabled and no custom redirect', () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: createMockUser({ id: '1', orgId: 'org-1' }),
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: false,
        loading: false,
      })
    );

    render(
      <MemoryRouter>
        <FeatureProtectedRoute {...defaultProps} return404={false} />
      </MemoryRouter>
    );

    const navigate = screen.getByTestId('navigate');
    expect(navigate).toHaveAttribute('data-to', '/dashboard');
  });

  it('should show fallback when feature is disabled and fallback is provided', () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: createMockUser({ id: '1', orgId: 'org-1' }),
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: false,
        loading: false,
      })
    );

    const fallback = <div>Feature Coming Soon</div>;

    render(
      <MemoryRouter>
        <FeatureProtectedRoute {...defaultProps} fallback={fallback} return404={false} />
      </MemoryRouter>
    );

    expect(screen.getByText('Feature Coming Soon')).toBeInTheDocument();
  });

  it('should show 404 page when fallback is provided but return404 is true', () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: createMockUser({ id: '1', orgId: 'org-1' }),
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: false,
        loading: false,
      })
    );

    const fallback = <div>Custom Fallback</div>;

    render(
      <MemoryRouter>
        <FeatureProtectedRoute {...defaultProps} fallback={fallback} return404={true} />
      </MemoryRouter>
    );

    // When return404=true, it takes precedence over fallback
    expect(screen.getByText('Not Found Page')).toBeInTheDocument();
    expect(screen.queryByText('Custom Fallback')).not.toBeInTheDocument();
  });

  it('should call useFeatureFlag with correct feature key', () => {
    const featureKey = 'advanced-analytics';
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: createMockUser({ id: '1', orgId: 'org-1' }),
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: true,
        loading: false,
      })
    );

    render(
      <MemoryRouter>
        <FeatureProtectedRoute {...defaultProps} featureKey={featureKey} />
      </MemoryRouter>
    );

    expect(mockUseFeatureFlag).toHaveBeenCalledWith(featureKey);
  });

  it('should handle multiple children correctly', () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: createMockUser({ id: '1', orgId: 'org-1' }),
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: true,
        loading: false,
      })
    );

    render(
      <MemoryRouter>
        <FeatureProtectedRoute featureKey="test-feature">
          <div>First Child</div>
          <div>Second Child</div>
        </FeatureProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('First Child')).toBeInTheDocument();
    expect(screen.getByText('Second Child')).toBeInTheDocument();
  });

  it('should render loading state with proper accessibility', () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: false,
        isLoading: true,
        user: null,
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: false,
        loading: false,
      })
    );

    render(
      <MemoryRouter>
        <FeatureProtectedRoute {...defaultProps} />
      </MemoryRouter>
    );

    const loadingContainer = screen.getByText('Loading...').parentElement?.parentElement;
    expect(loadingContainer).toHaveClass(
      'min-h-screen',
      'bg-background',
      'flex',
      'items-center',
      'justify-center'
    );
  });

  it('should handle edge case when user exists but has no orgId', () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: createMockUser({ id: '1', orgId: undefined }),
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: true,
        loading: false,
      })
    );

    render(
      <MemoryRouter>
        <FeatureProtectedRoute {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should handle complex authentication scenarios', () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: createMockUser({
          id: '1',
          orgId: 'org-1',
          role: 'admin',
          email: 'test@example.com',
        }),
      })
    );
    mockUseFeatureFlag.mockReturnValue(
      createMockFeatureFlag({
        isEnabled: true,
        loading: false,
      })
    );

    render(
      <MemoryRouter>
        <FeatureProtectedRoute {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
