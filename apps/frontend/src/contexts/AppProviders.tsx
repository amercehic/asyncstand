import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { IntegrationsProvider } from '@/contexts/IntegrationsContext';
import { TeamsProvider } from '@/contexts/TeamsContext';
import { StandupsProvider } from '@/contexts/StandupsContext';
import { ModalProvider } from '@/contexts/ModalContext';
import { FeatureProvider } from '@/contexts/FeatureContext';
import { BillingProvider } from '@/contexts/BillingContext';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: (failureCount: number, error: unknown) => {
        // Don't retry on 4xx errors except for 408, 429
        const err = error as { response?: { status?: number } };
        if (err?.response?.status && err.response.status >= 400 && err.response.status < 500) {
          if (err.response.status === 408 || err.response.status === 429) {
            return failureCount < 3;
          }
          return false;
        }
        // Retry on 5xx errors and network errors
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * Root provider component that wraps all context providers
 * in the correct order (AuthProvider first, then feature providers)
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ModalProvider>
          <AuthProvider>
            <FeatureProvider>
              <BillingProvider>
                <IntegrationsProvider>
                  <TeamsProvider>
                    <StandupsProvider>{children}</StandupsProvider>
                  </TeamsProvider>
                </IntegrationsProvider>
              </BillingProvider>
            </FeatureProvider>
          </AuthProvider>
        </ModalProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
