import { Router } from '@/router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider, ThemeProvider } from '@/contexts';
import { AccessibilityProvider } from '@/components/AccessibilityProvider';
import { SkipLinks } from '@/components/ui';

export default function App() {
  return (
    <ErrorBoundary>
      <AccessibilityProvider>
        <ThemeProvider>
          <AuthProvider>
            <SkipLinks />
            <Router />
          </AuthProvider>
        </ThemeProvider>
      </AccessibilityProvider>
    </ErrorBoundary>
  );
}
