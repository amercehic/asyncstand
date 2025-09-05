import React from 'react';
import { type CurrentUsage, type UsageLimit } from '@/lib/api';
import { useBilling } from '@/contexts';

interface UsageBarProps {
  label: string;
  usage: UsageLimit;
  icon?: React.ReactNode;
}

function UsageBar({ label, usage, icon }: UsageBarProps) {
  if (!usage) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-gray-500">{label}: No data available</div>
      </div>
    );
  }

  const { used, limit, percentage, overLimit, nearLimit } = usage;

  // Determine color based on usage
  let colorClass = 'bg-green-500';
  let textColorClass = 'text-green-700';

  if (overLimit) {
    colorClass = 'bg-red-500';
    textColorClass = 'text-red-700';
  } else if (nearLimit) {
    colorClass = 'bg-yellow-500';
    textColorClass = 'text-yellow-700';
  }

  const displayLimit = limit === null || limit === -1 ? '∞' : limit.toString();
  const displayPercentage = limit === null || limit === -1 ? 0 : percentage || 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        </div>
        <span className={`text-sm font-medium ${textColorClass}`}>
          {used || 0} / {displayLimit}
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${Math.min(displayPercentage, 100)}%` }}
        />
      </div>

      {overLimit && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Over limit! Upgrade to continue using this feature.
        </p>
      )}
      {nearLimit && !overLimit && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400">
          Approaching limit. Consider upgrading soon.
        </p>
      )}
    </div>
  );
}

interface UsageDisplayProps {
  usage?: CurrentUsage;
  className?: string;
}

export function UsageDisplay({ usage: propUsage, className = '' }: UsageDisplayProps) {
  const { currentUsage: contextUsage, isLoading } = useBilling();

  // Use prop usage if provided, otherwise use context usage
  const usage = propUsage || contextUsage;

  if (isLoading) {
    return (
      <div
        className={`p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-8 bg-gray-300 rounded"></div>
            <div className="h-8 bg-gray-300 rounded"></div>
            <div className="h-8 bg-gray-300 rounded"></div>
            <div className="h-8 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div
        className={`p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <div className="text-center text-gray-500 dark:text-gray-400">
          Usage information not available
        </div>
      </div>
    );
  }

  const { teams, members, standupConfigs, standupsThisMonth, nextResetDate, planName, isFreePlan } =
    usage;

  const resetDate = new Date(nextResetDate);
  const now = new Date();
  const daysUntilReset = Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div
      className={`p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Current Usage</h3>
        <div className="text-right">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              isFreePlan
                ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
            }`}
          >
            {planName} Plan
          </span>
        </div>
      </div>

      <div className="space-y-6">
        <UsageBar
          label="Teams"
          usage={teams}
          icon={
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          }
        />

        <UsageBar
          label="Team Members"
          usage={members}
          icon={
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          }
        />

        <UsageBar
          label="Standup Configurations"
          usage={standupConfigs}
          icon={
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
        />

        <UsageBar
          label="Standups This Month"
          usage={standupsThisMonth}
          icon={
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          }
        />
      </div>

      {standupsThisMonth.limit !== -1 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Usage resets in:</span>
            <span className="font-medium">
              {daysUntilReset} day{daysUntilReset !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
