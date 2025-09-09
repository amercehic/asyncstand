import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from '@stripe/react-stripe-js';
import { motion } from 'framer-motion';
import { CreditCard, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { ModernButton, toast } from '@/components/ui';
import { useBilling } from '@/contexts';
import type { BillingPlan } from '@/lib/api-client/billing';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface StripePaymentFormProps {
  plan: BillingPlan;
  onSuccess: () => void;
  onCancel: () => void;
}

export function StripePaymentForm({ plan, onSuccess, onCancel }: StripePaymentFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm plan={plan} onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}

function PaymentForm({ plan, onSuccess, onCancel }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { createSubscription, createSetupIntent } = useBilling();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState({
    number: false,
    expiry: false,
    cvc: false,
  });

  useEffect(() => {
    // Create setup intent for payment method
    const initializePayment = async () => {
      try {
        const secret = await createSetupIntent();
        setClientSecret(secret);
      } catch (error) {
        console.error('Failed to initialize payment:', error);
        setError('Failed to initialize payment. Please try again.');
      }
    };

    initializePayment();
  }, [createSetupIntent]);

  const cardStyle = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSmoothing: 'antialiased',
        '::placeholder': {
          color: '#9ca3af',
        },
      },
      invalid: {
        color: '#dc2626',
        iconColor: '#dc2626',
      },
    },
  };

  const handleCardChange =
    (type: 'number' | 'expiry' | 'cvc') =>
    (event: { complete: boolean; error?: { message: string } }) => {
      setError(null);
      setCardComplete(prev => ({
        ...prev,
        [type]: event.complete,
      }));

      if (event.error) {
        setError(event.error.message);
      }
    };

  const isFormComplete = Object.values(cardComplete).every(Boolean);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      setError('Payment system not ready. Please wait.');
      return;
    }

    if (!isFormComplete) {
      setError('Please fill in all card details.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const cardNumberElement = elements.getElement(CardNumberElement);

      if (!cardNumberElement) {
        throw new Error('Card element not found');
      }

      // Confirm the setup intent with payment method
      const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            name: 'Customer', // You might want to collect this from user
          },
        },
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment failed');
        return;
      }

      if (setupIntent.status === 'succeeded') {
        // Create subscription with the payment method
        await createSubscription({
          planId: plan.id,
          paymentMethodId: setupIntent.payment_method as string,
        });

        toast.success(`Successfully subscribed to ${plan.name}!`);
        onSuccess();
      } else {
        throw new Error('Payment setup failed');
      }
    } catch (error: unknown) {
      console.error('Payment error:', error);
      setError((error as Error).message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Plan Summary */}
      <div className="bg-background rounded-lg p-4 border border-border">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-foreground">{plan.name}</h4>
          <div className="text-right">
            <div className="text-xl font-bold text-foreground">
              €{(plan.price / 100).toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">per {plan.interval}</div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Perfect plan for your needs</p>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Payment Information
          </label>

          {/* Card Number */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Card Number
            </label>
            <div className="relative">
              <div className="w-full px-3 py-2 bg-background border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary">
                <CardNumberElement options={cardStyle} onChange={handleCardChange('number')} />
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Expiry and CVC */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Expiry Date
              </label>
              <div className="w-full px-3 py-2 bg-background border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary">
                <CardExpiryElement options={cardStyle} onChange={handleCardChange('expiry')} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">CVC</label>
              <div className="w-full px-3 py-2 bg-background border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary">
                <CardCvcElement options={cardStyle} onChange={handleCardChange('cvc')} />
              </div>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <Lock className="w-5 h-5 text-emerald-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Secure Payment
            </p>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Your payment information is encrypted and secured by Stripe.
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800"
          >
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Payment Error</p>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Form Actions */}
        <div className="flex gap-3 pt-4">
          <ModernButton
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1"
          >
            Cancel
          </ModernButton>
          <ModernButton
            type="submit"
            disabled={!stripe || isProcessing || !isFormComplete}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Subscribe Now
              </>
            )}
          </ModernButton>
        </div>

        {/* Terms */}
        <p className="text-xs text-muted-foreground text-center">
          By subscribing, you agree to our terms of service and privacy policy. You can cancel your
          subscription at any time.
        </p>
      </form>
    </div>
  );
}
