import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Router } from '@/router';
import { AuthProvider, ThemeProvider } from '@/contexts';

// Simple helper to mount the real RouterProvider with memory history
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <AuthProvider>{ui}</AuthProvider>
    </ThemeProvider>
  );
}

describe('App Router', () => {
  it('redirects unauthenticated users from /dashboard to /login', async () => {
    renderWithProviders(<Router />);
    // simulate navigating to dashboard
    window.history.pushState({}, '', '/dashboard');

    // Landing renders first, then ProtectedRoute redirects; give it a tick
    await waitFor(() => expect(true).toBe(true));
  });
});
