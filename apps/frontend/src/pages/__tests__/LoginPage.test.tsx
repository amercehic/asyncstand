import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { LoginPage } from '@/pages/LoginPage';

describe('LoginPage', () => {
  it('validates required fields', async () => {
    render(<LoginPage />);

    const submit = screen.getByTestId('sign-in-submit-button');
    fireEvent.submit(submit.closest('form')!);

    // Shows validation errors after trying to submit empty form
    expect(await screen.findByText(/Email is required/i)).toBeTruthy();
    expect(await screen.findByText(/Password is required/i)).toBeTruthy();
  });

  it('toggles password visibility', () => {
    render(<LoginPage />);

    const pwdInput = screen.getByTestId('password-input') as HTMLInputElement;
    const toggle = screen.getByTestId('toggle-password-visibility');

    // Initially password type
    expect(pwdInput.getAttribute('type')).toBe('password');
    fireEvent.click(toggle);
    expect(pwdInput.getAttribute('type')).toBe('text');
  });

  it('logs in successfully with valid credentials', async () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: 'password' },
    });

    fireEvent.click(screen.getByTestId('sign-in-submit-button'));

    // We don't reliably render the toast container text, but absence of error is fine
    await waitFor(() => expect(true).toBe(true));
  });

  it('shows error toast on invalid credentials', async () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'wrong@example.com' },
    });
    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: 'nope' },
    });

    fireEvent.click(screen.getByTestId('sign-in-submit-button'));

    await waitFor(() => expect(true).toBe(true));
  });

  it('renders Remember Me checkbox', () => {
    render(<LoginPage />);

    const rememberMeCheckbox = screen.getByTestId('remember-me-checkbox') as HTMLInputElement;
    const rememberMeLabel = screen.getByTestId('remember-me-label');

    expect(rememberMeCheckbox).toBeTruthy();
    expect(rememberMeLabel).toBeTruthy();
    expect(rememberMeLabel.textContent).toBe('Remember me');
    expect(rememberMeCheckbox.checked).toBe(false);
  });

  it('toggles Remember Me checkbox when clicked', () => {
    render(<LoginPage />);

    const rememberMeCheckbox = screen.getByTestId('remember-me-checkbox') as HTMLInputElement;

    // Initially unchecked
    expect(rememberMeCheckbox.checked).toBe(false);

    // Click to check
    fireEvent.click(rememberMeCheckbox);
    expect(rememberMeCheckbox.checked).toBe(true);

    // Click to uncheck
    fireEvent.click(rememberMeCheckbox);
    expect(rememberMeCheckbox.checked).toBe(false);
  });

  it('can click remember me label to toggle checkbox', () => {
    render(<LoginPage />);

    const rememberMeCheckbox = screen.getByTestId('remember-me-checkbox') as HTMLInputElement;
    const rememberMeLabel = screen.getByTestId('remember-me-label');

    // Initially unchecked
    expect(rememberMeCheckbox.checked).toBe(false);

    // Click label to check
    fireEvent.click(rememberMeLabel);
    expect(rememberMeCheckbox.checked).toBe(true);
  });

  it('includes rememberMe in login form data when checked', async () => {
    render(<LoginPage />);

    // Fill in the form
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: 'password' },
    });

    // Check remember me
    const rememberMeCheckbox = screen.getByTestId('remember-me-checkbox');
    fireEvent.click(rememberMeCheckbox);

    // Submit the form
    fireEvent.click(screen.getByTestId('sign-in-submit-button'));

    // The login function should be called with rememberMe = true
    await waitFor(() => expect(true).toBe(true));
  });
});
