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
  Heart,
  Upload,
  Mail,
  Trash2,
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
  success: (
    message: string,
    options?: Omit<ModernToastOptions, 'description'> & { description?: string }
  ) => {
    const { persistent, description, ...otherOptions } = options || {};
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
      t => (
        <div className="bg-background border-border rounded-lg shadow-lg p-4 flex items-start gap-3 min-w-[400px] border-l-4 border-l-green-500 animate-in slide-in-from-right-full">
          <div className="flex-shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5 text-green-500 animate-in zoom-in-50 duration-300" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-foreground text-sm">{message}</div>
            {description && <div className="text-muted-foreground text-sm mt-1">{description}</div>}
          </div>
          <button
            onClick={() => sonnerToast.dismiss(t)}
            className="flex-shrink-0 w-6 h-6 rounded-full bg-transparent hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ),
      {
        duration: persistent ? Infinity : 4000,
        position: 'top-right',
        ...sonnerOptions,
      }
    );
  },

  error: (
    message: string,
    options?: Omit<ModernToastOptions, 'description'> & {
      description?: string;
      action?: { label: string; onClick: () => void };
    }
  ) => {
    const { persistent, description, action, ...otherOptions } = options || {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { richContent, icon, progress, sound, ...sonnerOptions } = otherOptions;

    // Fallback for test environments or when custom is not available
    if (!sonnerToast.custom) {
      return (
        sonnerToast.error?.(message) ||
        (typeof sonnerToast === 'function' ? sonnerToast(message) : '')
      );
    }

    return sonnerToast.custom(
      t => (
        <div className="bg-background border-border rounded-lg shadow-lg p-4 flex items-start gap-3 min-w-[400px] border-l-4 border-l-red-500 animate-in slide-in-from-right-full">
          <div className="flex-shrink-0 mt-0.5">
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-foreground text-sm">{message}</div>
            {description && <div className="text-muted-foreground text-sm mt-1">{description}</div>}
            {action && (
              <button
                onClick={() => {
                  sonnerToast.dismiss(t);
                  action.onClick();
                }}
                className="mt-2 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                {action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => sonnerToast.dismiss(t)}
            className="flex-shrink-0 w-6 h-6 rounded-full bg-transparent hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ),
      {
        duration: persistent ? Infinity : 6000,
        position: 'top-right',
        ...sonnerOptions,
      }
    );
  },

  warning: (
    message: string,
    options?: Omit<ModernToastOptions, 'description'> & {
      description?: string;
      action?: { label: string; onClick: () => void };
    }
  ) => {
    const { persistent, description, action, ...otherOptions } = options || {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { richContent, icon, progress, sound, ...sonnerOptions } = otherOptions;

    // Fallback for test environments or when custom is not available
    if (!sonnerToast.custom) {
      return (
        sonnerToast.warning?.(message) ||
        (typeof sonnerToast === 'function' ? sonnerToast(message) : '')
      );
    }

    return sonnerToast.custom(
      t => (
        <div className="bg-background border-border rounded-lg shadow-lg p-4 flex items-start gap-3 min-w-[400px] border-l-4 border-l-orange-500 animate-in slide-in-from-right-full">
          <div className="flex-shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-foreground text-sm">{message}</div>
            {description && <div className="text-muted-foreground text-sm mt-1">{description}</div>}
            {action && (
              <button
                onClick={() => {
                  sonnerToast.dismiss(t);
                  action.onClick();
                }}
                className="mt-2 text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors"
              >
                {action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => sonnerToast.dismiss(t)}
            className="flex-shrink-0 w-6 h-6 rounded-full bg-transparent hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ),
      {
        duration: persistent ? Infinity : 5000,
        position: 'top-right',
        ...sonnerOptions,
      }
    );
  },

  info: (
    message: string,
    options?: Omit<ModernToastOptions, 'description'> & { description?: string }
  ) => {
    const { persistent, description, ...otherOptions } = options || {};
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
      t => (
        <div className="bg-background border-border rounded-lg shadow-lg p-4 flex items-start gap-3 min-w-[400px] border-l-4 border-l-blue-500 animate-in slide-in-from-right-full">
          <div className="flex-shrink-0 mt-0.5">
            <Info className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-foreground text-sm">{message}</div>
            {description && <div className="text-muted-foreground text-sm mt-1">{description}</div>}
          </div>
          <button
            onClick={() => sonnerToast.dismiss(t)}
            className="flex-shrink-0 w-6 h-6 rounded-full bg-transparent hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ),
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
    options?: Omit<ModernToastOptions, 'description'> & { description?: string }
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

  // Additional toast methods matching the provided design
  custom: (render: (t: string | number) => React.ReactElement, options?: ModernToastOptions) => {
    const { persistent, ...otherOptions } = options || {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { action, richContent, icon, progress, sound, ...sonnerOptions } = otherOptions;

    if (!sonnerToast.custom) {
      return sonnerToast.success?.('Custom toast') || '';
    }

    return sonnerToast.custom(render, {
      duration: persistent ? Infinity : 4000,
      position: 'top-right',
      ...sonnerOptions,
    });
  },

  // Design pattern toasts from the example
  heartToast: () => {
    if (!sonnerToast.custom) {
      return sonnerToast.success?.("You're awesome!") || '';
    }

    return sonnerToast.custom(t => (
      <div className="flex items-center gap-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg shadow-lg min-w-80">
        <Heart className="w-6 h-6 text-white animate-pulse" />
        <div className="flex-1">
          <p className="font-medium">You're awesome!</p>
          <p className="text-sm opacity-90">Thanks for being part of our community.</p>
        </div>
        <button
          onClick={() => sonnerToast.dismiss(t)}
          className="text-white/80 hover:text-white transition-colors"
        >
          ×
        </button>
      </div>
    ));
  },

  richMessageToast: (options: { from: string; preview: string }) => {
    if (!sonnerToast.custom) {
      return sonnerToast.info?.('New message received') || '';
    }

    return sonnerToast.custom(t => (
      <div className="w-96 overflow-hidden shadow-lg border-0 bg-card rounded-lg">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6" />
            <div>
              <h4 className="font-medium">New message received</h4>
              <p className="text-sm text-blue-100">From: {options.from}</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-3">"{options.preview}"</p>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
              onClick={() => {
                sonnerToast.dismiss(t);
                sonnerToast.success('Message marked as read');
              }}
            >
              Read
            </button>
            <button
              className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80"
              onClick={() => sonnerToast.dismiss(t)}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    ));
  },

  uploadPromiseToast: () => {
    const promise = new Promise<{ data: string }>(resolve => {
      setTimeout(() => resolve({ data: 'File uploaded successfully!' }), 3000);
    });

    return sonnerToast.promise(promise, {
      loading: (
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 animate-spin" />
          Uploading file...
        </div>
      ),
      success: (data: { data: string }) => (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          {data.data}
        </div>
      ),
      error: 'Upload failed',
    });
  },

  actionToast: (message: string, actionLabel: string, onAction: () => void) => {
    return sonnerToast(message, {
      icon: <Trash2 className="w-4 h-4 text-gray-500" />,
      action: {
        label: actionLabel,
        onClick: onAction,
      },
    });
  },

  multipleSequentialToasts: (messages: string[]) => {
    messages.forEach((message, index) => {
      setTimeout(() => {
        if (index === messages.length - 1) {
          sonnerToast.info(message);
        } else {
          sonnerToast.success(message);
        }
      }, index * 500);
    });
  },

  // Dismiss functions
  dismiss: sonnerToast.dismiss,
  dismissAll: () => sonnerToast.dismiss(),
};

// Export for easy usage
export { modernToast as toast };
