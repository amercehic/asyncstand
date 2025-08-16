import React from 'react';
import { toast as sonnerToast, ExternalToast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  Star,
  Zap,
  Sparkles,
} from 'lucide-react';

// Types for our enhanced toast system
export interface ModernToastOptions extends ExternalToast {
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  richContent?: {
    title: string;
    description?: string;
    avatar?: string;
    metadata?: string;
  };
  progress?: number;
  persistent?: boolean;
  sound?: boolean;
}

// Enhanced toast component with modern styling
const ToastContent: React.FC<{
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  message: string;
  options?: ModernToastOptions;
}> = ({ type, message, options }) => {
  const getIcon = () => {
    if (options?.icon) return options.icon;

    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      case 'loading':
        return <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getBackgroundClass = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-950/20 border-2 border-green-500 text-green-700 dark:text-green-300 shadow-[0_4px_20px_rgba(34,197,94,0.15)]';
      case 'error':
        return 'bg-red-50 dark:bg-red-950/20 border-2 border-red-500 text-red-700 dark:text-red-300 shadow-[0_4px_20px_rgba(239,68,68,0.15)]';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-500 text-amber-700 dark:text-amber-300 shadow-[0_4px_20px_rgba(245,158,11,0.15)]';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-500 text-blue-700 dark:text-blue-300 shadow-[0_4px_20px_rgba(59,130,246,0.15)]';
      case 'loading':
        return 'bg-slate-50 dark:bg-slate-950/20 border-2 border-slate-400 text-slate-700 dark:text-slate-300 shadow-[0_4px_20px_rgba(100,116,139,0.15)]';
      default:
        return 'bg-card border-2 border-border text-foreground shadow-[0_4px_20px_rgba(0,0,0,0.1)]';
    }
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl min-w-[300px] max-w-[450px] w-full ${getBackgroundClass()}`}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {options?.richContent ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              {options.richContent.avatar && (
                <div className="w-7 h-7 rounded-full bg-background border border-current/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">{options.richContent.avatar}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-base break-words hyphens-auto">
                  {options.richContent.title}
                </h4>
                {options.richContent.metadata && (
                  <span className="text-sm opacity-70 block mt-1">
                    {options.richContent.metadata}
                  </span>
                )}
              </div>
            </div>
            {options.richContent.description && (
              <p className="text-sm font-medium break-words hyphens-auto leading-relaxed">
                {options.richContent.description}
              </p>
            )}
          </div>
        ) : (
          <p className="text-base font-medium break-words hyphens-auto leading-relaxed whitespace-pre-wrap">
            {message}
          </p>
        )}

        {/* Progress bar */}
        {options?.progress !== undefined && (
          <div className="mt-3 w-full bg-current/10 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-current/60 rounded-full transition-all duration-300"
              style={{ width: `${options.progress}%` }}
            />
          </div>
        )}

        {/* Action button */}
        {options?.action && (
          <button
            onClick={options.action.onClick}
            className="mt-3 px-3 py-1.5 text-sm font-medium bg-transparent border border-current/20 rounded-lg hover:bg-current/5 focus:outline-none focus:ring-2 focus:ring-current/20 transition-all duration-150"
          >
            {options.action.label}
          </button>
        )}
      </div>
    </div>
  );
};

// Modern toast API
export const modernToast = {
  success: (message: string, options?: ModernToastOptions) => {
    const { persistent, ...otherOptions } = options || {};
    // Filter out our custom properties that shouldn't go to Sonner
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { action, richContent, icon, progress, sound, ...sonnerOptions } = otherOptions;

    // Fallback for test environments or when custom is not available
    if (!sonnerToast.custom) {
      return (
        sonnerToast.success?.(message) ||
        (typeof sonnerToast === 'function' ? sonnerToast(message) : '')
      );
    }

    return sonnerToast.custom(
      () => <ToastContent type="success" message={message} options={options} />,
      {
        duration: persistent ? Infinity : 4000,
        position: 'top-right',
        ...sonnerOptions,
      }
    );
  },

  error: (message: string, options?: ModernToastOptions) => {
    const { persistent, ...otherOptions } = options || {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { action, richContent, icon, progress, sound, ...sonnerOptions } = otherOptions;

    // Fallback for test environments or when custom is not available
    if (!sonnerToast.custom) {
      return (
        sonnerToast.error?.(message) ||
        (typeof sonnerToast === 'function' ? sonnerToast(message) : '')
      );
    }

    return sonnerToast.custom(
      () => <ToastContent type="error" message={message} options={options} />,
      {
        duration: persistent ? Infinity : 6000,
        position: 'top-right',
        ...sonnerOptions,
      }
    );
  },

  warning: (message: string, options?: ModernToastOptions) => {
    const { persistent, ...otherOptions } = options || {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { action, richContent, icon, progress, sound, ...sonnerOptions } = otherOptions;

    // Fallback for test environments or when custom is not available
    if (!sonnerToast.custom) {
      return (
        sonnerToast.warning?.(message) ||
        (typeof sonnerToast === 'function' ? sonnerToast(message) : '')
      );
    }

    return sonnerToast.custom(
      () => <ToastContent type="warning" message={message} options={options} />,
      {
        duration: persistent ? Infinity : 5000,
        position: 'top-right',
        ...sonnerOptions,
      }
    );
  },

  info: (message: string, options?: ModernToastOptions) => {
    const { persistent, ...otherOptions } = options || {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { action, richContent, icon, progress, sound, ...sonnerOptions } = otherOptions;

    // Fallback for test environments or when custom is not available
    if (!sonnerToast.custom) {
      return (
        sonnerToast.info?.(message) ||
        (typeof sonnerToast === 'function' ? sonnerToast(message) : '')
      );
    }

    return sonnerToast.custom(
      () => <ToastContent type="info" message={message} options={options} />,
      {
        duration: persistent ? Infinity : 4000,
        position: 'top-right',
        ...sonnerOptions,
      }
    );
  },

  loading: (message: string, options?: ModernToastOptions) => {
    const { persistent, ...otherOptions } = options || {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { action, richContent, icon, progress, sound, ...sonnerOptions } = otherOptions;

    // Fallback for test environments or when custom is not available
    if (!sonnerToast.custom) {
      return (
        sonnerToast.loading?.(message) ||
        (typeof sonnerToast === 'function' ? sonnerToast(message) : '')
      );
    }

    return sonnerToast.custom(
      () => <ToastContent type="loading" message={message} options={options} />,
      {
        duration: persistent ? Infinity : 30000,
        position: 'top-right',
        ...sonnerOptions,
      }
    );
  },

  // Specialized toast types
  favorite: (message: string, isFavorited: boolean) => {
    // Fallback for test environments
    if (!sonnerToast.custom) {
      return (
        sonnerToast.success?.(message) ||
        (typeof sonnerToast === 'function' ? sonnerToast(message) : '')
      );
    }

    return modernToast.success(message, {
      icon: isFavorited ? (
        <Star className="w-5 h-5 text-green-500 fill-current" />
      ) : (
        <Star className="w-5 h-5 text-green-500" />
      ),
      action: {
        label: 'View favorites',
        onClick: () => {
          /* Navigate to favorites */
        },
      },
    });
  },

  teamCreated: (teamName: string) => {
    // Fallback for test environments
    if (!sonnerToast.custom) {
      return (
        sonnerToast.success?.('Team created successfully!') ||
        (typeof sonnerToast === 'function' ? sonnerToast('Team created successfully!') : '')
      );
    }

    return modernToast.success('Team created successfully!', {
      richContent: {
        title: 'Team Created',
        description: `"${teamName}" is ready for collaboration`,
        avatar: teamName.charAt(0).toUpperCase(),
        metadata: 'Just now',
      },
      action: {
        label: 'View team',
        onClick: () => {
          /* Navigate to team */
        },
      },
    });
  },

  memberAdded: (memberName: string, teamName: string) => {
    // Fallback for test environments
    if (!sonnerToast.custom) {
      return (
        sonnerToast.success?.('Member added successfully!') ||
        (typeof sonnerToast === 'function' ? sonnerToast('Member added successfully!') : '')
      );
    }

    return modernToast.success('Member added successfully!', {
      richContent: {
        title: 'New Team Member',
        description: `${memberName} joined "${teamName}"`,
        avatar: memberName.charAt(0).toUpperCase(),
        metadata: 'Just now',
      },
    });
  },

  integrationConnected: (platform: string) => {
    // Fallback for test environments
    if (!sonnerToast.custom) {
      return (
        sonnerToast.success?.('Integration connected!') ||
        (typeof sonnerToast === 'function' ? sonnerToast('Integration connected!') : '')
      );
    }

    return modernToast.success('Integration connected!', {
      richContent: {
        title: `${platform} Connected`,
        description: 'Your team can now receive standup notifications',
        metadata: 'Just now',
      },
      icon: <Zap className="w-5 h-5 text-green-500" />,
      action: {
        label: 'Configure',
        onClick: () => {
          /* Open integration settings */
        },
      },
    });
  },

  standupCompleted: (completionRate: number) => {
    // Fallback for test environments
    if (!sonnerToast.custom) {
      return (
        sonnerToast.success?.('Standup completed!') ||
        (typeof sonnerToast === 'function' ? sonnerToast('Standup completed!') : '')
      );
    }

    return modernToast.success('Standup completed!', {
      richContent: {
        title: 'Daily Standup Complete',
        description: `${completionRate}% team participation`,
        metadata: 'Just now',
      },
      icon: <Sparkles className="w-5 h-5 text-green-500" />,
      progress: completionRate,
    });
  },

  // Promise-based toast for async operations
  promise: async <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    },
    options?: ModernToastOptions
  ): Promise<string | number> => {
    const toastId = modernToast.loading(messages.loading, { persistent: true });

    try {
      const data = await promise;
      sonnerToast.dismiss(toastId);
      const successMessage =
        typeof messages.success === 'function' ? messages.success(data) : messages.success;
      return modernToast.success(successMessage, options);
    } catch (error) {
      sonnerToast.dismiss(toastId);
      const errorMessage =
        typeof messages.error === 'function'
          ? messages.error(error instanceof Error ? error : new Error(String(error)))
          : messages.error;
      return modernToast.error(errorMessage, options);
    }
  },

  // Dismiss functions
  dismiss: sonnerToast.dismiss,
  dismissAll: () => sonnerToast.dismiss(),
};

// Export for easy usage
export { modernToast as toast };
