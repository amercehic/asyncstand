import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Package,
  TrendingUp,
  Plus,
  ArrowUp,
  ArrowDown,
  FileText,
  Download,
  XCircle,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ModernButton, toast } from '@/components/ui';
import { PaymentMethodCard, AddPaymentMethodCard } from '@/components/billing/PaymentMethodCard';
import { AddPaymentMethodModal } from '@/components/billing/AddPaymentMethodModal';
import {
  useBillingData,
  useDownloadInvoice,
  useRemovePaymentMethod,
  useCancelSubscription,
  useReactivateSubscription,
} from '@/hooks/useBillingData';
import type { BillingPlan } from '@/lib/api-client/billing';

interface BillingSettingsProps {
  isActive: boolean;
}

export const BillingSettings = React.memo<BillingSettingsProps>(({ isActive }) => {
  const navigate = useNavigate();

  // Billing state
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [invoicePage, setInvoicePage] = useState(1);
  const invoiceLimit = 3;

  // Billing hooks (only when billing tab is active)
  const {
    subscription,
    usage,
    invoices,
    paymentMethods,
    plans,
    isLoading: isBillingLoading,
    queries: billingQueries,
  } = useBillingData(isActive, invoicePage, invoiceLimit);

  const downloadInvoice = useDownloadInvoice();
  const removePaymentMethod = useRemovePaymentMethod();
  const cancelSubscription = useCancelSubscription();
  const reactivateSubscription = useReactivateSubscription();

  // Track which payment method is being deleted
  const [deletingPaymentMethodId, setDeletingPaymentMethodId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  if (isBillingLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="billing-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <motion.div
        key="billing"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        {/* Subscription Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plan Card */}
          <div className="bg-card rounded-2xl border border-border p-6" data-testid="plan-card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Current Plan
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold" data-testid="plan-price">
                  {(() => {
                    // If we have an active subscription, try to get the plan price
                    if (subscription?.subscription && plans && plans.length > 0) {
                      const currentPlan = plans.find(
                        (p: BillingPlan) => p.id === subscription.subscription?.planId
                      );
                      if (currentPlan && currentPlan.price > 0) {
                        return new Intl.NumberFormat('de-DE', {
                          style: 'currency',
                          currency: 'EUR',
                        }).format(currentPlan.price / 100);
                      }
                    }

                    // Fallback to usage data plan pricing if available
                    if (usage?.usage && !usage.usage.isFreePlan && plans && plans.length > 0) {
                      const planByName = plans.find(
                        (p: BillingPlan) =>
                          p.name.toLowerCase() === usage.usage.planName.toLowerCase()
                      );
                      if (planByName && planByName.price > 0) {
                        return new Intl.NumberFormat('de-DE', {
                          style: 'currency',
                          currency: 'EUR',
                        }).format(planByName.price / 100);
                      }
                    }

                    // Default to free plan
                    return '€0,00';
                  })()}
                  <span className="text-sm text-muted-foreground font-normal">/month</span>
                </span>
                <span
                  className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium"
                  data-testid="plan-name"
                >
                  {(() => {
                    // Try to get plan name from subscription data first
                    if (subscription?.subscription && plans && plans.length > 0) {
                      const currentPlan = plans.find(
                        (p: BillingPlan) => p.id === subscription.subscription?.planId
                      );
                      if (currentPlan?.name) {
                        return currentPlan.name.toUpperCase();
                      }
                    }

                    // Fallback to usage data plan name
                    if (usage?.usage?.planName && !usage.usage.isFreePlan) {
                      return usage.usage.planName.toUpperCase();
                    }

                    // Fallback to subscription plan string or FREE
                    return subscription?.plan?.toUpperCase() || 'FREE';
                  })()}
                </span>
              </div>

              {/* Plan Details */}
              {subscription?.subscription && (
                <div
                  className="space-y-2 text-sm text-muted-foreground"
                  data-testid="subscription-details"
                >
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span
                      className={`font-medium ${
                        subscription.subscription.status === 'active'
                          ? 'text-green-600'
                          : subscription.subscription.status === 'canceled'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                      }`}
                      data-testid="subscription-status"
                    >
                      {subscription.subscription.status?.charAt(0).toUpperCase() +
                        subscription.subscription.status?.slice(1)}
                    </span>
                  </div>
                  {subscription.subscription.currentPeriodEnd && (
                    <div className="flex justify-between">
                      <span>Next billing:</span>
                      <span className="font-medium" data-testid="next-billing-date">
                        {format(
                          new Date(subscription.subscription.currentPeriodEnd),
                          'MMM dd, yyyy'
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div data-testid="plan-actions">
                {(() => {
                  const isActiveSubscription = subscription?.subscription?.status === 'active';
                  const isCanceled = subscription?.subscription?.cancelAtPeriodEnd || false;
                  const planKey =
                    subscription?.subscription?.planKey || subscription?.plan || 'free';
                  const isEnterprisePlan = planKey?.toLowerCase() === 'enterprise';

                  if (isActiveSubscription && !isCanceled) {
                    return (
                      <div className="space-y-2">
                        <ModernButton
                          className="w-full gap-2"
                          onClick={() => navigate('/upgrade-plan')}
                          data-testid="upgrade-plan-button"
                        >
                          {isEnterprisePlan ? (
                            <>
                              <ArrowDown className="w-4 h-4" />
                              Downgrade to Starter Plan
                            </>
                          ) : (
                            <>
                              <ArrowUp className="w-4 h-4" />
                              Upgrade Plan
                            </>
                          )}
                        </ModernButton>
                        <ModernButton
                          variant="outline"
                          className="w-full gap-2 border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900"
                          onClick={() => setShowCancelDialog(true)}
                          disabled={cancelSubscription.isPending}
                          data-testid="cancel-subscription-button"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel Subscription
                        </ModernButton>
                      </div>
                    );
                  } else if (isCanceled && isActiveSubscription) {
                    return (
                      <div className="space-y-3">
                        <div
                          className="p-3 bg-amber-50 border border-amber-200 rounded-lg"
                          data-testid="cancellation-notice"
                        >
                          <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Subscription ends on{' '}
                            {subscription?.subscription?.currentPeriodEnd &&
                              format(
                                new Date(subscription.subscription.currentPeriodEnd),
                                'MMMM d, yyyy'
                              )}
                          </p>
                        </div>
                        <ModernButton
                          className="w-full gap-2"
                          onClick={() => reactivateSubscription.mutate()}
                          disabled={reactivateSubscription.isPending}
                          data-testid="reactivate-subscription-button"
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${reactivateSubscription.isPending ? 'animate-spin' : ''}`}
                          />
                          {reactivateSubscription.isPending
                            ? 'Reactivating...'
                            : 'Reactivate Subscription'}
                        </ModernButton>
                      </div>
                    );
                  } else {
                    return (
                      <ModernButton
                        className="w-full gap-2"
                        onClick={() => navigate('/upgrade-plan')}
                        data-testid="upgrade-to-starter-button"
                      >
                        <ArrowUp className="w-4 h-4" />
                        Upgrade to Starter Plan
                      </ModernButton>
                    );
                  }
                })()}
              </div>
            </div>
          </div>

          {/* Usage Card */}
          <div className="bg-card rounded-2xl border border-border p-6" data-testid="usage-card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Usage Summary
            </h3>
            <div className="space-y-4">
              {/* Team Members */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Team Members</span>
                  <span className="text-muted-foreground" data-testid="members-usage">
                    {usage?.usage?.members?.used || 0} / {usage?.usage?.members?.limit || 10}
                  </span>
                </div>
                <div className="h-2 bg-accent rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{
                      width: `${Math.min(((usage?.usage?.members?.used || 0) / (usage?.usage?.members?.limit || 10)) * 100, 100)}%`,
                    }}
                    data-testid="members-usage-bar"
                  />
                </div>
              </div>

              {/* Teams */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Teams</span>
                  <span className="text-muted-foreground" data-testid="teams-usage">
                    {usage?.usage?.teams?.used || 0} / {usage?.usage?.teams?.limit || 5}
                  </span>
                </div>
                <div className="h-2 bg-accent rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{
                      width: `${Math.min(((usage?.usage?.teams?.used || 0) / (usage?.usage?.teams?.limit || 5)) * 100, 100)}%`,
                    }}
                    data-testid="teams-usage-bar"
                  />
                </div>
              </div>

              {/* Standup Configs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Standup Configs</span>
                  <span className="text-muted-foreground" data-testid="standup-configs-usage">
                    {usage?.usage?.standupConfigs?.used || 0} /{' '}
                    {usage?.usage?.standupConfigs?.limit || 3}
                  </span>
                </div>
                <div className="h-2 bg-accent rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{
                      width: `${Math.min(((usage?.usage?.standupConfigs?.used || 0) / (usage?.usage?.standupConfigs?.limit || 3)) * 100, 100)}%`,
                    }}
                    data-testid="standup-configs-usage-bar"
                  />
                </div>
              </div>

              {/* Standup Instances This Month */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Standups This Month</span>
                  <span className="text-muted-foreground" data-testid="standups-month-usage">
                    {usage?.usage?.standupsThisMonth?.used || 0} /{' '}
                    {usage?.usage?.standupsThisMonth?.limit || 100}
                  </span>
                </div>
                <div className="h-2 bg-accent rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{
                      width: `${Math.min(((usage?.usage?.standupsThisMonth?.used || 0) / (usage?.usage?.standupsThisMonth?.limit || 100)) * 100, 100)}%`,
                    }}
                    data-testid="standups-month-usage-bar"
                  />
                </div>
              </div>

              {/* Next Reset Date */}
              {usage?.usage?.nextResetDate && (
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Usage resets on:</span>
                    <span className="font-medium" data-testid="usage-reset-date">
                      {format(new Date(usage.usage.nextResetDate), 'MMM dd, yyyy')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div
          className="bg-card rounded-2xl border border-border p-6"
          data-testid="payment-methods-card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Payment Methods
            </h3>
            <ModernButton
              variant="secondary"
              size="sm"
              onClick={() => setShowAddPayment(true)}
              className="gap-2"
              data-testid="add-payment-method-button"
            >
              <Plus className="w-4 h-4" />
              Add Payment Method
            </ModernButton>
          </div>

          {billingQueries?.paymentMethods?.isLoading ? (
            <div
              className="flex items-center justify-center py-8"
              data-testid="payment-methods-loading"
            >
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : paymentMethods && paymentMethods.length > 0 ? (
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
              data-testid="payment-methods-list"
            >
              {paymentMethods.map(method => (
                <PaymentMethodCard
                  key={method.id}
                  method={method}
                  onSetDefault={() => {
                    toast.success('Set as default payment method');
                  }}
                  onRemove={id => {
                    setDeletingPaymentMethodId(id);
                    removePaymentMethod.mutate({ paymentMethodId: id });
                  }}
                  isLoading={removePaymentMethod.isPending}
                  isDeleting={deletingPaymentMethodId === method.id}
                />
              ))}
              <AddPaymentMethodCard onClick={() => setShowAddPayment(true)} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="no-payment-methods">
              <AddPaymentMethodCard onClick={() => setShowAddPayment(true)} />
            </div>
          )}
        </div>

        {/* Billing History */}
        <div
          className="bg-card rounded-2xl border border-border p-6"
          data-testid="billing-history-card"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Billing History
          </h3>

          {billingQueries?.invoices?.isLoading && invoicePage === 1 ? (
            <div className="flex items-center justify-center py-8" data-testid="invoices-loading">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : invoices && invoices.invoices && invoices.invoices.length > 0 ? (
            <div className="relative">
              {billingQueries?.invoices?.isFetching && invoicePage > 1 && (
                <div className="absolute inset-0 bg-background/50 rounded-lg flex items-center justify-center z-10">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="invoices-table">
                  <thead>
                    <tr className="border-b border-border text-sm text-muted-foreground">
                      <th className="text-left py-2">Date</th>
                      <th className="text-left py-2">Description</th>
                      <th className="text-left py-2">Amount</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-center py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoices.invoices.map(invoice => (
                      <tr
                        key={invoice.id}
                        className="text-sm"
                        data-testid={`invoice-row-${invoice.id}`}
                      >
                        <td className="py-3">{format(new Date(invoice.date), 'MMM dd, yyyy')}</td>
                        <td className="py-3">
                          {(() => {
                            let desc = invoice.description || '';
                            desc = desc.replace(/^\d+ × /, '');
                            desc = desc.replace(/ - \d{1,2}\/\d{1,2}\/\d{4}$/, '');
                            desc = desc.replace(/ - \w{3} \d{1,2}, \d{4}$/, '');
                            desc = desc.replace(/ - \d{4}-\d{2}-\d{2}$/, '');
                            return desc;
                          })()}
                        </td>
                        <td className="py-3 font-medium">
                          {new Intl.NumberFormat('de-DE', {
                            style: 'currency',
                            currency: 'EUR',
                          }).format(invoice.amount / 100)}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              invoice.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : invoice.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {invoice.status?.charAt(0).toUpperCase() + invoice.status?.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          {invoice.status === 'paid' && (
                            <button
                              onClick={() =>
                                downloadInvoice.mutate({
                                  invoiceId: invoice.id,
                                  invoiceUrl: invoice.invoiceUrl,
                                })
                              }
                              className="inline-flex items-center justify-center w-8 h-8 text-primary hover:text-primary/80 hover:bg-primary/10 rounded-lg transition-colors"
                              disabled={downloadInvoice.isPending}
                              title="Download Invoice"
                              data-testid={`download-invoice-${invoice.id}`}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {invoices.pagination && invoices.pagination.totalPages > 1 && (
                <div
                  className="flex items-center justify-between mt-4 pt-4 border-t border-border"
                  data-testid="invoices-pagination"
                >
                  <div className="text-sm text-muted-foreground">
                    Showing {(invoicePage - 1) * invoiceLimit + 1}-
                    {Math.min(invoicePage * invoiceLimit, invoices.pagination.total)} of{' '}
                    {invoices.pagination.total} invoices
                  </div>
                  <div className="flex items-center gap-2">
                    <ModernButton
                      variant="outline"
                      size="sm"
                      onClick={() => setInvoicePage(prev => Math.max(1, prev - 1))}
                      disabled={invoicePage === 1 || billingQueries?.invoices?.isFetching}
                      className="gap-1"
                      data-testid="invoices-previous-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </ModernButton>

                    <div className="flex items-center gap-1">
                      {(() => {
                        const totalPages = invoices.pagination.totalPages;
                        const current = invoicePage;
                        const pages: (number | string)[] = [];

                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          pages.push(1);
                          if (current <= 4) {
                            for (let i = 2; i <= 5; i++) {
                              pages.push(i);
                            }
                            pages.push('ellipsis1');
                            pages.push(totalPages);
                          } else if (current >= totalPages - 3) {
                            pages.push('ellipsis1');
                            for (let i = totalPages - 4; i <= totalPages; i++) {
                              pages.push(i);
                            }
                          } else {
                            pages.push('ellipsis1');
                            for (let i = current - 1; i <= current + 1; i++) {
                              pages.push(i);
                            }
                            pages.push('ellipsis2');
                            pages.push(totalPages);
                          }
                        }

                        return pages.map(page => {
                          if (typeof page === 'string') {
                            return (
                              <span key={page} className="px-2 text-muted-foreground">
                                ...
                              </span>
                            );
                          }

                          return (
                            <button
                              key={page}
                              onClick={() => setInvoicePage(page)}
                              disabled={billingQueries?.invoices?.isFetching}
                              className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                                page === current
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-accent'
                              }`}
                              data-testid={`invoice-page-${page}`}
                            >
                              {page}
                            </button>
                          );
                        });
                      })()}
                    </div>

                    <ModernButton
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setInvoicePage(prev => Math.min(invoices.pagination.totalPages, prev + 1))
                      }
                      disabled={
                        invoicePage === invoices.pagination.totalPages ||
                        billingQueries?.invoices?.isFetching
                      }
                      className="gap-1"
                      data-testid="invoices-next-page"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </ModernButton>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="text-center py-8 text-muted-foreground"
              data-testid="no-billing-history"
            >
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No billing history yet</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Cancel Subscription Confirmation Dialog */}
      {showCancelDialog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          data-testid="cancel-subscription-dialog"
        >
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Cancel Subscription?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Your subscription will remain active until{' '}
              {subscription?.subscription?.currentPeriodEnd &&
                format(new Date(subscription.subscription.currentPeriodEnd), 'MMMM d, yyyy')}
              . After that, you'll be downgraded to the free plan.
            </p>
            <div className="flex gap-3">
              <ModernButton
                variant="secondary"
                className="flex-1"
                onClick={() => setShowCancelDialog(false)}
                data-testid="keep-subscription-button"
              >
                Keep Subscription
              </ModernButton>
              <ModernButton
                variant="outline"
                className="flex-1 border-red-300 hover:bg-red-50 text-red-700 hover:text-red-800"
                onClick={() => {
                  cancelSubscription.mutate({ immediate: false });
                  setShowCancelDialog(false);
                }}
                disabled={cancelSubscription.isPending}
                data-testid="confirm-cancel-button"
              >
                {cancelSubscription.isPending ? 'Canceling...' : 'Yes, Cancel'}
              </ModernButton>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        isOpen={showAddPayment}
        onClose={() => setShowAddPayment(false)}
        onSuccess={() => {
          if (billingQueries?.paymentMethods) {
            billingQueries.paymentMethods.refetch();
          }
          setShowAddPayment(false);
          toast.success('Payment method added successfully');
        }}
      />
    </>
  );
});

BillingSettings.displayName = 'BillingSettings';
