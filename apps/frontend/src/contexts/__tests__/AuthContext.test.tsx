import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { server } from '@/test/mocks/server';

// Enable API mocking
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Test component that uses the auth context
const TestComponent = () => {
  const { user, login, logout, isLoading } = useAuth();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="user">{user ? user.email : 'no-user'}</div>
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={() => login('test@example.com', 'password', true)}>
        Login with Remember Me
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

const renderWithProvider = (component: React.ReactNode) => {
  return render(<AuthProvider>{component}</AuthProvider>);
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('provides initial auth state', () => {
    renderWithProvider(<TestComponent />);

    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
  });

  it('handles successful login', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    await user.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
  });

  it('handles logout', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // First login
    await user.click(screen.getByText('Login'));
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    // Then logout
    await user.click(screen.getByText('Logout'));

    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });

  it('shows loading state during login', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    await user.click(screen.getByText('Login'));

    // Should briefly show loading
    expect(screen.getByTestId('loading')).toHaveTextContent('loading');

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });
  });

  it('persists user data in sessionStorage by default', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    await user.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    // Wait a bit more for sessionStorage to be updated
    await waitFor(() => {
      const storedUser = sessionStorage.getItem('auth_user');
      expect(storedUser).toBeTruthy();
    });

    const storedUser = sessionStorage.getItem('auth_user');
    expect(JSON.parse(storedUser!)).toMatchObject({
      email: 'test@example.com',
    });
  });

  it('restores user from localStorage on mount', async () => {
    // Pre-populate localStorage (remember me = true scenario)
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 1); // 1 hour from now

    localStorage.setItem('auth_remember_me', 'true');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: '1',
        email: 'stored@example.com',
        name: 'Stored User',
      })
    );
    localStorage.setItem(
      'auth_tokens',
      JSON.stringify({
        accessToken: 'stored-token',
        refreshToken: 'refresh-token',
        expiresAt: futureDate.toISOString(),
      })
    );

    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('stored@example.com');
    });
  });

  it('stores auth data in localStorage when rememberMe is true', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    await user.click(screen.getByText('Login with Remember Me'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    // Check that remember me preference is stored
    expect(localStorage.getItem('auth_remember_me')).toBe('true');

    // Check that user data is in localStorage
    expect(localStorage.getItem('auth_user')).toBeTruthy();
    expect(localStorage.getItem('auth_tokens')).toBeTruthy();

    // Check that sessionStorage is empty
    expect(sessionStorage.getItem('auth_user')).toBeNull();
    expect(sessionStorage.getItem('auth_tokens')).toBeNull();
  });

  it('stores auth data in sessionStorage when rememberMe is false', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    await user.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    // Check that remember me preference is stored as false
    expect(localStorage.getItem('auth_remember_me')).toBe('false');

    // Check that user data is in sessionStorage
    expect(sessionStorage.getItem('auth_user')).toBeTruthy();
    expect(sessionStorage.getItem('auth_tokens')).toBeTruthy();

    // Check that localStorage doesn't have auth data (only remember me preference)
    expect(localStorage.getItem('auth_user')).toBeNull();
    expect(localStorage.getItem('auth_tokens')).toBeNull();
  });

  it('restores session from sessionStorage when rememberMe was false', async () => {
    // Pre-populate sessionStorage (remember me = false scenario)
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 1);

    localStorage.setItem('auth_remember_me', 'false');
    sessionStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: '1',
        email: 'session@example.com',
        name: 'Session User',
      })
    );
    sessionStorage.setItem(
      'auth_tokens',
      JSON.stringify({
        accessToken: 'session-token',
        refreshToken: 'refresh-token',
        expiresAt: futureDate.toISOString(),
      })
    );

    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('session@example.com');
    });
  });

  it('clears data from both storage types on logout', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Login with remember me
    await user.click(screen.getByText('Login with Remember Me'));
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    // Verify data is stored
    expect(localStorage.getItem('auth_user')).toBeTruthy();

    // Logout
    await user.click(screen.getByText('Logout'));

    // Verify all auth data is cleared from both storage types
    expect(localStorage.getItem('auth_user')).toBeNull();
    expect(localStorage.getItem('auth_tokens')).toBeNull();
    expect(localStorage.getItem('auth_remember_me')).toBeNull();
    expect(sessionStorage.getItem('auth_user')).toBeNull();
    expect(sessionStorage.getItem('auth_tokens')).toBeNull();
  });
});
