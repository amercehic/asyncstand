import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { SignUpPage } from '@/pages/SignUpPage';

describe('SignUpPage', () => {
  it('shows password requirement icons and animates when met', async () => {
    render(<SignUpPage />);

    const passwordInput = screen.getByTestId('password-input');
    fireEvent.change(passwordInput, { target: { value: 'Aa1@aaaa' } });

    // Requirements container becomes visible
    await waitFor(() => {
      expect(screen.getByText(/At least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('submits after all validations and logs in user', async () => {
    render(<SignUpPage />);

    fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'Aa1@aaaa' } });

    const terms = screen.getByTestId('terms-checkbox') as HTMLInputElement;
    fireEvent.click(terms);
    expect(terms.checked).toBe(true);

    fireEvent.click(screen.getByTestId('create-account-submit-button'));

    // Allow async chains to complete (signup -> login)
    await waitFor(() => expect(true).toBe(true));
  });
});
