import React from 'react';
import { toast as sonnerToast, ExternalToast } from 'sonner';
import { CheckCircle2, Star, Zap, Sparkles, Heart, Upload, Mail, Trash2 } from 'lucide-react';

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

// Modern toast API
export const modernToast = {
  success: (
    message: string,
    options?: Omit<ModernToastOptions, 'description'> & { description?: string }
  ) => {
    const { persistent, ...otherOptions } = options || {};
    const duration = persistent ? Infinity : otherOptions?.duration;
    return sonnerToast.success(message, {
      ...otherOptions,
      duration,
    });
  },

  error: (
    message: string,
    options?: Omit<ModernToastOptions, 'description'> & {
      description?: string;
      action?: { label: string; onClick: () => void };
    }
  ) => {
    const { persistent, ...otherOptions } = options || {};
    const duration = persistent ? Infinity : otherOptions?.duration;
    return sonnerToast.error(message, {
      ...otherOptions,
      duration,
    });
  },

  warning: (
    message: string,
    options?: Omit<ModernToastOptions, 'description'> & {
      description?: string;
      action?: { label: string; onClick: () => void };
    }
  ) => {
    const { persistent, ...otherOptions } = options || {};
    const duration = persistent ? Infinity : otherOptions?.duration;
    return sonnerToast.warning(message, {
      ...otherOptions,
      duration,
    });
  },

  info: (
    message: string,
    options?: Omit<ModernToastOptions, 'description'> & { description?: string }
  ) => {
    const { persistent, ...otherOptions } = options || {};
    const duration = persistent ? Infinity : otherOptions?.duration;
    return sonnerToast.info(message, {
      ...otherOptions,
      duration,
    });
  },

  loading: (message: string, options?: ModernToastOptions) => {
    const { persistent, ...otherOptions } = options || {};
    const duration = persistent ? Infinity : otherOptions?.duration;
    return sonnerToast.loading(message, {
      ...otherOptions,
      duration,
    });
  },

  // Specialized toast types
  favorite: (message: string, isFavorited: boolean) => {
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
      const err = error instanceof Error ? error : new Error(String(error));
      const errorMessage =
        typeof messages.error === 'function' ? messages.error(err) : messages.error;
      return modernToast.error(errorMessage, options);
    }
  },

  custom: (render: (t: string | number) => React.ReactElement, options?: ModernToastOptions) => {
    const { persistent, ...otherOptions } = options || {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { action, richContent, icon, progress, sound, ...sonnerOptions } = otherOptions || {};

    if (!sonnerToast.custom) {
      return sonnerToast.success?.('Custom toast') || '';
    }

    return sonnerToast.custom(render, {
      duration: persistent ? Infinity : 4000,
      position: 'top-right',
      ...sonnerOptions,
    });
  },

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
