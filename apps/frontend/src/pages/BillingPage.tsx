import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
import {
  CreditCard,
  Calendar,
  Download,
  Plus,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  TrendingUp,
  Shield,
  AlertCircle,
  ChevronRight,
  Zap,
  Package,
  Users,
  FileText,
  Settings,
  ArrowUp,
  Trash2,
  // ArrowDown,
  // Wifi,
} from 'lucide-react';
import { ModernButton, toast } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/components/ui/utils';
import type {
  Subscription,
  CurrentUsage,
  BillingPeriod,
  BillingPlan,
} from '@/lib/api-client/billing';
import {
  useBillingData,
  useDownloadInvoice,
  useRetryPayment,
  useRemovePaymentMethod,
} from '@/hooks/useBillingData';
import {
  BillingPageSkeleton,
  PlanCardSkeleton,
  UsageCardSkeleton,
  PaymentMethodCardSkeleton,
  BillingTableSkeleton,
} from '@/components/billing/BillingSkeletonLoaders';
import {
  NetworkErrorState,
  ServerErrorState,
  SubscriptionLoadErrorState,
  EmptyBillingHistoryState,
  NoPaymentMethodsState,
  InlineErrorState,
} from '@/components/billing/BillingErrorStates';
import { AddPaymentMethodModal } from '@/components/billing/AddPaymentMethodModal';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Types
interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'failed' | 'pending' | 'refunded';
  invoiceUrl?: string;
}

interface PaymentMethodDisplay {
  id: string;
  brand: 'visa' | 'mastercard' | 'amex' | 'discover';
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

interface UsageMetric {
  name: string;
  used: number;
  limit: number;
  unit: string;
  icon: React.ReactNode;
}

// Helper functions
const getCardBrandLogo = (brand: string) => {
  const logos: Record<string, string> = {
    visa: '/card-logos/visa.svg',
    mastercard: '/card-logos/mastercard.svg',
    amex: '/card-logos/amex.svg',
    discover: '/card-logos/discover.svg',
  };
  return logos[brand.toLowerCase()] || '/card-logos/generic.svg';
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    paid: 'bg-green-500/10 text-green-600 border-green-500/30',
    failed: 'bg-red-500/10 text-red-600 border-red-500/30',
    pending: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    refunded: 'bg-gray-500/10 text-gray-600 border-gray-500/30',
  };
  return colors[status] || colors.paid;
};

const getUsageColor = (percentage: number) => {
  if (percentage >= 90) return 'bg-destructive';
  if (percentage >= 75) return 'bg-warning';
  if (percentage >= 50) return 'bg-yellow-500';
  return 'bg-success';
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount / 100); // Assuming amount is in cents
};

