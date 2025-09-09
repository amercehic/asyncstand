import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, Controller, ControllerRenderProps } from 'react-hook-form';
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
import { getCountriesWithPopularFirst } from '@/utils/countries';

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

interface Country {
  code: string;
  name: string;
  disabled?: boolean;
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
        lineHeight: '24px',
        '::placeholder': {
          color: '#9ca3af', // More muted placeholder color
          opacity: '0.7',
        },
      },
      empty: {
        color: '#9ca3af', // Muted color for empty state
        opacity: '0.7',
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
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [countries] = useState(() => getCountriesWithPopularFirst());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [hasCardInput, setHasCardInput] = useState(false);

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

  // Update selected country when form country changes
  React.useEffect(() => {
    setSelectedCountry(watchedFields.country);
  }, [watchedFields.country]);

  // Check if country uses states/provinces
  const countryUsesStates = ['US', 'CA', 'AU'].includes(selectedCountry);

  // Get appropriate labels for the selected country
  const getStateLabel = () => {
    switch (selectedCountry) {
      case 'US':
        return 'State';
      case 'CA':
        return 'Province';
      case 'AU':
        return 'State';
      default:
        return 'State/Province/Region';
    }
  };

  const getPostalCodeLabel = () => {
    switch (selectedCountry) {
      case 'US':
        return 'ZIP Code';
      case 'CA':
        return 'Postal Code';
      case 'GB':
        return 'Postcode';
      default:
        return 'Postal Code';
    }
  };

  const getPostalCodePlaceholder = () => {
    switch (selectedCountry) {
      case 'US':
        return '10001';
      case 'CA':
        return 'K1A 0A9';
      case 'GB':
        return 'SW1A 1AA';
      default:
        return 'Enter postal code';
    }
  };

  const getCityPlaceholder = () => {
    switch (selectedCountry) {
      case 'US':
        return 'New York';
      case 'CA':
        return 'Toronto';
      case 'GB':
        return 'London';
      case 'AU':
        return 'Sydney';
      case 'DE':
        return 'Berlin';
      case 'FR':
        return 'Paris';
      default:
        return 'Enter city';
    }
  };

  const getStatePlaceholder = () => {
    switch (selectedCountry) {
      case 'US':
        return 'NY';
      case 'CA':
        return 'ON';
      case 'AU':
        return 'NSW';
      default:
        return 'Enter state/region';
    }
  };

  // Check if form has any meaningful data that would be lost
  const hasFormData = () => {
    return (
      hasCardInput || // User has entered card number
      watchedFields.cardHolder ||
      watchedFields.addressLine1 ||
      watchedFields.addressLine2 ||
      watchedFields.city ||
      watchedFields.state ||
      watchedFields.postalCode ||
      (watchedFields.country && watchedFields.country !== 'US') ||
      currentStep > 1 // User has progressed beyond first step
    );
  };

  // Handle close with confirmation if needed
  const handleClose = () => {
    if (hasFormData() && !isSubmitting) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  // Confirm and close without saving
  const confirmClose = () => {
    setShowConfirmClose(false);
    onClose();
  };

  // Cancel the close confirmation
  const cancelClose = () => {
    setShowConfirmClose(false);
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset();
      setCurrentStep(1);
      setIsCardFlipped(false);
      setCardType('unknown');
      setErrorMessage(null);
      setShowConfirmClose(false);
      setHasCardInput(false);
      setCardDisplay({
        last4: '',
        brand: '',
        expMonth: '',
        expYear: '',
      });
    }
  }, [isOpen, reset]);

  // Handle Esc key and prevent body scroll
  useEffect(() => {
    if (!isOpen) return;

    // Prevent body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Handle Esc key
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEsc);

    return () => {
      // Restore body scroll - remove the style attribute entirely to reset to default
      if (originalOverflow) {
        document.body.style.overflow = originalOverflow;
      } else {
        document.body.style.removeProperty('overflow');
      }
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  const handleNext = () => {
    if (currentStep < steps.length) {
      setErrorMessage(null); // Clear errors when moving to next step
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setErrorMessage(null); // Clear errors when going back
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: PaymentFormData) => {
    if (currentStep < steps.length) {
      setErrorMessage(null); // Clear any previous errors
      handleNext();
      return;
    }

    if (!stripe || !elements) {
      setErrorMessage('Payment system is not ready. Please try again.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null); // Clear any previous errors
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
        setErrorMessage(
          error.message ||
            'There was an error with your card information. Please check and try again.'
        );
        return;
      }

      if (!paymentMethod) {
        setErrorMessage('Failed to create payment method. Please try again.');
        return;
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
      // Handle backend/network errors
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl mx-4 sm:mx-0 max-h-[90vh] bg-card rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Add Payment Method</h2>
              <button
                onClick={handleClose}
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
                        'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors touch-manipulation',
                        currentStep >= step.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-accent text-muted-foreground'
                      )}
                    >
                      {currentStep > step.id ? (
                        <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <step.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'ml-2 sm:ml-3 text-xs sm:text-sm font-medium hidden sm:inline',
                        currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {step.title}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2 sm:mx-4 transition-colors',
                        currentStep > step.id ? 'bg-primary' : 'bg-border'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Mobile step indicator */}
            <div className="block sm:hidden mt-3 text-center">
              <span className="text-sm font-medium text-muted-foreground">
                Step {currentStep} of {steps.length}: {steps[currentStep - 1]?.title}
              </span>
            </div>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Form Fields */}
                <div className="space-y-4">
                  {/* Hidden Stripe Elements - Keep mounted throughout entire process */}
                  <div className={cn('space-y-4', currentStep !== 1 && 'hidden')}>
                    <div>
                      <label className="block text-sm font-medium mb-2">Card Number</label>
                      <div className="w-full px-4 py-3 sm:py-2 bg-background border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary min-h-[44px] touch-manipulation flex items-center">
                        <div className="w-full">
                          <CardNumberElement
                            options={elementOptions}
                            onChange={event => {
                              // Track if user has started entering card info
                              setHasCardInput(!event.empty);

                              if (event.brand) {
                                setCardType(
                                  event.brand as
                                    | 'visa'
                                    | 'mastercard'
                                    | 'amex'
                                    | 'discover'
                                    | 'unknown'
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
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Cardholder Name</label>
                      <Controller
                        name="cardHolder"
                        control={control}
                        rules={{ required: 'Cardholder name is required' }}
                        render={({
                          field,
                        }: {
                          field: ControllerRenderProps<PaymentFormData, 'cardHolder'>;
                        }) => (
                          <input
                            {...field}
                            type="text"
                            placeholder="JOHN DOE"
                            className={cn(
                              'w-full px-4 py-3 sm:py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary uppercase min-h-[44px] touch-manipulation placeholder:text-muted-foreground placeholder:opacity-70',
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
                        <div className="w-full px-4 py-3 sm:py-2 bg-background border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary min-h-[44px] touch-manipulation flex items-center">
                          <div className="w-full">
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
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">CVV</label>
                        <div className="w-full px-4 py-3 sm:py-2 bg-background border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary min-h-[44px] touch-manipulation flex items-center">
                          <div className="w-full">
                            <CardCvcElement
                              options={elementOptions}
                              onFocus={() => setIsCardFlipped(true)}
                              onBlur={() => setIsCardFlipped(false)}
                            />
                          </div>
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
                          render={({
                            field,
                          }: {
                            field: ControllerRenderProps<PaymentFormData, 'addressLine1'>;
                          }) => (
                            <input
                              {...field}
                              type="text"
                              placeholder="123 Main St"
                              className={cn(
                                'w-full px-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground placeholder:opacity-70',
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
                          render={({
                            field,
                          }: {
                            field: ControllerRenderProps<PaymentFormData, 'addressLine2'>;
                          }) => (
                            <input
                              {...field}
                              type="text"
                              placeholder="Apt 4B"
                              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground placeholder:opacity-70"
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
                            render={({
                              field,
                            }: {
                              field: ControllerRenderProps<PaymentFormData, 'city'>;
                            }) => (
                              <input
                                {...field}
                                type="text"
                                placeholder={getCityPlaceholder()}
                                className={cn(
                                  'w-full px-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground placeholder:opacity-70',
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
                          <label className="block text-sm font-medium mb-2">
                            {getStateLabel()}
                          </label>
                          <Controller
                            name="state"
                            control={control}
                            rules={{
                              required: countryUsesStates
                                ? `${getStateLabel()} is required`
                                : false,
                            }}
                            render={({
                              field,
                            }: {
                              field: ControllerRenderProps<PaymentFormData, 'state'>;
                            }) => (
                              <input
                                {...field}
                                type="text"
                                placeholder={getStatePlaceholder()}
                                maxLength={countryUsesStates ? 10 : 50}
                                className={cn(
                                  'w-full px-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground placeholder:opacity-70',
                                  countryUsesStates ? 'uppercase' : '',
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
                          <label className="block text-sm font-medium mb-2">
                            {getPostalCodeLabel()}
                          </label>
                          <Controller
                            name="postalCode"
                            control={control}
                            rules={{ required: `${getPostalCodeLabel()} is required` }}
                            render={({
                              field,
                            }: {
                              field: ControllerRenderProps<PaymentFormData, 'postalCode'>;
                            }) => (
                              <input
                                {...field}
                                type="text"
                                placeholder={getPostalCodePlaceholder()}
                                maxLength={20}
                                className={cn(
                                  'w-full px-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground placeholder:opacity-70',
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
                            render={({
                              field,
                            }: {
                              field: ControllerRenderProps<PaymentFormData, 'country'>;
                            }) => (
                              <select
                                {...field}
                                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                {countries.map((country: Country) => (
                                  <option
                                    key={country.code}
                                    value={country.code}
                                    disabled={country.disabled}
                                    className={
                                      country.disabled ? 'text-muted-foreground font-bold' : ''
                                    }
                                  >
                                    {country.name}
                                  </option>
                                ))}
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
                            Your payment information is encrypted and secure. We never store your
                            full card details.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Controller
                          name="saveAsDefault"
                          control={control}
                          render={({
                            field: { onChange, value, ...field },
                          }: {
                            field: ControllerRenderProps<PaymentFormData, 'saveAsDefault'>;
                          }) => (
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
                <div className="order-first lg:order-last lg:sticky lg:top-6">
                  <div className="mx-auto max-w-sm lg:max-w-none">
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
                      <div className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                          <Lock className="w-4 h-4" />
                          <span>Your payment information is secure</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                          <AlertCircle className="w-4 h-4" />
                          <span>We accept all major credit cards</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="px-4 sm:px-6 pb-4">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive mb-1">Payment Error</p>
                    <p className="text-destructive/80">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="border-t border-border p-4 sm:p-6 bg-card">
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 sm:gap-0">
                <div>
                  {currentStep > 1 && (
                    <ModernButton
                      type="button"
                      variant="secondary"
                      onClick={handlePrevious}
                      disabled={isSubmitting || addPaymentMethodMutation.isPending}
                      className="w-full sm:w-auto min-h-[44px] touch-manipulation"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Previous
                    </ModernButton>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2 sm:gap-3">
                  <ModernButton
                    type="button"
                    variant="secondary"
                    onClick={handleClose}
                    disabled={isSubmitting || addPaymentMethodMutation.isPending}
                    className="w-full sm:w-auto min-h-[44px] touch-manipulation order-2 sm:order-1"
                  >
                    Cancel
                  </ModernButton>
                  <ModernButton
                    type="submit"
                    variant="primary"
                    isLoading={isSubmitting || addPaymentMethodMutation.isPending}
                    disabled={isSubmitting || addPaymentMethodMutation.isPending}
                    className="w-full sm:w-auto min-h-[44px] touch-manipulation order-1 sm:order-2"
                  >
                    {currentStep === steps.length ? (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
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
            </div>
          </form>
        </motion.div>

        {/* Confirmation Dialog */}
        {showConfirmClose && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card rounded-lg shadow-2xl p-6 max-w-md mx-4 border border-border"
            >
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-lg mb-2">Discard Changes?</h3>
                  <p className="text-muted-foreground text-sm">
                    You have unsaved payment information. Are you sure you want to close without
                    saving?
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <ModernButton
                  variant="secondary"
                  onClick={cancelClose}
                  className="min-h-[44px] touch-manipulation"
                >
                  Keep Editing
                </ModernButton>
                <ModernButton
                  variant="destructive"
                  onClick={confirmClose}
                  className="min-h-[44px] touch-manipulation"
                >
                  Discard & Close
                </ModernButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
};
