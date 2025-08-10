import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ModernButton } from '@/components/ui';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

interface PageErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

function PageErrorFallback({ resetError }: Pick<PageErrorFallbackProps, 'resetError'>) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-card">
          <div className="bg-destructive/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>

          <h1 className="text-xl font-semibold mb-2">Page Error</h1>
          <p className="text-muted-foreground mb-6">
            This page encountered an error. Please try refreshing or go back to the previous page.
          </p>

          <div className="flex flex-col gap-3">
            <ModernButton onClick={resetError} variant="primary" className="w-full">
              Try Again
            </ModernButton>

            <ModernButton onClick={() => navigate(-1)} variant="secondary" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </ModernButton>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PageErrorBoundaryProps {
  children: React.ReactNode;
}

export function PageErrorBoundary({ children }: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <PageErrorFallback error={error} resetError={resetError} />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
