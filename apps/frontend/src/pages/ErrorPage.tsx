import React from 'react';
import { useNavigate, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { Home, RefreshCw, AlertTriangle, Bug, Mail } from 'lucide-react';
import { usePerformanceMonitor } from '@/hooks';

export const ErrorPage = React.memo(() => {
  const navigate = useNavigate();
  const error = useRouteError();
  usePerformanceMonitor('ErrorPage');

  // Determine error details
  const getErrorDetails = () => {
    if (isRouteErrorResponse(error)) {
      return {
        status: error.status,
        statusText: error.statusText,
        message: error.data?.message || 'An unexpected error occurred',
      };
    }

    if (error instanceof Error) {
      return {
        status: 500,
        statusText: 'Internal Server Error',
        message: error.message || 'Something went wrong',
      };
    }

    return {
      status: 500,
      statusText: 'Unknown Error',
      message: 'An unexpected error occurred',
    };
  };

  const { status, statusText, message } = getErrorDetails();
  const isServerError = status >= 500;

  const handleReload = () => {
    window.location.reload();
  };

  const handleReportError = () => {
    const errorInfo = {
      status,
      statusText,
      message,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    const mailtoLink = `mailto:support@asyncstand.com?subject=Error Report - ${status}&body=${encodeURIComponent(
      `Error Details:\n\n${JSON.stringify(errorInfo, null, 2)}`
    )}`;

    window.location.href = mailtoLink;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl mx-auto"
      >
        {/* Error Icon & Status */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            {isServerError ? (
              <Bug className="w-12 h-12 text-destructive" />
            ) : (
              <AlertTriangle className="w-12 h-12 text-destructive" />
            )}
          </div>
          <div className="text-6xl font-bold text-destructive mb-2">{status}</div>
          <div className="text-lg text-muted-foreground font-medium">{statusText}</div>
        </motion.div>

        {/* Error Message */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <h1 className="text-3xl lg:text-4xl font-bold mb-4 text-foreground">
            {isServerError ? 'Something went wrong on our end' : 'Unexpected Application Error'}
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-lg mx-auto">
            {message}
          </p>
        </motion.div>

        {/* Error Details Card */}
        {process.env.NODE_ENV === 'development' && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-card rounded-2xl p-6 border border-border mb-8 text-left"
          >
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Development Info
            </h3>
            <pre className="text-sm bg-muted rounded-lg p-3 overflow-auto max-h-32">
              {error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}
            </pre>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8"
        >
          <ModernButton
            variant="primary"
            size="lg"
            onClick={handleReload}
            className="group"
            data-testid="try-again-button"
          >
            <RefreshCw className="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
            Try Again
          </ModernButton>

          <ModernButton
            variant="secondary"
            size="lg"
            onClick={() => navigate('/')}
            className="group"
            data-testid="go-home-button"
          >
            <Home className="w-5 h-5 mr-2" />
            Go to Homepage
          </ModernButton>

          <ModernButton
            variant="ghost"
            size="lg"
            onClick={handleReportError}
            className="group"
            data-testid="report-issue-button"
          >
            <Mail className="w-5 h-5 mr-2" />
            Report Issue
          </ModernButton>
        </motion.div>

        {/* Help Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-sm text-muted-foreground"
        >
          {isServerError ? (
            <>
              We're working to fix this issue. If it persists, please{' '}
              <button
                onClick={handleReportError}
                className="text-primary hover:text-primary/80 transition-smooth font-medium"
                data-testid="let-us-know-button"
              >
                let us know
              </button>
              .
            </>
          ) : (
            <>
              If this problem continues, try refreshing the page or{' '}
              <button
                onClick={handleReportError}
                className="text-primary hover:text-primary/80 transition-smooth font-medium"
                data-testid="contact-support-button"
              >
                contact support
              </button>
              .
            </>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
});
