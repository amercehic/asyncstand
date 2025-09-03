import React from 'react';
import { Star, Zap, Sparkles, Heart, Mail, Trash2 } from 'lucide-react';
import { ToastData, ToastOptions, CreateToastData, ToastType } from '@/components/ui/Toast/types';

type ToastFunction = (message: string, options?: ToastOptions) => string;
type ToastPromiseFunction = <T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: Error) => string);
  },
  options?: ToastOptions
) => Promise<string>;

let toastManager: {
  addToast: (toast: CreateToastData) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<ToastData>) => void;
  clearToasts: () => void;
} | null = null;

export function setToastManager(manager: typeof toastManager) {
  toastManager = manager;
}

function getDefaultDuration(type: ToastType): number {
  const durations = {
    success: 4000,
    error: 6000, // Longer for errors
    warning: 5000, // Longer for warnings
    info: 4000,
    loading: 0, // Loading toasts should not auto-dismiss
    custom: 4000,
  };
  return durations[type];
}

function getDefaultPersistent(type: ToastType): boolean {
  // Only loading toasts should be persistent by default
  return type === 'loading';
}

function createToast(type: ToastData['type'], message: string, options: ToastOptions = {}): string {
  if (!toastManager) {
    console.warn('Toast manager not initialized. Make sure ToastManager is rendered in your app.');
    return '';
  }

  const {
    id,
    duration = getDefaultDuration(type),
    persistent = getDefaultPersistent(type),
    dismissible = true,
    priority = 'normal',
    allowDuplicates = false,
    duplicateStrategy = 'ignore',
    duplicateCheckFields = ['message', 'type'],
    ...otherOptions
  } = options;

  const newToast = {
    type,
    message,
    duration,
    persistent,
    dismissible,
    priority,
    allowDuplicates,
    duplicateStrategy,
    duplicateCheckFields,
    ...otherOptions,
  };

  // If a custom ID is provided, use it (the reducer will handle replacing existing toasts)
  if (id) {
    return toastManager.addToast({ ...newToast, id });
  }

  return toastManager.addToast(newToast);
}

const success: ToastFunction = (message, options) => createToast('success', message, options);

const error: ToastFunction = (message, options) => createToast('error', message, options);

const warning: ToastFunction = (message, options) => createToast('warning', message, options);

const info: ToastFunction = (message, options) => createToast('info', message, options);

const loading: ToastFunction = (message, options) =>
  createToast('loading', message, { persistent: true, ...options });

const custom = (
  render: (toast: ToastData) => React.ReactElement,
  options: ToastOptions = {}
): string => {
  if (!toastManager) {
    console.warn('Toast manager not initialized.');
    return '';
  }

  return toastManager.addToast({
    type: 'custom',
    message: '',
    render,
    ...options,
  });
};

const promise: ToastPromiseFunction = async (promiseOrFunction, messages, options) => {
  const loadingId = loading(messages.loading, { persistent: true });

  try {
    const data = await promiseOrFunction;
    if (toastManager) {
      toastManager.removeToast(loadingId);
    }
    const successMessage =
      typeof messages.success === 'function' ? messages.success(data) : messages.success;
    return success(successMessage, options);
  } catch (err) {
    if (toastManager) {
      toastManager.removeToast(loadingId);
    }
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const errorMessage =
      typeof messages.error === 'function' ? messages.error(errorObj) : messages.error;
    return error(errorMessage, options);
  }
};

const dismiss = (id: string) => {
  if (toastManager) {
    toastManager.removeToast(id);
  }
};

const dismissAll = () => {
  if (toastManager) {
    toastManager.clearToasts();
  }
};

const update = (id: string, updates: Partial<ToastData>) => {
  if (toastManager) {
    toastManager.updateToast(id, updates);
  }
};

const favorite = (message: string, isFavorited: boolean = true) => {
  return success(message, {
    icon: React.createElement(Star, {
      className: `w-5 h-5 text-green-500 ${isFavorited ? 'fill-current' : ''}`,
    }),
    action: {
      label: 'View favorites',
      onClick: () => {
        console.log('Navigate to favorites');
      },
    },
  });
};

const teamCreated = (teamName: string, teamId?: string, navigate?: (path: string) => void) => {
  return success('Team created successfully!', {
    richContent: {
      title: 'Team Created',
      description: `"${teamName}" is ready for collaboration`,
      avatar: teamName.charAt(0).toUpperCase(),
      metadata: 'Just now',
    },
    action: {
      label: 'View team',
      onClick: () => {
        if (teamId && navigate) {
          // Navigate immediately - no loading toast needed since it's fast with cache
          navigate(`/teams/${teamId}`);
        }
      },
    },
  });
};

const memberAdded = (memberName: string, teamName: string) => {
  return success('Member added successfully!', {
    richContent: {
      title: 'New Team Member',
      description: `${memberName} joined "${teamName}"`,
      avatar: memberName.charAt(0).toUpperCase(),
      metadata: 'Just now',
    },
  });
};

const integrationConnected = (platform: string) => {
  return success('Integration connected!', {
    richContent: {
      title: `${platform} Connected`,
      description: 'Your team can now receive standup notifications',
      metadata: 'Just now',
    },
    icon: React.createElement(Zap, { className: 'w-5 h-5 text-green-500' }),
    action: {
      label: 'Configure',
      onClick: () => {
        console.log('Open integration settings');
      },
    },
  });
};

const standupCompleted = (completionRate: number) => {
  return success('Standup completed!', {
    richContent: {
      title: 'Daily Standup Complete',
      description: `${completionRate}% team participation`,
      metadata: 'Just now',
    },
    icon: React.createElement(Sparkles, { className: 'w-5 h-5 text-green-500' }),
    progress: completionRate,
  });
};

