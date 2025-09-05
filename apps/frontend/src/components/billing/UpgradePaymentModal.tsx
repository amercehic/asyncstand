import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CreditCard,
  Check,
  Plus,
  ArrowLeft,
  ArrowRight,
  Lock,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { ModernButton, toast } from '@/components/ui';
import { AddPaymentMethodModal } from '@/components/billing/AddPaymentMethodModal';
import { cn } from '@/components/ui/utils';
import {
  usePaymentMethods,
  useCreateSubscription,
  useUpdateSubscription,
  useBillingSubscription,
} from '@/hooks/useBillingData';
import type { BillingPlan } from '@/lib/api-client/billing';

interface UpgradePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedPlan: BillingPlan;
}

type Step = 'select-payment' | 'add-payment' | 'confirm';

export const UpgradePaymentModal: React.FC<UpgradePaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedPlan,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('select-payment');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);

  const { data: paymentMethods, refetch: refetchPaymentMethods } = usePaymentMethods();
  const { data: subscriptionData } = useBillingSubscription();
  const createSubscription = useCreateSubscription();
  const updateSubscription = useUpdateSubscription();

  // Check if user has existing subscription
  const hasActiveSubscription = !!subscriptionData?.subscription;
  const currentPlanKey = subscriptionData?.subscription?.planKey || subscriptionData?.plan;

  // Determine if this is an upgrade or downgrade
  const planHierarchy = [
    'free',
    'starter',
    'basic',
    'professional',
    'pro',
    'enterprise',
    'premium',
  ];
  const currentPlanIndex = planHierarchy.findIndex(p => currentPlanKey?.toLowerCase().includes(p));
  const targetPlanIndex = planHierarchy.findIndex(p => selectedPlan.name.toLowerCase().includes(p));

  const isDowngrade = hasActiveSubscription && currentPlanIndex > targetPlanIndex;
  const isChangingPlan = hasActiveSubscription; // Any change to existing subscription
  const periodEndDate = subscriptionData?.subscription?.currentPeriodEnd;

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      // Always start with payment selection step to allow users to choose/change payment method
      setCurrentStep('select-payment');
      setSelectedPaymentMethodId('');
      setShowAddPaymentModal(false);
    }
  }, [isOpen]);

  // Auto-select default payment method if available
  React.useEffect(() => {
    if (paymentMethods?.length) {
      const defaultMethod = paymentMethods.find(pm => pm.isDefault);
      if (defaultMethod) {
        setSelectedPaymentMethodId(defaultMethod.id);
      } else {
        setSelectedPaymentMethodId(paymentMethods[0].id);
      }
    }
  }, [paymentMethods]);

  const handleNext = () => {
    if (currentStep === 'select-payment') {
      if (!paymentMethods?.length) {
        setShowAddPaymentModal(true);
      } else if (selectedPaymentMethodId) {
        setCurrentStep('confirm');
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 'confirm') {
      setCurrentStep('select-payment');
    }
  };

  const handleAddPaymentSuccess = () => {
    setShowAddPaymentModal(false);
    refetchPaymentMethods();
    toast.success('Payment method added successfully!');
  };

  const handleUpgrade = async () => {
    if (!selectedPaymentMethodId && !isChangingPlan) {
      toast.error('Please select a payment method');
      return;
    }

    try {
      if (isChangingPlan) {
        // Update existing subscription (for both upgrades and downgrades)
        await updateSubscription.mutateAsync({
          planId: selectedPlan.id,
        });

        if (isDowngrade) {
          toast.success(
            `Your plan will change to ${selectedPlan.name} on ${periodEndDate ? format(new Date(periodEndDate), 'MMMM d, yyyy') : 'the next billing date'}. You'll continue using your current plan until then.`
          );
        } else {
          toast.success(`Successfully upgraded to ${selectedPlan.name}!`);
        }
      } else {
        await createSubscription.mutateAsync({
          planId: selectedPlan.id,
          paymentMethodId: selectedPaymentMethodId,
        });

        toast.success(`Successfully subscribed to ${selectedPlan.name}!`);
      }

      onSuccess();
      onClose();
    } catch {
      toast.error(`Failed to ${isChangingPlan ? 'change' : 'create'} plan. Please try again.`);
    }
  };

  const isLoading = createSubscription.isPending || updateSubscription.isPending;

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl max-h-[90vh] bg-background rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                {currentStep === 'confirm' && (
                  <button
                    onClick={handleBack}
                    className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h2 className="text-xl font-semibold">
                    {isChangingPlan
                      ? `${isDowngrade ? 'Downgrade' : 'Upgrade'} to ${selectedPlan.name}`
                      : `Subscribe to ${selectedPlan.name}`}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {currentStep === 'select-payment' && 'Choose your payment method'}
                    {currentStep === 'confirm' &&
                      `Review and confirm your ${isChangingPlan ? (isDowngrade ? 'downgrade' : 'upgrade') : 'subscription'}`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
              {currentStep === 'select-payment' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  {/* Plan Summary */}
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-primary">{selectedPlan.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Billed {selectedPlan.interval}ly
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          €{(selectedPlan.price / 100).toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          per {selectedPlan.interval}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Payment Method</h3>

                    {paymentMethods && paymentMethods.length > 0 ? (
                      <div className="space-y-3">
                        {paymentMethods.map(method => (
                          <motion.div
                            key={method.id}
                            className={cn(
                              'border rounded-xl p-4 cursor-pointer transition-all',
                              selectedPaymentMethodId === method.id
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            )}
                            onClick={() => setSelectedPaymentMethodId(method.id)}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className={cn(
                                  'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                                  selectedPaymentMethodId === method.id
                                    ? 'border-primary bg-primary'
                                    : 'border-muted-foreground'
                                )}
                              >
                                {selectedPaymentMethodId === method.id && (
                                  <Check className="w-3 h-3 text-primary-foreground" />
                                )}
                              </div>
                              <div className="flex items-center gap-3 flex-1">
                                <CreditCard className="w-8 h-8 text-muted-foreground" />
                                <div>
                                  <div className="font-medium">
                                    •••• •••• •••• {method.card?.last4}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {method.card?.brand?.toUpperCase()} • Expires{' '}
                                    {method.card?.expMonth?.toString().padStart(2, '0')}/
                                    {method.card?.expYear}
                                  </div>
                                </div>
                              </div>
                              {method.isDefault && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                  Default
                                </span>
                              )}
                            </div>
                          </motion.div>
                        ))}

                        {/* Add New Payment Method Option */}
                        <motion.div
                          className="border-2 border-dashed border-border hover:border-primary rounded-xl p-4 cursor-pointer transition-colors"
                          onClick={() => setShowAddPaymentModal(true)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <div className="flex items-center gap-4 text-muted-foreground">
                            <Plus className="w-5 h-5" />
                            <span>Add new payment method</span>
                          </div>
                        </motion.div>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                        <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <h4 className="font-medium mb-2">No payment methods found</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          Add a payment method to continue with your upgrade
                        </p>
                        <ModernButton
                          onClick={() => setShowAddPaymentModal(true)}
                          className="gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Payment Method
                        </ModernButton>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {currentStep === 'confirm' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  {/* Downgrade Notice */}
                  {isDowngrade && periodEndDate && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-amber-900 mb-1">
                            Important: Downgrade Information
                          </h4>
                          <p className="text-sm text-amber-800">
                            Your current plan will remain active until{' '}
                            <strong>{format(new Date(periodEndDate), 'MMMM d, yyyy')}</strong>. The
                            downgrade to {selectedPlan.name} will take effect on your next billing
                            cycle.
                          </p>
                          <p className="text-sm text-amber-800 mt-2">
                            You've already paid for your current billing period, so you'll continue
                            to enjoy all features of your current plan until then.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Order Summary */}
                  <div className="bg-card border border-border rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4">
                      {isDowngrade ? 'Plan Change Summary' : 'Order Summary'}
                    </h3>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{selectedPlan.name} Plan</div>
                          <div className="text-sm text-muted-foreground">
                            {isDowngrade ? (
                              <>
                                <Calendar className="w-3 h-3 inline mr-1" />
                                Starts{' '}
                                {periodEndDate
                                  ? format(new Date(periodEndDate), 'MMM d, yyyy')
                                  : 'next billing cycle'}
                              </>
                            ) : (
                              `Billed ${selectedPlan.interval}ly`
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            €{(selectedPlan.price / 100).toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            per {selectedPlan.interval}
                          </div>
                        </div>
                      </div>

                      <hr className="border-border" />

                      <div className="flex items-center justify-between font-semibold">
                        <span>{isDowngrade ? 'New Price (from next cycle)' : 'Total'}</span>
                        <span>€{(selectedPlan.price / 100).toFixed(2)}</span>
                      </div>

                      {isDowngrade && (
                        <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg">
                          <Check className="w-4 h-4 inline mr-1 text-green-600" />
                          No charges today - changes apply at the end of your current billing period
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Method Summary */}
                  {((selectedPaymentMethodId && paymentMethods) || isChangingPlan) && (
                    <div className="bg-card border border-border rounded-xl p-6">
                      <h3 className="text-lg font-semibold mb-4">Payment Method</h3>
                      {(() => {
                        if (isChangingPlan) {
                          // For upgrades, show existing subscription payment method
                          const defaultMethod = paymentMethods?.find(pm => pm.isDefault);
                          return defaultMethod ? (
                            <div>
                              <div className="flex items-center gap-3 mb-3">
                                <CreditCard className="w-8 h-8 text-muted-foreground" />
                                <div>
                                  <div className="font-medium">
                                    •••• •••• •••• {defaultMethod.card?.last4}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {defaultMethod.card?.brand?.toUpperCase()} • Expires{' '}
                                    {defaultMethod.card?.expMonth?.toString().padStart(2, '0')}/
                                    {defaultMethod.card?.expYear}
                                  </div>
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Your existing subscription payment method will be used.
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              Using existing subscription payment method.
                            </div>
                          );
                        } else {
                          // For new subscriptions, show selected payment method
                          const method = paymentMethods?.find(
                            pm => pm.id === selectedPaymentMethodId
                          );
                          return method ? (
                            <div className="flex items-center gap-3">
                              <CreditCard className="w-8 h-8 text-muted-foreground" />
                              <div>
                                <div className="font-medium">
                                  •••• •••• •••• {method.card?.last4}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {method.card?.brand?.toUpperCase()} • Expires{' '}
                                  {method.card?.expMonth?.toString().padStart(2, '0')}/
                                  {method.card?.expYear}
                                </div>
                              </div>
                            </div>
                          ) : null;
                        }
                      })()}
                    </div>
                  )}

                  {/* Security Notice */}
                  <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <Lock className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium text-green-800 mb-1">Secure Payment</div>
                      <div className="text-green-700">
                        Your payment information is encrypted and secure. You can cancel or change
                        your plan anytime.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-border bg-card">
              <div className="text-sm text-muted-foreground">
                {currentStep === 'select-payment' &&
                  (!paymentMethods || paymentMethods.length === 0) &&
                  'Add a payment method to continue'}
                {currentStep === 'select-payment' &&
                  paymentMethods &&
                  paymentMethods.length > 0 &&
                  `${paymentMethods.length} payment method${paymentMethods.length > 1 ? 's' : ''} available`}
                {currentStep === 'confirm' && 'Review your order and complete the upgrade'}
              </div>

              <div className="flex items-center gap-3">
                <ModernButton variant="ghost" onClick={onClose}>
                  Cancel
                </ModernButton>

                {currentStep === 'select-payment' && (
                  <ModernButton
                    onClick={handleNext}
                    disabled={!paymentMethods?.length || !selectedPaymentMethodId}
                    className="gap-2"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </ModernButton>
                )}

                {currentStep === 'confirm' && (
                  <ModernButton
                    onClick={handleUpgrade}
                    disabled={isLoading}
                    className="gap-2 min-w-[120px]"
                  >
                    {isLoading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <CreditCard className="w-4 h-4" />
                        </motion.div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        {isDowngrade ? 'Schedule Downgrade' : 'Upgrade Now'}
                      </>
                    )}
                  </ModernButton>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        isOpen={showAddPaymentModal}
        onClose={() => setShowAddPaymentModal(false)}
        onSuccess={handleAddPaymentSuccess}
      />
    </>
  );
};
