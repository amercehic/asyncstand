import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { ToastData } from '@/components/ui/Toast/types';
import '@/components/ui/Toast/toast.css';

interface ToastProps {
  toast: ToastData;
  onRemove: (id: string) => void;
}

const typeIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
  custom: null,
};

const typeStyles = {
  success: {
    border: 'border-l-4 border-l-green-500',
    icon: 'text-green-500',
    bg: 'bg-card',
    progress: 'bg-green-500',
  },
  error: {
    border: 'border-l-4 border-l-red-500',
    icon: 'text-red-500',
    bg: 'bg-card',
    progress: 'bg-red-500',
  },
  warning: {
    border: 'border-l-4 border-l-orange-500',
    icon: 'text-orange-500',
    bg: 'bg-card',
    progress: 'bg-orange-500',
  },
  info: {
    border: 'border-l-4 border-l-blue-500',
    icon: 'text-blue-500',
    bg: 'bg-card',
    progress: 'bg-blue-500',
  },
  loading: {
    border: 'border-l-4 border-l-blue-500',
    icon: 'text-blue-500 animate-spin',
    bg: 'bg-card',
    progress: 'bg-blue-500',
  },
  custom: {
    border: 'border-l-4 border-l-gray-500',
    icon: 'text-gray-500',
    bg: 'bg-card',
    progress: 'bg-gray-500',
  },
};

export const ToastComponent: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  const IconComponent = toast.icon ? null : typeIcons[toast.type];
  const styles = typeStyles[toast.type];

  useEffect(() => {
    setIsVisible(true);

    if (!toast.persistent && toast.duration && toast.duration > 0) {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - 100 / (toast.duration! / 50);
          return Math.max(0, newProgress);
        });
      }, 50);

      const timer = setTimeout(() => {
        handleRemove();
      }, toast.duration);

      return () => {
        clearTimeout(timer);
        clearInterval(progressInterval);
      };
    }

    return undefined;
  }, [toast.duration, toast.persistent]);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 200);
  };

  if (toast.render) {
    return (
      <div
        className={cn(
          'toast-item transform transition-all duration-200 ease-out',
          isVisible && !isExiting
            ? 'translate-x-0 opacity-100 scale-100'
            : 'translate-x-full opacity-0 scale-95',
          toast.className
        )}
        data-toast-type={toast.type}
        data-toast-exiting={isExiting}
      >
        {toast.render(toast)}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'toast-item group relative flex w-full min-w-80 max-w-md items-start gap-4 rounded-xl border border-border/50 p-5 shadow-2xl backdrop-blur-md transition-all duration-300 ease-out hover:shadow-3xl hover:scale-[1.02]',
        'bg-gradient-to-br from-card/95 to-card/80 dark:from-card/90 dark:to-card/70',
        styles.border,
        isVisible && !isExiting
          ? 'translate-x-0 opacity-100 scale-100'
          : 'translate-x-full opacity-0 scale-95',
        toast.className
      )}
      role="alert"
      aria-live="polite"
      data-toast-type={toast.type}
      data-toast-exiting={isExiting}
    >
      {/* Progress bar */}
      {!toast.persistent && toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 h-1.5 w-full overflow-hidden rounded-b-xl bg-muted/30">
          <div
            className={cn(
              'h-full transition-all duration-50 ease-linear shadow-sm',
              styles.progress
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Icon */}
      <div className="flex-shrink-0">
        {toast.icon ? (
          <div
            className={cn('mt-0.5 transition-all duration-200 group-hover:scale-110', styles.icon)}
          >
            {toast.icon}
          </div>
        ) : IconComponent ? (
          <IconComponent
            className={cn(
              'h-5 w-5 mt-0.5 transition-all duration-200 group-hover:scale-110',
              styles.icon
            )}
          />
        ) : null}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-1">
        {toast.title && (
          <h4 className="font-semibold text-sm text-card-foreground">{toast.title}</h4>
        )}

        {toast.richContent ? (
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              {toast.richContent.avatar && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  {toast.richContent.avatar}
                </div>
              )}
              <div className="flex-1">
                <p className="font-medium text-sm text-card-foreground">
                  {toast.richContent.title}
                </p>
                {toast.richContent.description && (
                  <p className="text-sm text-muted-foreground">{toast.richContent.description}</p>
                )}
                {toast.richContent.metadata && (
                  <p className="text-xs text-muted-foreground mt-1">{toast.richContent.metadata}</p>
                )}
              </div>
            </div>
            {toast.richContent.component && <toast.richContent.component />}
          </div>
        ) : (
          <>
            <p className="text-sm text-card-foreground leading-relaxed">{toast.message}</p>
            {toast.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{toast.description}</p>
            )}
          </>
        )}

        {/* Progress indicator for specific progress */}
        {typeof toast.progress === 'number' && toast.progress >= 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{Math.round(toast.progress)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${toast.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action button */}
        {toast.action && (
          <div className="mt-3">
            <button
              onClick={toast.action.onClick}
              className={cn(
                'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
                'h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90',
                toast.action.className
              )}
            >
              {toast.action.label}
            </button>
          </div>
        )}
      </div>

      {/* Close button */}
      {toast.dismissible !== false && (
        <button
          onClick={handleRemove}
          className="flex-shrink-0 opacity-60 hover:opacity-100 hover:bg-muted/50 rounded-full p-1 transition-all duration-200 hover:scale-110"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

// Export with both names for compatibility
export const Toast = ToastComponent;