const heartToast = () => {
  return custom(toast =>
    React.createElement(
      'div',
      {
        className:
          'flex items-center gap-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg shadow-lg min-w-80',
      },
      [
        React.createElement(Heart, {
          key: 'icon',
          className: 'w-6 h-6 text-white animate-pulse',
        }),
        React.createElement(
          'div',
          {
            key: 'content',
            className: 'flex-1',
          },
          [
            React.createElement(
              'p',
              {
                key: 'title',
                className: 'font-medium',
              },
              "You're awesome!"
            ),
            React.createElement(
              'p',
              {
                key: 'desc',
                className: 'text-sm opacity-90',
              },
              'Thanks for being part of our community.'
            ),
          ]
        ),
        React.createElement(
          'button',
          {
            key: 'close',
            onClick: () => dismiss(toast.id),
            className: 'text-white/80 hover:text-white transition-colors',
          },
          '×'
        ),
      ]
    )
  );
};

const richMessageToast = (options: { from: string; preview: string }) => {
  return custom(toast =>
    React.createElement(
      'div',
      {
        className: 'w-96 overflow-hidden shadow-lg border-0 bg-card rounded-lg',
      },
      [
        React.createElement(
          'div',
          {
            key: 'header',
            className: 'bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white',
          },
          React.createElement(
            'div',
            {
              className: 'flex items-center gap-3',
            },
            [
              React.createElement(Mail, {
                key: 'icon',
                className: 'w-6 h-6',
              }),
              React.createElement('div', { key: 'text' }, [
                React.createElement(
                  'h4',
                  {
                    key: 'title',
                    className: 'font-medium',
                  },
                  'New message received'
                ),
                React.createElement(
                  'p',
                  {
                    key: 'from',
                    className: 'text-sm text-blue-100',
                  },
                  `From: ${options.from}`
                ),
              ]),
            ]
          )
        ),
        React.createElement(
          'div',
          {
            key: 'body',
            className: 'p-4',
          },
          [
            React.createElement(
              'p',
              {
                key: 'preview',
                className: 'text-sm text-muted-foreground mb-3',
              },
              `"${options.preview}"`
            ),
            React.createElement(
              'div',
              {
                key: 'actions',
                className: 'flex gap-2',
              },
              [
                React.createElement(
                  'button',
                  {
                    key: 'read',
                    className:
                      'px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90',
                    onClick: () => {
                      dismiss(toast.id);
                      success('Message marked as read');
                    },
                  },
                  'Read'
                ),
                React.createElement(
                  'button',
                  {
                    key: 'dismiss',
                    className:
                      'px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80',
                    onClick: () => dismiss(toast.id),
                  },
                  'Dismiss'
                ),
              ]
            ),
          ]
        ),
      ]
    )
  );
};

const uploadPromiseToast = () => {
  const uploadPromise = new Promise<{ data: string }>(resolve => {
    setTimeout(() => resolve({ data: 'File uploaded successfully!' }), 3000);
  });

  return promise(uploadPromise, {
    loading: 'Uploading file...',
    success: data => data.data,
    error: 'Upload failed',
  });
};

const actionToast = (message: string, actionLabel: string, onAction: () => void) => {
  return info(message, {
    icon: React.createElement(Trash2, { className: 'w-4 h-4 text-gray-500' }),
    action: {
      label: actionLabel,
      onClick: onAction,
    },
  });
};

const multipleSequentialToasts = (messages: string[]) => {
  messages.forEach((message, index) => {
    setTimeout(() => {
      if (index === messages.length - 1) {
        info(message);
      } else {
        success(message);
      }
    }, index * 500);
  });
};

// Enhanced API methods
const batch = (
  toasts: Array<{ type: ToastData['type']; message: string; options?: ToastOptions }>
) => {
  return toasts.map(({ type, message, options }) => createToast(type, message, options));
};

const successIf = (condition: boolean, message: string, options?: ToastOptions) => {
  return condition ? success(message, options) : '';
};

const errorIf = (condition: boolean, message: string, options?: ToastOptions) => {
  return condition ? error(message, options) : '';
};

const sequence = async (
  toasts: Array<{
    message: string;
    type: ToastData['type'];
    delay?: number;
    options?: ToastOptions;
  }>
) => {
  for (const [index, toastConfig] of toasts.entries()) {
    if (index > 0 && toastConfig.delay) {
      await new Promise(resolve => setTimeout(resolve, toastConfig.delay));
    }
    createToast(toastConfig.type, toastConfig.message, toastConfig.options);
  }
};

const withPriority = (priority: 'low' | 'normal' | 'high' | 'urgent') => ({
  success: (message: string, options?: ToastOptions) => success(message, { ...options, priority }),
  error: (message: string, options?: ToastOptions) => error(message, { ...options, priority }),
  warning: (message: string, options?: ToastOptions) => warning(message, { ...options, priority }),
  info: (message: string, options?: ToastOptions) => info(message, { ...options, priority }),
});

export const toast = {
  success,
  error,
  warning,
  info,
  loading,
  custom,
  promise,
  dismiss,
  dismissAll,
  update,

  // Enhanced methods
  batch,
  successIf,
  errorIf,
  sequence,
  withPriority,

  // Existing specialized methods
  favorite,
  teamCreated,
  memberAdded,
  integrationConnected,
  standupCompleted,
  heartToast,
  richMessageToast,
  uploadPromiseToast,
  actionToast,
  multipleSequentialToasts,
};
