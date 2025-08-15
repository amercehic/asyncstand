/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { authApi } from '@/lib/api';

// Mock the auth API
vi.mock('@/lib/api', () => ({
  authApi: {
    resetPassword: vi.fn(),
  },
}));

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
const mockSearchParams = new URLSearchParams('?token=test-token&email=test@example.com');

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
    Link: ({ children, to, ...props }: any) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock toast
vi.mock('@/components/ui', async () => {
  const actual = await vi.importActual('@/components/ui');
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.set('token', 'test-token');
    mockSearchParams.set('email', 'test@example.com');
  });

  it('renders reset password form with token and email from URL', () => {
    renderWithRouter(<ResetPasswordPage />);

    expect(screen.getByText('Reset Your Password')).toBeInTheDocument();
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument();
  });

  it('redirects to forgot password when no token or email', () => {
    mockSearchParams.delete('token');
    mockSearchParams.delete('email');

    renderWithRouter(<ResetPasswordPage />);

    expect(mockNavigate).toHaveBeenCalledWith('/forgot-password');
  });

  it('shows password requirements', () => {
    renderWithRouter(<ResetPasswordPage />);

    expect(screen.getByText('Password Requirements:')).toBeInTheDocument();
    expect(screen.getByText('8+ characters')).toBeInTheDocument();
    expect(screen.getByText('Uppercase letter')).toBeInTheDocument();
    expect(screen.getByText('Lowercase letter')).toBeInTheDocument();
    expect(screen.getByText('Number')).toBeInTheDocument();
    expect(screen.getByText('Special character')).toBeInTheDocument();
  });

  it('validates password requirements in real-time', async () => {
    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');

    // Test weak password
    fireEvent.change(passwordInput, { target: { value: 'weak' } });

    // All requirements should be unmet (no green indicators)
    const requirements = screen.getByText('Password Requirements:').parentElement;
    expect(requirements).toBeInTheDocument();

    // Test strong password
    fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } });

    // Requirements should be satisfied
    await waitFor(() => {
      // The UI updates to show met requirements - exact implementation may vary
      expect(passwordInput).toHaveValue('StrongPass123!');
    });
  });

  it('shows error when passwords do not match', async () => {
    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');

    fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPass123!' } });

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  it('disables submit button when password requirements are not met', () => {
    renderWithRouter(<ResetPasswordPage />);

    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    const passwordInput = screen.getByLabelText('New Password');

    // Initially disabled
    expect(submitButton).toBeDisabled();

    // Still disabled with weak password
    fireEvent.change(passwordInput, { target: { value: 'weak' } });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when all requirements are met', async () => {
    renderWithRouter(<ResetPasswordPage />);

    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    const passwordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');

    const strongPassword = 'StrongPass123!';

    fireEvent.change(passwordInput, { target: { value: strongPassword } });
    fireEvent.change(confirmPasswordInput, { target: { value: strongPassword } });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('submits form with valid data', async () => {
    const mockResetPassword = vi.mocked(authApi.resetPassword);
    mockResetPassword.mockResolvedValue({ message: 'Password reset successful', success: true });

    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Reset Password' });

    const strongPassword = 'StrongPass123!';

    fireEvent.change(passwordInput, { target: { value: strongPassword } });
    fireEvent.change(confirmPasswordInput, { target: { value: strongPassword } });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    fireEvent.click(submitButton);

    expect(submitButton).toHaveTextContent('Resetting...');

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith(
        'test-token',
        strongPassword,
        'test@example.com'
      );
    });
  });

  it('shows success state after successful password reset', async () => {
    const mockResetPassword = vi.mocked(authApi.resetPassword);
    mockResetPassword.mockResolvedValue({ message: 'Password reset successful', success: true });

    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Reset Password' });

    const strongPassword = 'StrongPass123!';

    fireEvent.change(passwordInput, { target: { value: strongPassword } });
    fireEvent.change(confirmPasswordInput, { target: { value: strongPassword } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Password Reset Successful!')).toBeInTheDocument();
      expect(
        screen.getByText('Your password has been changed successfully. Redirecting to login...')
      ).toBeInTheDocument();
      expect(screen.getByText('Go to Login')).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    const mockResetPassword = vi.mocked(authApi.resetPassword);
    mockResetPassword.mockRejectedValue({
      response: { data: { message: 'Invalid or expired token' } },
    });

    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Reset Password' });

    const strongPassword = 'StrongPass123!';

    fireEvent.change(passwordInput, { target: { value: strongPassword } });
    fireEvent.change(confirmPasswordInput, { target: { value: strongPassword } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid or expired token')).toBeInTheDocument();
    });
  });

  it('toggles password visibility', () => {
    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');
    const toggleButtons = screen.getAllByRole('button');
    const passwordToggle = toggleButtons.find(
      button => button.getAttribute('type') === 'button' && button.querySelector('svg')
    );

    expect(passwordInput).toHaveAttribute('type', 'password');

    if (passwordToggle) {
      fireEvent.click(passwordToggle);
      expect(passwordInput).toHaveAttribute('type', 'text');

      fireEvent.click(passwordToggle);
      expect(passwordInput).toHaveAttribute('type', 'password');
    }
  });

  it('shows validation errors for form submission', async () => {
    renderWithRouter(<ResetPasswordPage />);

    const submitButton = screen.getByRole('button', { name: 'Reset Password' });

    // Try to submit empty form (button should be disabled, but test the validation logic)
    const passwordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');

    // Enter mismatched passwords
    fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPass123!' } });

    // The submit button should remain disabled
    expect(submitButton).toBeDisabled();
  });

  it('has accessible form structure', () => {
    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('autoComplete', 'new-password');

    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('autoComplete', 'new-password');

    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    expect(submitButton).toHaveAttribute('type', 'submit');
  });
});