// Components
const PlanCard: React.FC<{
  subscription: { subscription: Subscription | null; plan: string } | null;
  plans: BillingPlan[];
  usage?: { usage: CurrentUsage; billingPeriod: BillingPeriod } | null;
}> = ({ subscription, plans, usage }) => {
  const navigate = useNavigate();

  const currentPlan = plans?.find(p => p.id === subscription?.subscription?.planId) || {
    name: subscription?.plan || 'Starter Plan',
    price: 0,
    limits: {
      members: usage?.usage?.members?.limit || 25,
      teams: usage?.usage?.teams?.limit || 10,
      standupConfigs: usage?.usage?.standupConfigs?.limit || null,
      standupsPerMonth: usage?.usage?.standupsThisMonth?.limit || 500,
    },
  };

  const daysUntilRenewal = useMemo(() => {
    if (!subscription?.subscription?.currentPeriodEnd) return null;
    return differenceInDays(new Date(subscription.subscription.currentPeriodEnd), new Date());
  }, [subscription]);

  const planFeatures = [
    {
      name: 'Team Members',
      value: currentPlan.limits?.members || 'Unlimited',
      icon: <Users className="w-4 h-4" />,
    },
    {
      name: 'Teams',
      value: currentPlan.limits?.teams || 'Unlimited',
      icon: <Package className="w-4 h-4" />,
    },
    {
      name: 'Standup Configs',
      value: currentPlan.limits?.standupConfigs || 'Unlimited',
      icon: <Settings className="w-4 h-4" />,
    },
    {
      name: 'Standups/Month',
      value: currentPlan.limits?.standupsPerMonth || 'Unlimited',
      icon: <Zap className="w-4 h-4" />,
    },
  ];

  const isFreePlan = usage?.usage?.isFreePlan ?? true;
  const planName = usage?.usage?.planName || currentPlan.name;

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-all duration-300 group"
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-5 h-5 text-primary" />
            <span
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium',
                isFreePlan ? 'bg-gray-100 text-gray-700' : 'bg-primary/10 text-primary'
              )}
            >
              {planName?.toUpperCase()}
            </span>
            {subscription?.subscription?.status && (
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  subscription.subscription.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                )}
              >
                {subscription.subscription.status}
              </span>
            )}
          </div>
          <h3 className="text-2xl font-semibold mb-1">
            {formatCurrency((currentPlan.price || 0) * 100)}
            <span className="text-sm text-muted-foreground font-normal">/month</span>
          </h3>
          {daysUntilRenewal !== null && daysUntilRenewal > 0 && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Renews in {daysUntilRenewal} days
            </p>
          )}
        </div>
        <button
          className="p-2 hover:bg-accent rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          onClick={() => toast.info('Plan settings')}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {planFeatures.map((feature, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-primary/60">{feature.icon}</span>
              <span className="text-muted-foreground">{feature.name}</span>
            </div>
            <span className="font-medium">{feature.value}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <ModernButton
          className="flex-1"
          variant="primary"
          onClick={() => navigate('/settings/billing/upgrade')}
        >
          <ArrowUp className="w-4 h-4" />
          Upgrade Plan
        </ModernButton>
        <ModernButton variant="secondary" onClick={() => toast.info('Manage plan')}>
          <MoreVertical className="w-4 h-4" />
        </ModernButton>
      </div>
    </motion.div>
  );
};

