import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { IntegrationsProvider } from '@/contexts/IntegrationsContext';
import { TeamsProvider } from '@/contexts/TeamsContext';
import { ModalProvider } from '@/contexts/ModalContext';
import { Toaster } from '@/components/ui';

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <IntegrationsProvider>
            <TeamsProvider>
              <ModalProvider>
                {children}
                <Toaster position="top-center" richColors closeButton />
              </ModalProvider>
            </TeamsProvider>
          </IntegrationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): ReturnType<typeof render> => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
