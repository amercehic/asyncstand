/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { authApi } from '@/lib/api';

// Mock the auth API
vi.mock('@/lib/api', () => ({
  authApi: {
    forgotPassword: vi.fn(),
  },
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
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

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders forgot password form', () => {
    renderWithRouter(<ForgotPasswordPage />);

    expect(screen.getByText('Forgot Password?')).toBeInTheDocument();
    expect(
      screen.getByText("No worries! Enter your email and we'll send you reset instructions.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Reset Instructions' })).toBeInTheDocument();
  });

  it('shows validation error for empty email', async () => {
    renderWithRouter(<ForgotPasswordPage />);

    const submitButton = screen.getByRole('button', { name: 'Send Reset Instructions' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter your email address')).toBeInTheDocument();
    });
  });

  it('submits form with valid email', async () => {
    const mockForgotPassword = vi.mocked(authApi.forgotPassword);
    mockForgotPassword.mockResolvedValue({ message: 'Email sent', success: true });

    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText('Email Address');
    const submitButton = screen.getByRole('button', { name: 'Send Reset Instructions' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    expect(submitButton).toHaveTextContent('Sending...');

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith('test@example.com');
    });
  });

  it('shows success state after successful submission', async () => {
    const mockForgotPassword = vi.mocked(authApi.forgotPassword);
    mockForgotPassword.mockResolvedValue({ message: 'Email sent', success: true });

    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText('Email Address');
    const submitButton = screen.getByRole('button', { name: 'Send Reset Instructions' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Check Your Email')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('Try Another Email')).toBeInTheDocument();
      expect(screen.getByText('Back to Login')).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    const mockForgotPassword = vi.mocked(authApi.forgotPassword);
    mockForgotPassword.mockRejectedValue({
      response: { data: { message: 'User not found' } },
    });

    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText('Email Address');
    const submitButton = screen.getByRole('button', { name: 'Send Reset Instructions' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument();
    });
  });

  it('clears error when user starts typing', async () => {
    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText('Email Address');
    const submitButton = screen.getByRole('button', { name: 'Send Reset Instructions' });

    // Trigger validation error
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter your email address')).toBeInTheDocument();
    });

    // Start typing to clear error
    fireEvent.change(emailInput, { target: { value: 'test' } });

    expect(screen.queryByText('Please enter your email address')).not.toBeInTheDocument();
  });

  it('allows trying another email from success state', async () => {
    const mockForgotPassword = vi.mocked(authApi.forgotPassword);
    mockForgotPassword.mockResolvedValue({ message: 'Email sent', success: true });

    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText('Email Address');
    const submitButton = screen.getByRole('button', { name: 'Send Reset Instructions' });

    // Submit first email
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Check Your Email')).toBeInTheDocument();
    });

    // Click "Try Another Email"
    const tryAnotherButton = screen.getByText('Try Another Email');
    fireEvent.click(tryAnotherButton);

    // Should be back to form state
    expect(screen.getByText('Forgot Password?')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toHaveValue('');
  });

  it('has accessible form labels and structure', () => {
    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText('Email Address');
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('placeholder', 'you@example.com');
    expect(emailInput).toHaveAttribute('autoComplete', 'email');

    const submitButton = screen.getByRole('button', { name: 'Send Reset Instructions' });
    expect(submitButton).toHaveAttribute('type', 'submit');
  });
});
