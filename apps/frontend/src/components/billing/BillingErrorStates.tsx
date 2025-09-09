import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Wifi,
  Server,
  Clock,
  FileX,
  Shield,
} from 'lucide-react';
import { ModernButton } from '@/components/ui';
import { cn } from '@/components/ui/utils';

interface ErrorStateProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    isLoading?: boolean;
  };
  variant?: 'error' | 'warning' | 'info';
  className?: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  icon,
  action,
  variant = 'error',
  className,
}) => {
  const colors = {
    error: 'text-destructive',
    warning: 'text-warning',
    info: 'text-info',
  };

  const bgColors = {
    error: 'bg-destructive/10 border-destructive/20',
    warning: 'bg-warning/10 border-warning/20',
    info: 'bg-info/10 border-info/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('rounded-xl border p-8 text-center space-y-4', bgColors[variant], className)}
    >
      <div
        className={cn(
          'w-12 h-12 mx-auto rounded-full flex items-center justify-center',
          bgColors[variant]
        )}
      >
        {icon || <AlertTriangle className={cn('w-6 h-6', colors[variant])} />}
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">{message}</p>
      </div>

      {action && (
        <ModernButton
          onClick={action.onClick}
          isLoading={action.isLoading}
          variant={variant === 'error' ? 'destructive' : 'primary'}
        >
          <RefreshCw className="w-4 h-4" />
          {action.label}
        </ModernButton>
      )}
    </motion.div>
  );
};

export const NetworkErrorState: React.FC<{ onRetry: () => void; isRetrying?: boolean }> = ({
  onRetry,
  isRetrying,
}) => (
  <ErrorState
    title="Connection Failed"
    message="Unable to connect to our servers. Please check your internet connection and try again."
    icon={<Wifi className="w-6 h-6 text-destructive" />}
    action={{
      label: 'Retry Connection',
      onClick: onRetry,
      isLoading: isRetrying,
    }}
    variant="error"
  />
);

export const ServerErrorState: React.FC<{ onRetry: () => void; isRetrying?: boolean }> = ({
  onRetry,
  isRetrying,
}) => (
  <ErrorState
    title="Server Error"
    message="Something went wrong on our end. Our team has been notified and is working on a fix."
    icon={<Server className="w-6 h-6 text-destructive" />}
    action={{
      label: 'Try Again',
      onClick: onRetry,
      isLoading: isRetrying,
    }}
    variant="error"
  />
);

export const PaymentFailedErrorState: React.FC<{ onRetry: () => void; isRetrying?: boolean }> = ({
  onRetry,
  isRetrying,
}) => (
  <ErrorState
    title="Payment Failed"
    message="Your payment could not be processed. Please check your payment method or try a different card."
    icon={<CreditCard className="w-6 h-6 text-destructive" />}
    action={{
      label: 'Update Payment Method',
      onClick: onRetry,
      isLoading: isRetrying,
    }}
    variant="error"
  />
);

export const SubscriptionLoadErrorState: React.FC<{
  onRetry: () => void;
  isRetrying?: boolean;
}> = ({ onRetry, isRetrying }) => (
  <ErrorState
    title="Failed to Load Subscription"
    message="We couldn't load your subscription details. Please try refreshing the page."
    icon={<FileX className="w-6 h-6 text-destructive" />}
    action={{
      label: 'Refresh Data',
      onClick: onRetry,
      isLoading: isRetrying,
    }}
    variant="error"
  />
);

export const InvoiceDownloadErrorState: React.FC<{ onRetry: () => void; isRetrying?: boolean }> = ({
  onRetry,
  isRetrying,
}) => (
  <ErrorState
    title="Download Failed"
    message="We couldn't download your invoice. The file may be temporarily unavailable."
    icon={<FileX className="w-6 h-6 text-destructive" />}
    action={{
      label: 'Try Download Again',
      onClick: onRetry,
      isLoading: isRetrying,
    }}
    variant="error"
  />
);

export const RateLimitErrorState: React.FC<{ resetTime?: Date }> = ({ resetTime }) => (
  <ErrorState
    title="Rate Limit Exceeded"
    message={
      resetTime
        ? `Too many requests. Please wait until ${resetTime.toLocaleTimeString()} before trying again.`
        : 'Too many requests. Please wait a moment before trying again.'
    }
    icon={<Clock className="w-6 h-6 text-warning" />}
    variant="warning"
  />
);

export const MaintenanceErrorState: React.FC = () => (
  <ErrorState
    title="Maintenance Mode"
    message="We're currently performing scheduled maintenance. Billing services will be back online shortly."
    icon={<Shield className="w-6 h-6 text-info" />}
    variant="info"
  />
);

export const EmptyBillingHistoryState: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-12 px-4"
  >
    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent flex items-center justify-center">
      <FileX className="w-8 h-8 text-muted-foreground" />
    </div>
    <h3 className="text-lg font-semibold mb-2">No Billing History</h3>
    <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
      You haven't been charged yet. Your billing history will appear here once you have
      transactions.
    </p>
    <ModernButton variant="secondary" size="sm">
      View Subscription Details
    </ModernButton>
  </motion.div>
);

export const NoPaymentMethodsState: React.FC<{ onAddPaymentMethod: () => void }> = ({
  onAddPaymentMethod,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-12 px-4"
  >
    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
      <CreditCard className="w-8 h-8 text-primary" />
    </div>
    <h3 className="text-lg font-semibold mb-2">No Payment Methods</h3>
    <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
      Add a payment method to manage your subscription and avoid service interruptions.
    </p>
    <ModernButton onClick={onAddPaymentMethod} variant="primary">
      <CreditCard className="w-4 h-4" />
      Add Payment Method
    </ModernButton>
  </motion.div>
);

// Inline error states for specific components
export const InlineErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  compact?: boolean;
}> = ({ message, onRetry, isRetrying, compact = false }) => (
  <div
    className={cn(
      'flex items-center gap-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg',
      compact ? 'px-3 py-2' : 'px-4 py-3'
    )}
  >
    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
    <span className="flex-1">{message}</span>
    {onRetry && (
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="text-destructive hover:text-destructive/80 disabled:opacity-50 transition-colors"
      >
        <RefreshCw className={cn('w-4 h-4', isRetrying && 'animate-spin')} />
      </button>
    )}
  </div>
);

export const InlineWarningState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center gap-3 text-sm text-warning bg-warning/10 border border-warning/20 rounded-lg px-4 py-3">
    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
    <span>{message}</span>
  </div>
);
