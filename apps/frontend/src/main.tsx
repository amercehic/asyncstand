import { createRoot } from 'react-dom/client';
import App from '@/App';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AccessibilityProvider } from '@/components/AccessibilityProvider';
import { AuthProvider, ThemeProvider } from '@/contexts';
import '@/styles/globals.css';
import '@/styles/accessibility.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <AccessibilityProvider>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </AccessibilityProvider>
  </ErrorBoundary>
);
