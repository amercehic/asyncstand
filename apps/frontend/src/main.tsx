import { createRoot } from 'react-dom/client';
import App from '@/App';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AccessibilityProvider } from '@/components/AccessibilityProvider';
import { AppProviders } from '@/contexts';
import { optimizeCriticalPath, setupRoutePreloading } from '@/utils/preloader';
import '@/styles/globals.css';
import '@/styles/accessibility.css';

// Initialize performance optimizations
optimizeCriticalPath();
setupRoutePreloading();

// Remove initial loader when React takes over
const removeInitialLoader = () => {
  const loader = document.querySelector('.app-loader') as HTMLElement;
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 150);
  }
};

// Create root and render with loading state removal
const root = createRoot(document.getElementById('root')!);

root.render(
  <ErrorBoundary>
    <AccessibilityProvider>
      <AppProviders>
        <App />
      </AppProviders>
    </AccessibilityProvider>
  </ErrorBoundary>
);

// Remove loader after initial render
setTimeout(removeInitialLoader, 100);
