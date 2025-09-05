import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Check,
  Crown,
  Users,
  Calendar,
  Settings,
  Zap,
  Shield,
  Database,
  Sparkles,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ModernButton,
  toast,
  StripePaymentForm,
  DowngradeConfirmationModal,
} from '@/components/ui';
import { useBilling } from '@/contexts';
import type { BillingPlan } from '@/lib/api-client/billing';

interface BillingPageProps {
  className?: string;
}

export function BillingPage({ className = '' }: BillingPageProps) {
  const {
    subscription,
    currentUsage,
    isLoading: billingLoading,
    availablePlans,
    updateSubscription,
    cancelSubscription,
  } = useBilling();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [showPaymentFlow, setShowPaymentFlow] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [currentPlanDetails, setCurrentPlanDetails] = useState<BillingPlan | null>(null);
  const [expandedFeatures, setExpandedFeatures] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadPlans();
  }, [availablePlans, subscription]);

  const loadPlans = async () => {
    try {
      setIsLoading(true);

      // Sort available plans by price
      const sortedPlans = availablePlans.sort((a, b) => a.price - b.price);

      // Find current plan
      if (subscription?.planKey || subscription?.planId) {
        // Try to match by planKey first (new), then fall back to planId
        const current = sortedPlans.find(
          p => p.id === subscription.planKey || p.id === subscription.planId
        );
        setCurrentPlanDetails(current || null);
      } else {
        // Find free plan or create a default one
        const freePlan = sortedPlans.find(p => p.price === 0);
        setCurrentPlanDetails(freePlan || null);
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
      toast.error('Failed to load subscription plans');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return `€${(price / 100).toFixed(2)}`;
  };

  const formatLimit = (limit: number | null): string => {
    if (limit === null || limit === 0 || limit === -1) return 'Unlimited';
    return limit.toString();
  };

  const handleSelectPlan = (plan: BillingPlan) => {
    console.log('🎯 BillingPage: Plan selected', {
      selectedPlan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        key: (plan as BillingPlan & { key?: string }).key, // Type assertion to access key if it exists
      },
      currentPlan: currentPlanDetails
        ? {
            id: currentPlanDetails.id,
            name: currentPlanDetails.name,
            price: currentPlanDetails.price,
            key: (currentPlanDetails as BillingPlan & { key?: string }).key,
          }
        : null,
      currentSubscription: subscription
        ? {
            id: subscription.id,
            planId: subscription.planId,
            planKey: subscription.planKey,
            status: subscription.status,
          }
        : null,
      isUpgradeCheck: isUpgrade(plan),
    });

    if (currentPlanDetails?.id === plan.id) {
      console.log('⚠️ BillingPage: Selected same plan, ignoring');
      return;
    }
    setSelectedPlan(plan);

    // If it's a downgrade or plan change, show confirmation modal
    if (!isUpgrade(plan)) {
      console.log('⬇️ BillingPage: Showing downgrade confirmation modal');
      setShowDowngradeModal(true);
    } else {
      console.log('⬆️ BillingPage: Showing payment flow for upgrade');
      setShowPaymentFlow(true);
    }
  };

  const handleDowngradeConfirm = async () => {
    if (!selectedPlan) {
      console.log('❌ BillingPage: No selected plan for downgrade confirm');
      return;
    }

    console.log('🔄 BillingPage: Starting plan change confirmation', {
      selectedPlan: {
        id: selectedPlan.id,
        name: selectedPlan.name,
        price: selectedPlan.price,
        key: (selectedPlan as BillingPlan & { key?: string }).key,
      },
      isFree: selectedPlan.price === 0,
    });

    try {
      if (selectedPlan.price === 0) {
        console.log('🆓 BillingPage: Canceling subscription (downgrade to free)');
        // Free plan - cancel current subscription (downgrade to free)
        await cancelSubscription(false); // Cancel at period end
      } else {
        console.log('💰 BillingPage: Updating subscription to paid plan', {
          planId: selectedPlan.id,
        });
        // Paid plan - update subscription to new plan
        await updateSubscription({ planId: selectedPlan.id });
      }

      console.log('✅ BillingPage: Plan change successful');
      toast.success(`Successfully changed to ${selectedPlan.name}!`);
      setShowDowngradeModal(false);
      setSelectedPlan(null);
    } catch (error) {
      console.error('❌ BillingPage: Plan change failed', error);
      toast.error('Failed to change plan. Please try again.');
    }
  };

  const toggleFeatures = (planId: string) => {
    setExpandedFeatures(prev => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  const getUsagePercentage = (used: number, limit: number | null): number => {
    if (!limit || limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const getPlanIcon = (planName: string) => {
    const name = planName.toLowerCase();
    if (name.includes('free') || name.includes('starter')) {
      return <Users className="w-5 h-5" />;
    } else if (name.includes('pro') || name.includes('professional')) {
      return <Zap className="w-5 h-5" />;
    } else if (name.includes('team') || name.includes('business')) {
      return <Shield className="w-5 h-5" />;
    } else if (name.includes('enterprise')) {
      return <Crown className="w-5 h-5" />;
    } else {
      return <Sparkles className="w-5 h-5" />;
    }
  };

  const getPlanGradient = (planName: string): string => {
    const name = planName.toLowerCase();
    if (name.includes('free') || name.includes('starter')) {
      return 'from-slate-500 to-slate-600';
    } else if (name.includes('pro') || name.includes('professional')) {
      return 'from-blue-500 to-blue-600';
    } else if (name.includes('team') || name.includes('business')) {
      return 'from-purple-500 to-purple-600';
    } else if (name.includes('enterprise')) {
      return 'from-amber-500 to-amber-600';
    } else {
      return 'from-indigo-500 to-indigo-600';
    }
  };

  const isCurrentPlan = (plan: BillingPlan): boolean => {
    return currentPlanDetails?.id === plan.id;
  };

  const isUpgrade = (plan: BillingPlan): boolean => {
    if (!currentPlanDetails) return true;
    return plan.price > currentPlanDetails.price;
  };

  if (isLoading || billingLoading) {
    return (
      <div className={`flex items-center justify-center min-h-[60vh] ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Current Plan Overview */}
      {currentPlanDetails && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 bg-gradient-to-r ${getPlanGradient(currentPlanDetails.name)} rounded-xl`}
              >
                {getPlanIcon(currentPlanDetails.name)}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Current Plan</h2>
                <p className="text-muted-foreground">
                  You're on the{' '}
                  <span className="font-medium text-foreground">{currentPlanDetails.name}</span>
                </p>
                {subscription?.cancelAtPeriodEnd && (
                  <p className="text-sm text-warning mt-1 flex items-center gap-1">
                    <span>⚠️</span>
                    Cancels on{' '}
                    {subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'period end'}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-foreground">
                {currentPlanDetails.price === 0 ? 'Free' : formatPrice(currentPlanDetails.price)}
              </div>
              {currentPlanDetails.price > 0 && (
                <div className="text-sm text-muted-foreground">
                  per {currentPlanDetails.interval}
                </div>
              )}
            </div>
          </div>

          {/* Usage Overview */}
          {currentUsage && (
            <div className="space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Database className="w-4 h-4" />
                Current Usage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-background rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Teams</span>
                    <span className="text-sm font-semibold">
                      {currentUsage.teams?.used || 0} /{' '}
                      {formatLimit(currentPlanDetails.limits.teams)}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(getUsagePercentage(currentUsage.teams?.used || 0, currentPlanDetails.limits.teams))}`}
                      style={{
                        width: `${getUsagePercentage(currentUsage.teams?.used || 0, currentPlanDetails.limits.teams)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="bg-background rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Members</span>
                    <span className="text-sm font-semibold">
                      {currentUsage.members?.used || 0} /{' '}
                      {formatLimit(currentPlanDetails.limits.members)}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(getUsagePercentage(currentUsage.members?.used || 0, currentPlanDetails.limits.members))}`}
                      style={{
                        width: `${getUsagePercentage(currentUsage.members?.used || 0, currentPlanDetails.limits.members)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="bg-background rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Standups</span>
                    <span className="text-sm font-semibold">
                      {currentUsage.standupConfigs?.used || 0} /{' '}
                      {formatLimit(currentPlanDetails.limits.standupConfigs)}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(getUsagePercentage(currentUsage.standupConfigs?.used || 0, currentPlanDetails.limits.standupConfigs))}`}
                      style={{
                        width: `${getUsagePercentage(currentUsage.standupConfigs?.used || 0, currentPlanDetails.limits.standupConfigs)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="bg-background rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Monthly Standups
                    </span>
                    <span className="text-sm font-semibold">
                      {currentUsage.standupsThisMonth?.used || 0} /{' '}
                      {formatLimit(currentPlanDetails.limits.standupsPerMonth)}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(getUsagePercentage(currentUsage.standupsThisMonth?.used || 0, currentPlanDetails.limits.standupsPerMonth))}`}
                      style={{
                        width: `${getUsagePercentage(currentUsage.standupsThisMonth?.used || 0, currentPlanDetails.limits.standupsPerMonth)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Available Plans */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Choose Your Plan</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan for your team. Upgrade or downgrade at any time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availablePlans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-card rounded-2xl border transition-all duration-300 hover:shadow-lg ${
                isCurrentPlan(plan)
                  ? 'border-primary/50 shadow-lg ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              {isCurrentPlan(plan) && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="p-6">
                {/* Plan Header */}
                <div className="text-center mb-6">
                  <div
                    className={`w-16 h-16 mx-auto mb-4 bg-gradient-to-r ${getPlanGradient(plan.name)} rounded-2xl flex items-center justify-center text-white`}
                  >
                    {getPlanIcon(plan.name)}
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">Perfect for your needs</p>
                </div>

                {/* Pricing */}
                <div className="text-center mb-6">
                  <div className="text-3xl font-bold text-foreground">
                    {plan.price === 0 ? 'Free' : formatPrice(plan.price)}
                  </div>
                  {plan.price > 0 && (
                    <div className="text-sm text-muted-foreground">per {plan.interval}</div>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-sm">
                      <span className="font-medium">{formatLimit(plan.limits.teams)}</span> teams
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-sm">
                      <span className="font-medium">{formatLimit(plan.limits.members)}</span> team
                      members
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Settings className="w-4 h-4 text-primary" />
                    <span className="text-sm">
                      <span className="font-medium">{formatLimit(plan.limits.standupConfigs)}</span>{' '}
                      standup configs
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-sm">
                      <span className="font-medium">
                        {formatLimit(plan.limits.standupsPerMonth)}
                      </span>{' '}
                      standups/month
                    </span>
                  </div>

                  {/* Additional Features */}
                  {plan.features && plan.features.length > 0 && (
                    <>
                      <div className="pt-2">
                        <button
                          onClick={() => toggleFeatures(plan.id)}
                          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                        >
                          <span>
                            {expandedFeatures[plan.id] ? 'Hide' : 'Show'} additional features
                          </span>
                          {expandedFeatures[plan.id] ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <AnimatePresence>
                        {expandedFeatures[plan.id] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-2 overflow-hidden"
                          >
                            {plan.features.slice(0, 3).map((feature, idx) => (
                              <div key={idx} className="flex items-center gap-3">
                                <Check className="w-4 h-4 text-emerald-500" />
                                <span className="text-sm text-muted-foreground">{feature}</span>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>

                {/* Action Button */}
                <ModernButton
                  className="w-full"
                  variant={isCurrentPlan(plan) ? 'outline' : 'primary'}
                  disabled={isCurrentPlan(plan)}
                  onClick={() => handleSelectPlan(plan)}
                >
                  {isCurrentPlan(plan) ? (
                    'Current Plan'
                  ) : isUpgrade(plan) ? (
                    <>
                      Upgrade to {plan.name}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Switch to {plan.name}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </ModernButton>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Payment Flow Modal */}
      <AnimatePresence>
        {showPaymentFlow && selectedPlan && (
          <PaymentFlowModal
            plan={selectedPlan}
            onClose={() => {
              setShowPaymentFlow(false);
              setSelectedPlan(null);
            }}
            onSuccess={() => {
              setShowPaymentFlow(false);
              setSelectedPlan(null);
              loadPlans(); // Refresh plans
            }}
          />
        )}
      </AnimatePresence>

      {/* Downgrade Confirmation Modal */}
      {selectedPlan && currentPlanDetails && (
        <DowngradeConfirmationModal
          isOpen={showDowngradeModal}
          onClose={() => {
            setShowDowngradeModal(false);
            setSelectedPlan(null);
          }}
          currentPlan={currentPlanDetails}
          targetPlan={selectedPlan}
          currentUsage={currentUsage}
          onConfirm={handleDowngradeConfirm}
          isProcessing={isLoading}
        />
      )}
    </div>
  );
}

// Payment Flow Modal Component
interface PaymentFlowModalProps {
  plan: BillingPlan;
  onClose: () => void;
  onSuccess: () => void;
}

function PaymentFlowModal({ plan, onClose, onSuccess }: PaymentFlowModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'confirm' | 'payment' | 'processing'>('confirm');
  const { cancelSubscription } = useBilling();

  const handleProceed = () => {
    if (plan.price === 0) {
      // Free plan - no payment needed
      handleConfirmFreePlan();
    } else {
      setStep('payment');
    }
  };

  const handleConfirmFreePlan = async () => {
    try {
      setIsProcessing(true);
      setStep('processing');

      // For free plans, cancel the current subscription (downgrade to free)
      // instead of creating a new subscription
      await cancelSubscription(false); // Cancel at period end

      toast.success(`Successfully switched to ${plan.name} plan!`);
      onSuccess();
    } catch {
      toast.error('Failed to switch plan. Please try again.');
      setStep('confirm');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentSuccess = () => {
    onSuccess();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card rounded-2xl border border-border p-6 max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        {step === 'confirm' && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white">
                <CreditCard className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Switch to {plan.name}</h3>
              <p className="text-muted-foreground mt-2">
                {plan.price === 0
                  ? 'This is a free plan with no charges.'
                  : `You'll be charged $${(plan.price / 100).toFixed(2)} per ${plan.interval}.`}
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-background rounded-lg p-4">
                <h4 className="font-medium text-foreground mb-2">What you'll get:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• {plan.limits.teams || 'Unlimited'} teams</li>
                  <li>• {plan.limits.members || 'Unlimited'} team members</li>
                  <li>• {plan.limits.standupConfigs || 'Unlimited'} standup configurations</li>
                  <li>• {plan.limits.standupsPerMonth || 'Unlimited'} standups per month</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <ModernButton
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isProcessing}
              >
                Cancel
              </ModernButton>
              <ModernButton onClick={handleProceed} className="flex-1" disabled={isProcessing}>
                {plan.price === 0 ? 'Switch Plan' : 'Continue to Payment'}
              </ModernButton>
            </div>
          </>
        )}

        {step === 'payment' && (
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl flex items-center justify-center text-white">
                <CreditCard className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Payment Details</h3>
              <p className="text-muted-foreground mt-2">Secure payment powered by Stripe</p>
            </div>

            <StripePaymentForm
              plan={plan}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setStep('confirm')}
            />
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Processing...</h3>
            <p className="text-muted-foreground">Switching your plan, please wait.</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
