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

  it('persists user data in localStorage', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    await user.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    // Wait a bit more for localStorage to be updated
    await waitFor(() => {
      const storedUser = localStorage.getItem('auth-user');
      expect(storedUser).toBeTruthy();
    });

    const storedUser = localStorage.getItem('auth-user');
    expect(JSON.parse(storedUser!)).toMatchObject({
      email: 'test@example.com',
    });
  });

  it('restores user from localStorage on mount', async () => {
    // Pre-populate localStorage
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 1); // 1 hour from now

    localStorage.setItem(
      'auth-user',
      JSON.stringify({
        id: '1',
        email: 'stored@example.com',
        name: 'Stored User',
      })
    );
    localStorage.setItem(
      'auth-tokens',
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
});
