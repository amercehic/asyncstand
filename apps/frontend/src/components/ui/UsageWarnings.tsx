import React from 'react';
import { type UsageWarning } from '@/lib/api';
import { useBilling } from '@/contexts';

interface UsageWarningsProps {
  warnings?: UsageWarning[];
  className?: string;
}

export function UsageWarnings({ warnings: propWarnings, className = '' }: UsageWarningsProps) {
  const { usageWarnings: contextWarnings } = useBilling();

  // Use prop warnings if provided, otherwise use context warnings
  const warnings = propWarnings || contextWarnings || [];

  if (!warnings || !warnings.length) return null;

  const getWarningIcon = (severity: UsageWarning['severity']) => {
    switch (severity) {
      case 'error':
        return (
          <svg
            className="w-5 h-5 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg
            className="w-5 h-5 text-yellow-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        );
      case 'info':
        return (
          <svg
            className="w-5 h-5 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const getWarningBgClass = (severity: UsageWarning['severity']) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800';
    }
  };

  const getWarningTextClass = (severity: UsageWarning['severity']) => {
    switch (severity) {
      case 'error':
        return 'text-red-800 dark:text-red-200';
      case 'warning':
        return 'text-yellow-800 dark:text-yellow-200';
      case 'info':
        return 'text-blue-800 dark:text-blue-200';
      default:
        return 'text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Usage Notifications</h4>

      {warnings.map((warning, index) => (
        <div
          key={`${warning.type}-${index}`}
          className={`flex items-start gap-3 p-4 rounded-lg border ${getWarningBgClass(warning.severity)}`}
        >
          <div className="flex-shrink-0 mt-0.5">{getWarningIcon(warning.severity)}</div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${getWarningTextClass(warning.severity)}`}>{warning.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
