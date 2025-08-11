import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { IntegrationsProvider } from '@/contexts/IntegrationsContext';
import { TeamsProvider } from '@/contexts/TeamsContext';
import { StandupsProvider } from '@/contexts/StandupsContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * Root provider component that wraps all context providers
 * in the correct order (AuthProvider first, then feature providers)
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <IntegrationsProvider>
          <TeamsProvider>
            <StandupsProvider>{children}</StandupsProvider>
          </TeamsProvider>
        </IntegrationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
