import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from '@stripe/react-stripe-js';
import {
  X,
  CreditCard,
  MapPin,
  Check,
  AlertCircle,
  Lock,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { ModernButton } from '@/components/ui';
import { InteractiveCreditCard } from '@/components/billing/InteractiveCreditCard';
import { cn } from '@/components/ui/utils';
import { useAddPaymentMethod } from '@/hooks/useBillingData';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface AddPaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PaymentFormData {
  cardHolder: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  saveAsDefault: boolean;
}

const steps = [
  { id: 1, title: 'Card Information', icon: CreditCard },
  { id: 2, title: 'Billing Address', icon: MapPin },
  { id: 3, title: 'Confirmation', icon: Check },
];

export const AddPaymentMethodModal: React.FC<AddPaymentMethodModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  return (
    <Elements stripe={stripePromise}>
      <AddPaymentMethodForm isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} />
    </Elements>
  );
};

const AddPaymentMethodForm: React.FC<AddPaymentMethodModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const stripe = useStripe();
  const elements = useElements();

  // Stripe Elements styling
  const elementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: 'hsl(var(--foreground))',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        '::placeholder': {
          color: 'hsl(var(--muted-foreground))',
        },
      },
      invalid: {
        color: 'hsl(var(--destructive))',
        iconColor: 'hsl(var(--destructive))',
      },
    },
  };
  const [currentStep, setCurrentStep] = useState(1);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardType, setCardType] = useState<'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown'>(
    'unknown'
  );
  const [cardDisplay, setCardDisplay] = useState({
    last4: '',
    brand: '',
    expMonth: '',
    expYear: '',
  });

  const addPaymentMethodMutation = useAddPaymentMethod();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<PaymentFormData>({
    defaultValues: {
      cardHolder: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
      saveAsDefault: false,
    },
  });

  // Watch form fields for card preview
  const watchedFields = watch();

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset();
      setCurrentStep(1);
      setIsCardFlipped(false);
      setCardType('unknown');
      setCardDisplay({
        last4: '',
        brand: '',
        expMonth: '',
        expYear: '',
      });
    }
  }, [isOpen, reset]);

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: PaymentFormData) => {
    if (currentStep < steps.length) {
      handleNext();
      return;
    }

    if (!stripe || !elements) {
      console.error('Stripe not loaded');
      return;
    }

    setIsSubmitting(true);
    try {
      const cardNumberElement = elements.getElement(CardNumberElement);
      const cardExpiryElement = elements.getElement(CardExpiryElement);
      const cardCvcElement = elements.getElement(CardCvcElement);

      if (!cardNumberElement || !cardExpiryElement || !cardCvcElement) {
        console.error('Missing Stripe elements:', {
          cardNumber: !!cardNumberElement,
          cardExpiry: !!cardExpiryElement,
          cardCvc: !!cardCvcElement,
        });
        throw new Error(
          'Card information is incomplete. Please go back to step 1 and re-enter your card details.'
        );
      }

      // Create payment method with Stripe
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardNumberElement,
        billing_details: {
          name: data.cardHolder,
          address: {
            line1: data.addressLine1,
            line2: data.addressLine2 || undefined,
            city: data.city,
            state: data.state,
            postal_code: data.postalCode,
            country: data.country,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!paymentMethod) {
        throw new Error('Failed to create payment method');
      }

      // Update card display with actual card info from Stripe
      if (paymentMethod.card) {
        setCardDisplay(prev => ({
          ...prev,
          last4: paymentMethod.card!.last4 || '',
          brand: paymentMethod.card!.brand || '',
          expMonth: paymentMethod.card!.exp_month?.toString().padStart(2, '0') || '',
          expYear: paymentMethod.card!.exp_year?.toString().slice(-2) || '',
        }));
      }

      // Send the real payment method ID to backend
      const paymentMethodData = {
        paymentMethodId: paymentMethod.id,
        setAsDefault: data.saveAsDefault,
      };

      await addPaymentMethodMutation.mutateAsync(paymentMethodData);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to add payment method:', error);
      // Error is already handled by the mutation hook
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl bg-card rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Add Payment Method</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-between">
              {steps.map((step, idx) => (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex items-center">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                        currentStep >= step.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-accent text-muted-foreground'
                      )}
                    >
                      {currentStep > step.id ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'ml-3 text-sm font-medium',
                        currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {step.title}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-4 transition-colors',
                        currentStep > step.id ? 'bg-primary' : 'bg-border'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit(onSubmit)} className="p-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Form Fields */}
              <div className="space-y-4">
                {/* Hidden Stripe Elements - Keep mounted throughout entire process */}
                <div className={cn('space-y-4', currentStep !== 1 && 'hidden')}>
                  <div>
                    <label className="block text-sm font-medium mb-2">Card Number</label>
                    <div className="w-full px-4 py-2 bg-background border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary">
                      <CardNumberElement
                        options={elementOptions}
                        onChange={event => {
                          if (event.brand) {
                            setCardType(
                              event.brand as 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown'
                            );
                          }
                          if (event.complete) {
                            setCardDisplay(prev => ({
                              ...prev,
                              brand: event.brand || '',
                            }));
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Cardholder Name</label>
                    <Controller
                      name="cardHolder"
                      control={control}
                      rules={{ required: 'Cardholder name is required' }}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="text"
                          placeholder="JOHN DOE"
                          className={cn(
                            'w-full px-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary uppercase',
                            errors.cardHolder ? 'border-destructive' : 'border-border'
                          )}
                        />
                      )}
                    />
                    {errors.cardHolder && (
                      <p className="text-destructive text-sm mt-1">{errors.cardHolder.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Expiry Date</label>
                      <div className="w-full px-4 py-2 bg-background border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary">
                        <CardExpiryElement
                          options={elementOptions}
                          onChange={event => {
                            // Stripe Elements don't expose the actual values for security
                            // We'll get the values from the payment method after creation
                            if (event.complete) {
                              setCardDisplay(prev => ({
                                ...prev,
                                expMonth: 'MM',
                                expYear: 'YY',
                              }));
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">CVV</label>
                      <div className="w-full px-4 py-2 bg-background border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary">
                        <CardCvcElement
                          options={elementOptions}
                          onFocus={() => setIsCardFlipped(true)}
                          onBlur={() => setIsCardFlipped(false)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {currentStep === 2 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Address Line 1</label>
                      <Controller
                        name="addressLine1"
                        control={control}
                        rules={{ required: 'Address is required' }}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="text"
                            placeholder="123 Main St"
                            className={cn(
                              'w-full px-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary',
                              errors.addressLine1 ? 'border-destructive' : 'border-border'
                            )}
                          />
                        )}
                      />
                      {errors.addressLine1 && (
                        <p className="text-destructive text-sm mt-1">
                          {errors.addressLine1.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Address Line 2 (Optional)
                      </label>
                      <Controller
                        name="addressLine2"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="text"
                            placeholder="Apt 4B"
                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">City</label>
                        <Controller
                          name="city"
                          control={control}
                          rules={{ required: 'City is required' }}
                          render={({ field }) => (
                            <input
                              {...field}
                              type="text"
                              placeholder="New York"
                              className={cn(
                                'w-full px-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary',
                                errors.city ? 'border-destructive' : 'border-border'
                              )}
                            />
                          )}
                        />
                        {errors.city && (
                          <p className="text-destructive text-sm mt-1">{errors.city.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">State</label>
                        <Controller
                          name="state"
                          control={control}
                          rules={{ required: 'State is required' }}
                          render={({ field }) => (
                            <input
                              {...field}
                              type="text"
                              placeholder="NY"
                              maxLength={2}
                              className={cn(
                                'w-full px-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary uppercase',
                                errors.state ? 'border-destructive' : 'border-border'
                              )}
                            />
                          )}
                        />
                        {errors.state && (
                          <p className="text-destructive text-sm mt-1">{errors.state.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">ZIP Code</label>
                        <Controller
                          name="postalCode"
                          control={control}
                          rules={{ required: 'ZIP code is required' }}
                          render={({ field }) => (
                            <input
                              {...field}
                              type="text"
                              placeholder="10001"
                              maxLength={10}
                              className={cn(
                                'w-full px-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary',
                                errors.postalCode ? 'border-destructive' : 'border-border'
                              )}
                            />
                          )}
                        />
                        {errors.postalCode && (
                          <p className="text-destructive text-sm mt-1">
                            {errors.postalCode.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Country</label>
                        <Controller
                          name="country"
                          control={control}
                          render={({ field }) => (
                            <select
                              {...field}
                              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="US">United States</option>
                              <option value="CA">Canada</option>
                              <option value="GB">United Kingdom</option>
                              <option value="AU">Australia</option>
                            </select>
                          )}
                        />
                      </div>
                    </div>
                  </>
                )}

                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div className="bg-accent/50 rounded-lg p-4 space-y-3">
                      <h4 className="font-medium">Payment Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Card</span>
                          <span>•••• {cardDisplay.last4 || '••••'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name</span>
                          <span>{watchedFields.cardHolder || 'Not entered'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Expires</span>
                          <span>
                            {cardDisplay.expMonth && cardDisplay.expYear
                              ? `${cardDisplay.expMonth}/${cardDisplay.expYear}`
                              : 'Not entered'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Billing Address</span>
                          <span className="text-right">
                            {watchedFields.addressLine1 || 'Not entered'}
                            {watchedFields.addressLine2 && `, ${watchedFields.addressLine2}`}
                            <br />
                            {watchedFields.city || 'Not entered'},{' '}
                            {watchedFields.state || 'Not entered'}{' '}
                            {watchedFields.postalCode || 'Not entered'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
                      <Lock className="w-5 h-5 text-primary mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium mb-1">Secure Payment</p>
                        <p className="text-muted-foreground">
                          Your payment information is encrypted and secure. We never store your full
                          card details.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Controller
                        name="saveAsDefault"
                        control={control}
                        render={({ field: { onChange, value, ...field } }) => (
                          <input
                            {...field}
                            type="checkbox"
                            id="saveAsDefault"
                            checked={value}
                            onChange={onChange}
                            className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2"
                          />
                        )}
                      />
                      <label htmlFor="saveAsDefault" className="text-sm">
                        Set as default payment method
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Preview */}
              <div className="lg:sticky lg:top-6">
                <InteractiveCreditCard
                  cardNumber={cardDisplay.last4 ? `•••• •••• •••• ${cardDisplay.last4}` : ''}
                  cardHolder={watchedFields.cardHolder || ''}
                  expiryMonth={cardDisplay.expMonth || ''}
                  expiryYear={cardDisplay.expYear || ''}
                  cvv={''}
                  isFlipped={isCardFlipped}
                  cardType={cardType}
                />

                {currentStep === 1 && (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock className="w-4 h-4" />
                      <span>Your payment information is secure</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="w-4 h-4" />
                      <span>We accept all major credit cards</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
              <div>
                {currentStep > 1 && (
                  <ModernButton
                    type="button"
                    variant="secondary"
                    onClick={handlePrevious}
                    disabled={isSubmitting || addPaymentMethodMutation.isPending}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Previous
                  </ModernButton>
                )}
              </div>

              <div className="flex gap-3">
                <ModernButton
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={isSubmitting || addPaymentMethodMutation.isPending}
                >
                  Cancel
                </ModernButton>
                <ModernButton
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting || addPaymentMethodMutation.isPending}
                  disabled={isSubmitting || addPaymentMethodMutation.isPending}
                >
                  {currentStep === steps.length ? (
                    <>
                      <Lock className="w-4 h-4" />
                      Add Payment Method
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </ModernButton>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
