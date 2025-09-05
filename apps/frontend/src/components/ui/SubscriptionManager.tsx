import React, { useState } from 'react';
import { useBilling } from '@/contexts';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/Toast';

interface SubscriptionManagerProps {
  className?: string;
}

export function SubscriptionManager({ className = '' }: SubscriptionManagerProps) {
  const { subscription, availablePlans, isLoading, cancelSubscription } = useBilling();

  const [isCancelling, setIsCancelling] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleCancelSubscription = async (immediate = false) => {
    if (!subscription) return;

    const confirmMessage = immediate
      ? 'Are you sure you want to cancel your subscription immediately? You will lose access to Pro features right away.'
      : 'Are you sure you want to cancel your subscription? You will continue to have access until the end of your billing period.';

    if (!window.confirm(confirmMessage)) return;

    try {
      setIsCancelling(true);
      await cancelSubscription(immediate);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      // For now, just show a toast message indicating this is a placeholder
      toast.info(
        'Upgrade functionality coming soon! This will integrate with Stripe for payment processing.'
      );
    } catch {
      toast.error('Failed to initiate upgrade process');
    } finally {
      setIsUpgrading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'canceled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'trialing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const currentPlanDetails = availablePlans.find(plan =>
    subscription
      ? plan.id === subscription.planKey || plan.id === subscription.planId
      : plan.id === 'free'
  );

  if (isLoading) {
    return (
      <div
        className={`p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        Subscription Details
      </h3>

      {subscription ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(subscription.status)}`}
            >
              {subscription.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {currentPlanDetails && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Plan</span>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {currentPlanDetails.name}
                </div>
                {currentPlanDetails.price > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    €{(currentPlanDetails.price / 100).toFixed(2)} / {currentPlanDetails.interval}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Current Period
            </span>
            <span className="text-sm text-gray-900 dark:text-white">
              {formatDate(subscription.currentPeriodStart)} -{' '}
              {formatDate(subscription.currentPeriodEnd)}
            </span>
          </div>

          {subscription.cancelAtPeriodEnd && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-yellow-400 mr-2"
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
                <div className="text-sm">
                  <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                    Subscription will be canceled
                  </p>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    Your subscription will end on {formatDate(subscription.currentPeriodEnd)}.
                    You'll be moved to the free plan.
                  </p>
                </div>
              </div>
            </div>
          )}

          {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancelSubscription(false)}
                  disabled={isCancelling}
                >
                  Cancel at Period End
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancelSubscription(true)}
                  disabled={isCancelling}
                  className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                >
                  Cancel Immediately
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Canceling at period end allows you to continue using Pro features until your current
                billing period expires.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-gray-400 dark:text-gray-500 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
              />
            </svg>
          </div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            You're on the Free Plan
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Upgrade to unlock more features and higher limits for your team.
          </p>
          <Button size="sm" onClick={handleUpgrade} disabled={isUpgrading}>
            {isUpgrading ? 'Processing...' : 'Upgrade to Pro'}
          </Button>
        </div>
      )}
    </div>
  );
}
