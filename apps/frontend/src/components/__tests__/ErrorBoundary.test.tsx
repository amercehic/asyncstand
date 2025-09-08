import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Component that throws an error when shouldThrow is true
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  const originalConsoleError = console.error;
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock console.error to prevent error logs in tests
    console.error = vi.fn();

    // Mock window.location methods
    delete (window as { location?: Location }).location;
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        href: '',
        reload: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    console.error = originalConsoleError;
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Child component</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child component')).toBeInTheDocument();
  });

  it('should catch errors and display error UI', async () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    expect(screen.getByText(/We apologize for the inconvenience/)).toBeInTheDocument();
    expect(screen.getByTestId('try-again-button')).toBeInTheDocument();
    expect(screen.getByTestId('go-home-button')).toBeInTheDocument();
    expect(screen.getByTestId('reload-page-button')).toBeInTheDocument();
  });

  it('should show error details in development mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Error Details (Development)')).toBeInTheDocument();
    });

    expect(screen.getByText(/Test error message/)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should not show error details in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    expect(screen.queryByText('Error Details (Development)')).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should call onError callback when provided', async () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error message' }),
        expect.any(Object)
      );
    });
  });

  it('should reset error state when Try Again is clicked', async () => {
    const user = userEvent.setup();

    // Component that can control whether it throws
    let shouldThrow = true;
    const ControlledThrowError = () => {
      if (shouldThrow) {
        throw new Error('Test error message');
      }
      return <div>No error</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <ControlledThrowError />
      </ErrorBoundary>
    );

    // Wait for error to be caught
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    // Now set it to not throw
    shouldThrow = false;

    // Click Try Again to reset error boundary
    await user.click(screen.getByTestId('try-again-button'));

    // Force re-render after reset
    rerender(
      <ErrorBoundary>
        <ControlledThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should navigate home when Go Home is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('go-home-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('go-home-button'));

    expect(window.location.href).toBe('/');
  });

  it('should reload page when Reload Page is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('reload-page-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('reload-page-button'));

    expect(window.location.reload).toHaveBeenCalled();
  });

  it('should render custom fallback as ReactNode', async () => {
    const customFallback = <div>Custom error UI</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    });

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should render custom fallback as function', async () => {
    const customFallback = vi.fn(({ error, resetError }) => (
      <div>
        <span>Custom error: {error.message}</span>
        <button onClick={resetError} data-testid="custom-reset">
          Custom Reset
        </button>
      </div>
    ));

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Custom error: Test error message')).toBeInTheDocument();
    });

    expect(customFallback).toHaveBeenCalledWith({
      error: expect.objectContaining({ message: 'Test error message' }),
      resetError: expect.any(Function),
    });

    const customResetButton = screen.getByTestId('custom-reset');
    expect(customResetButton).toBeInTheDocument();
  });

  it('should log errors to console', async () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'Error boundary caught an error:',
        expect.objectContaining({ message: 'Test error message' }),
        expect.any(Object)
      );
    });
  });

  it('should handle errors that occur after mounting', async () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();

    // Trigger an error by re-rendering with shouldThrow=true
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });
});
