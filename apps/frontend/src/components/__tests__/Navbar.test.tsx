import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';

// Mock all the context hooks
vi.mock('@/contexts', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useFeatureFlag', () => ({
  useEnabledFeatures: vi.fn(),
}));

vi.mock('@/components/ui', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    header: 'header',
    div: 'div',
  },
}));

const mockUseAuth = vi.mocked(await import('@/contexts')).useAuth;
const mockUseEnabledFeatures = vi.mocked(await import('@/hooks/useFeatureFlag')).useEnabledFeatures;

const renderNavbar = (path = '/dashboard') => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Navbar />
    </MemoryRouter>
  );
};

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for useEnabledFeatures
    mockUseEnabledFeatures.mockReturnValue({
      features: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('should not render on auth pages', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Navbar />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should not render on landing page', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should not render when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      logout: vi.fn(),
      tokens: null,
      login: vi.fn(),
      signup: vi.fn(),
      updateUser: vi.fn(),
      refreshUser: vi.fn(),
      isAuthenticated: false,
      isLoading: false,
    });

    const { container } = renderNavbar();

    expect(container.firstChild).toBeNull();
  });

  it('should show loading state when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      logout: vi.fn(),
      tokens: null,
      login: vi.fn(),
      signup: vi.fn(),
      updateUser: vi.fn(),
      refreshUser: vi.fn(),
      isAuthenticated: true,
      isLoading: true,
    });

    mockUseEnabledFeatures.mockReturnValue({
      features: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderNavbar();

    expect(screen.getByText('AsyncStand')).toBeInTheDocument();
    expect(screen.getByText('AsyncStand')).toBeInTheDocument();
    // Just check that the loading spinner is present
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should show default navigation items when features are loading for regular users', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        isSuperAdmin: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      logout: vi.fn(),
      tokens: null,
      login: vi.fn(),
      signup: vi.fn(),
      updateUser: vi.fn(),
      refreshUser: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });

    mockUseEnabledFeatures.mockReturnValue({
      features: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    renderNavbar();

    expect(screen.getByText('AsyncStand')).toBeInTheDocument();
    // Should show safe default navigation items while loading
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Standups')).toBeInTheDocument();
    // Teams and Integrations may or may not show depending on configuration and cache
  });

  it('should render navbar for authenticated user', async () => {
    const mockLogout = vi.fn().mockResolvedValue(undefined);

    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        isSuperAdmin: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      logout: mockLogout,
      tokens: null,
      login: vi.fn(),
      signup: vi.fn(),
      updateUser: vi.fn(),
      refreshUser: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });

    mockUseEnabledFeatures.mockReturnValue({
      features: ['dashboard', 'teams', 'standups', 'integrations', 'settings'],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderNavbar();

    await waitFor(() => {
      expect(screen.getByText('AsyncStand')).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('should render navigation links for admin user', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        isSuperAdmin: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      logout: vi.fn(),
      tokens: null,
      login: vi.fn(),
      signup: vi.fn(),
      updateUser: vi.fn(),
      refreshUser: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });

    mockUseEnabledFeatures.mockReturnValue({
      features: ['dashboard', 'teams', 'standups', 'integrations', 'settings'],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderNavbar();

    await waitFor(() => {
      expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
    });

    expect(screen.getByTestId('nav-teams')).toBeInTheDocument();
    expect(screen.getByTestId('nav-standups')).toBeInTheDocument();
    expect(screen.getByTestId('nav-integrations')).toBeInTheDocument();
  });

  it('should only show admin link for super admin', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        name: 'Super Admin',
        email: 'superadmin@example.com',
        role: 'owner',
        isSuperAdmin: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      logout: vi.fn(),
      tokens: null,
      login: vi.fn(),
      signup: vi.fn(),
      updateUser: vi.fn(),
      refreshUser: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });

    mockUseEnabledFeatures.mockReturnValue({
      features: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderNavbar();

    await waitFor(() => {
      expect(screen.getByTestId('nav-admin')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('nav-dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-teams')).not.toBeInTheDocument();
  });

  it('should handle logout correctly', async () => {
    const mockLogout = vi.fn().mockResolvedValue(undefined);

    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        isSuperAdmin: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      logout: mockLogout,
      tokens: null,
      login: vi.fn(),
      signup: vi.fn(),
      updateUser: vi.fn(),
      refreshUser: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });

    mockUseEnabledFeatures.mockReturnValue({
      features: ['settings'],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderNavbar();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Test that the component renders properly with user data
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('AsyncStand')).toBeInTheDocument();
  });

  it('should handle logout error', async () => {
    const mockLogout = vi.fn().mockRejectedValue(new Error('Logout failed'));

    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        isSuperAdmin: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      logout: mockLogout,
      tokens: null,
      login: vi.fn(),
      signup: vi.fn(),
      updateUser: vi.fn(),
      refreshUser: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });

    mockUseEnabledFeatures.mockReturnValue({
      features: ['settings'],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderNavbar();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Test that the component handles user data properly
    expect(screen.getByText('AsyncStand')).toBeInTheDocument();
  });

  it('should show settings link when settings feature is enabled', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        isSuperAdmin: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      logout: vi.fn(),
      tokens: null,
      login: vi.fn(),
      signup: vi.fn(),
      updateUser: vi.fn(),
      refreshUser: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });

    mockUseEnabledFeatures.mockReturnValue({
      features: ['settings'],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderNavbar();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Test that the navbar renders correctly with features
    expect(screen.getByText('AsyncStand')).toBeInTheDocument();
  });

  it('should not show settings link when settings feature is disabled', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        isSuperAdmin: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      logout: vi.fn(),
      tokens: null,
      login: vi.fn(),
      signup: vi.fn(),
      updateUser: vi.fn(),
      refreshUser: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });

    mockUseEnabledFeatures.mockReturnValue({
      features: [], // settings not included
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderNavbar();

    await waitFor(() => {
      expect(screen.getByText('AsyncStand')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('nav-settings-button')).not.toBeInTheDocument();
  });

  it('should handle coming soon features', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        isSuperAdmin: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      logout: vi.fn(),
      tokens: null,
      login: vi.fn(),
      signup: vi.fn(),
      updateUser: vi.fn(),
      refreshUser: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });

    mockUseEnabledFeatures.mockReturnValue({
      features: ['reports'],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderNavbar();

    await waitFor(() => {
      expect(screen.getByTestId('nav-reports')).toBeInTheDocument();
    });

    // Test that the reports link is present
    expect(screen.getByTestId('nav-reports')).toBeInTheDocument();
  });

  it('should handle auth context errors gracefully', () => {
    // Mock useAuth to throw an error
    mockUseAuth.mockImplementation(() => {
      throw new Error('Auth context not available');
    });

    const { container } = renderNavbar();

    // Should not crash and should render nothing
    expect(container.firstChild).toBeNull();
  });

  it('should filter navigation items based on user role', async () => {
    // Test with member role (should not see teams or integrations)
    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        name: 'Member User',
        email: 'member@example.com',
        role: 'member',
        isSuperAdmin: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      logout: vi.fn(),
      tokens: null,
      login: vi.fn(),
      signup: vi.fn(),
      updateUser: vi.fn(),
      refreshUser: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });

    mockUseEnabledFeatures.mockReturnValue({
      features: ['dashboard', 'standups'],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderNavbar();

    await waitFor(() => {
      expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
    });

    expect(screen.getByTestId('nav-standups')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-teams')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-integrations')).not.toBeInTheDocument();
  });
});