const UsageCard: React.FC<{
  usage: { usage: CurrentUsage; billingPeriod: BillingPeriod } | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
}> = ({ usage, onRefresh, isRefreshing }) => {
  const currentUsage = usage?.usage;

  const metrics: UsageMetric[] = [
    {
      name: 'Team Members',
      used: currentUsage?.members?.used || 0,
      limit: currentUsage?.members?.limit || 25,
      unit: 'members',
      icon: <Users className="w-4 h-4" />,
    },
    {
      name: 'Teams',
      used: currentUsage?.teams?.used || 0,
      limit: currentUsage?.teams?.limit || 10,
      unit: 'teams',
      icon: <Package className="w-4 h-4" />,
    },
    {
      name: 'Standup Configs',
      used: currentUsage?.standupConfigs?.used || 0,
      limit: currentUsage?.standupConfigs?.limit || 999999,
      unit: currentUsage?.standupConfigs?.limit ? 'configs' : '',
      icon: <Settings className="w-4 h-4" />,
    },
    {
      name: 'Standups This Month',
      used: currentUsage?.standupsThisMonth?.used || 0,
      limit: currentUsage?.standupsThisMonth?.limit || 500,
      unit: 'standups',
      icon: <Zap className="w-4 h-4" />,
    },
  ].filter(m => m.limit !== null && m.limit !== 999999);

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className="bg-card border border-border rounded-xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Usage Summary
        </h3>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
        </button>
      </div>

      <div className="space-y-4">
        {metrics.map((metric, idx) => {
          const percentage = (metric.used / metric.limit) * 100;

          return (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {metric.icon}
                  <span className="font-medium">{metric.name}</span>
                </div>
                <span className="text-muted-foreground">
                  {metric.used.toLocaleString()} / {metric.limit.toLocaleString()} {metric.unit}
                </span>
              </div>
              <div className="relative h-2 bg-accent rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(percentage, 100)}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: idx * 0.1 }}
                  className={cn('h-full transition-colors', getUsageColor(percentage))}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 animate-shimmer" />
                </motion.div>
              </div>
              {percentage >= 75 && (
                <p className="text-xs text-warning flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {percentage >= 90 ? 'Limit almost reached' : 'Approaching limit'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

const BillingHistoryTable: React.FC<{
  invoices: Invoice[];
  onDownload: (invoice: Invoice) => void;
  onRetry: (invoice: Invoice) => void;
  isLoading?: boolean;
}> = ({ invoices = [], onDownload, onRetry, isLoading }) => {
  const [filter, setFilter] = useState<'all' | 'paid' | 'failed' | 'pending' | 'refunded'>('all');

  const filteredInvoices = useMemo(() => {
    if (filter === 'all') return invoices;
    return invoices.filter(invoice => invoice.status === filter);
  }, [filter]);

  // Show empty state if no invoices after filtering
  if (filteredInvoices.length === 0 && invoices.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold">Billing History</h3>
        </div>
        <EmptyBillingHistoryState />
      </div>
    );
  }

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className="bg-card border border-border rounded-xl"
    >
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Billing History</h3>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Transactions</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <AnimatePresence>
              {filteredInvoices.map((invoice, idx) => (
                <motion.tr
                  key={invoice.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: idx * 0.05 }}
                  className="hover:bg-accent/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {format(new Date(invoice.date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{invoice.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {formatCurrency(invoice.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                        getStatusColor(invoice.status)
                      )}
                    >
                      {invoice.status === 'paid' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {invoice.status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
                      {invoice.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                      {invoice.status === 'refunded' && <RefreshCw className="w-3 h-3 mr-1" />}
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <div className="flex items-center justify-end gap-2">
                      {invoice.status === 'paid' && invoice.invoiceUrl && (
                        <button
                          onClick={() => onDownload(invoice)}
                          disabled={isLoading}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all disabled:opacity-50"
                          title="Download Invoice"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {invoice.status === 'failed' && (
                        <button
                          onClick={() => onRetry(invoice)}
                          disabled={isLoading}
                          className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-all disabled:opacity-50"
                          title="Retry Payment"
                        >
                          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                        </button>
                      )}
                      {invoice.status === 'pending' && (
                        <button
                          onClick={() => toast.info('Cancel payment')}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                          title="Cancel Payment"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      {invoice.status === 'refunded' && (
                        <span className="p-2 text-gray-400" title="Refunded">
                          <CheckCircle className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {filteredInvoices.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">No transactions found</div>
      )}

      {filteredInvoices.length > 10 && (
        <div className="p-4 border-t border-border flex justify-center">
          <ModernButton variant="secondary" size="sm">
            Load More
          </ModernButton>
        </div>
      )}
    </motion.div>
  );
};

const PaymentMethodCard: React.FC<{
  method: PaymentMethodDisplay;
  onSetDefault: (id: string) => void;
  onRemove: (id: string) => void;
  isLoading?: boolean;
  isDeleting?: boolean;
}> = ({ method, onSetDefault, onRemove, isLoading, isDeleting }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <motion.div
      variants={fadeInUp}
      whileHover={{ scale: 1.02 }}
      className="relative bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-6 shadow-lg"
    >
      {method.isDefault && (
        <span className="absolute top-3 right-3 px-2 py-1 bg-primary/20 text-primary-foreground rounded text-xs font-medium">
          Default
        </span>
      )}

      <div className="flex items-start justify-between mb-4">
        <img src={getCardBrandLogo(method.brand)} alt={method.brand} className="h-8 w-auto" />
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="font-mono text-lg tracking-wider">•••• •••• •••• {method.last4}</div>
        <div className="text-sm text-gray-300">
          Expires {method.expiryMonth.toString().padStart(2, '0')}/{method.expiryYear}
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-12 right-3 bg-card border border-border rounded-lg shadow-lg py-1 z-10"
          >
            {!method.isDefault && (
              <button
                onClick={() => {
                  onSetDefault(method.id);
                  setMenuOpen(false);
                }}
                disabled={isLoading}
                className="px-4 py-2 text-sm hover:bg-accent w-full text-left text-foreground disabled:opacity-50"
              >
                Set as Default
              </button>
            )}
            <button
              onClick={() => {
                onRemove(method.id);
                setMenuOpen(false);
              }}
              disabled={isLoading}
              className="px-4 py-2 text-sm hover:bg-accent w-full text-left text-destructive disabled:opacity-50"
            >
              Remove
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deletion loading overlay */}
      <AnimatePresence>
        {isDeleting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-red-500/20 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-30 border border-red-400/30"
          >
            {/* Pulsing delete animation */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [0.8, 1.1, 1],
                opacity: 1,
              }}
              transition={{
                duration: 0.6,
                scale: { times: [0, 0.4, 1] },
              }}
              className="flex flex-col items-center gap-3"
            >
              {/* Animated trash icon */}
              <motion.div
                animate={{
                  rotate: [0, -10, 10, -5, 5, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatType: 'reverse',
                  ease: 'easeInOut',
                }}
                className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center shadow-lg"
              >
                <Trash2 className="w-6 h-6 text-white" />
              </motion.div>

              {/* Deletion text with typing effect */}
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-white font-medium text-center"
              >
                <div className="text-sm">Removing card...</div>

                {/* Progress dots */}
                <div className="flex items-center justify-center gap-1 mt-2">
                  {[0, 1, 2].map(index => (
                    <motion.div
                      key={index}
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.3, 1, 0.3],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: index * 0.2,
                        ease: 'easeInOut',
                      }}
                      className="w-1.5 h-1.5 bg-white rounded-full"
                    />
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* Subtle background animation */}
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-red-600/20 rounded-xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const AddPaymentMethodCard: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <motion.button
      variants={fadeInUp}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="h-full min-h-[180px] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-accent/50 transition-all"
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Plus className="w-6 h-6 text-primary" />
      </div>
      <span className="text-sm font-medium">Add Payment Method</span>
    </motion.button>
  );
};

export const BillingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAddPayment, setShowAddPayment] = useState(false);

  // Use custom billing hooks (only when user is authenticated)
  const {
    subscription,
    usage,
    invoices,
    plans,
    // warnings,
    paymentMethods,
    isLoading,
    hasError,
    refetchAll,
    queries,
  } = useBillingData(!!user);

  const downloadInvoice = useDownloadInvoice();
  const retryPayment = useRetryPayment();
  const removePaymentMethod = useRemovePaymentMethod();

  // Track which payment method is being deleted
  const [deletingPaymentMethodId, setDeletingPaymentMethodId] = useState<string | null>(null);

  // Reset deleting state when mutation completes
  React.useEffect(() => {
    if (!removePaymentMethod.isPending && deletingPaymentMethodId) {
      setDeletingPaymentMethodId(null);
    }
  }, [removePaymentMethod.isPending, deletingPaymentMethodId]);

  // Transform payment methods to display format
  const transformPaymentMethods = (methods: unknown[]): PaymentMethodDisplay[] => {
    return (
      methods?.map(method => {
        const m = method as {
          id: string;
          card?: { brand?: string; last4?: string; expMonth?: number; expYear?: number };
          isDefault?: boolean;
        };
        return {
          id: m.id,
          brand: (m.card?.brand as 'visa' | 'mastercard' | 'amex' | 'discover') || 'visa',
          last4: m.card?.last4 || '0000',
          expiryMonth: m.card?.expMonth || 12,
          expiryYear: m.card?.expYear || 2025,
          isDefault: m.isDefault || false,
        };
      }) || []
    );
  };

  const displayPaymentMethods = transformPaymentMethods(paymentMethods || []);

  // Handle different error types
  const getErrorComponent = () => {
    const err = queries.subscription.error as { response?: { status?: number } };
    if (err?.response?.status === 0) {
      return <NetworkErrorState onRetry={() => queries.subscription.refetch()} />;
    }
    if (err?.response?.status && err.response.status >= 500) {
      return <ServerErrorState onRetry={() => queries.subscription.refetch()} />;
    }
    return <SubscriptionLoadErrorState onRetry={refetchAll} />;
  };

  // Show loading skeleton while data is loading or if no user
  if (!user || (isLoading && !subscription && !usage && !invoices)) {
    return <BillingPageSkeleton />;
  }

  // Show error state if there's a critical error
  if (hasError && !subscription) {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h1 className="text-3xl font-bold">Billing & Subscription</h1>
            <p className="text-muted-foreground">
              Manage your subscription, payment methods, and billing history
            </p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-12">{getErrorComponent()}</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <h1 className="text-3xl font-bold">Billing & Subscription</h1>
              <p className="text-muted-foreground">
                Manage your subscription, payment methods, and billing history
              </p>
            </motion.div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-8"
          >
            {/* Subscription Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {queries.subscription.isLoading ? (
                <>
                  <PlanCardSkeleton />
                  <UsageCardSkeleton />
                </>
              ) : (
                <>
                  <PlanCard
                    subscription={subscription || null}
                    plans={plans || []}
                    usage={usage || null}
                  />
                  <UsageCard
                    usage={usage || null}
                    onRefresh={() => queries.usage.refetch()}
                    isRefreshing={queries.usage.isFetching}
                  />
                </>
              )}
            </div>

            {/* Payment Methods */}
            <motion.section variants={fadeInUp}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Payment Methods
                </h2>
                <ModernButton variant="secondary" size="sm" onClick={() => setShowAddPayment(true)}>
                  <Shield className="w-4 h-4" />
                  Secure Checkout
                </ModernButton>
              </div>

              {queries.paymentMethods.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <PaymentMethodCardSkeleton />
                  <PaymentMethodCardSkeleton />
                  <div className="h-full min-h-[180px] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-accent animate-pulse" />
                    <div className="w-32 h-4 bg-accent animate-pulse rounded" />
                  </div>
                </div>
              ) : displayPaymentMethods && displayPaymentMethods.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayPaymentMethods.map(method => (
                    <PaymentMethodCard
                      key={method.id}
                      method={method}
                      onSetDefault={() => toast.success('Set as default')}
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
                <NoPaymentMethodsState onAddPaymentMethod={() => setShowAddPayment(true)} />
              )}
            </motion.section>

            {/* Billing History */}
            <motion.section variants={fadeInUp}>
              {queries.invoices.isLoading ? (
                <BillingTableSkeleton />
              ) : queries.invoices.error ? (
                <div className="bg-card border border-border rounded-xl p-6">
                  <InlineErrorState
                    message="Failed to load billing history"
                    onRetry={() => queries.invoices.refetch()}
                    isRetrying={queries.invoices.isFetching}
                  />
                </div>
              ) : (
                <BillingHistoryTable
                  invoices={invoices || []}
                  onDownload={invoice =>
                    downloadInvoice.mutate({
                      invoiceId: invoice.id,
                      invoiceUrl: invoice.invoiceUrl,
                    })
                  }
                  onRetry={invoice => retryPayment.mutate({ invoiceId: invoice.id })}
                  isLoading={downloadInvoice.isPending || retryPayment.isPending}
                />
              )}
            </motion.section>

            {/* Quick Actions */}
            <motion.section variants={fadeInUp}>
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => toast.info('Download all invoices')}
                    className="flex items-center gap-3 p-4 bg-accent hover:bg-accent/80 rounded-lg transition-colors"
                  >
                    <FileText className="w-5 h-5 text-primary" />
                    <div className="text-left">
                      <div className="font-medium">Export Invoices</div>
                      <div className="text-sm text-muted-foreground">Download as CSV</div>
                    </div>
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </button>

                  <button
                    onClick={() => navigate('/settings/billing/tax')}
                    className="flex items-center gap-3 p-4 bg-accent hover:bg-accent/80 rounded-lg transition-colors"
                  >
                    <Shield className="w-5 h-5 text-primary" />
                    <div className="text-left">
                      <div className="font-medium">Tax Information</div>
                      <div className="text-sm text-muted-foreground">Update tax details</div>
                    </div>
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </button>

                  <button
                    onClick={() => navigate('/settings/billing/limits')}
                    className="flex items-center gap-3 p-4 bg-accent hover:bg-accent/80 rounded-lg transition-colors"
                  >
                    <AlertCircle className="w-5 h-5 text-primary" />
                    <div className="text-left">
                      <div className="font-medium">Usage Alerts</div>
                      <div className="text-sm text-muted-foreground">Configure notifications</div>
                    </div>
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </button>
                </div>
              </div>
            </motion.section>
          </motion.div>
        </div>
      </div>

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        isOpen={showAddPayment}
        onClose={() => setShowAddPayment(false)}
        onSuccess={() => {
          queries.paymentMethods.refetch();
          setShowAddPayment(false);
        }}
      />
    </>
  );
};
