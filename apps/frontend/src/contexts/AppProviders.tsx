import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { IntegrationsProvider } from '@/contexts/IntegrationsContext';
import { TeamsProvider } from '@/contexts/TeamsContext';
import { StandupsProvider } from '@/contexts/StandupsContext';
import { ModalProvider } from '@/contexts/ModalContext';
import { FeatureProvider } from '@/contexts/FeatureContext';

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
      <ModalProvider>
        <AuthProvider>
          <FeatureProvider>
            <IntegrationsProvider>
              <TeamsProvider>
                <StandupsProvider>{children}</StandupsProvider>
              </TeamsProvider>
            </IntegrationsProvider>
          </FeatureProvider>
        </AuthProvider>
      </ModalProvider>
    </ThemeProvider>
  );
}
