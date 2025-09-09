import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/components/ui/utils';
import { Visa, Mastercard, Amex, Discover } from 'react-pay-icons';

interface InteractiveCreditCardProps {
  cardNumber: string;
  cardHolder: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  isFlipped: boolean;
  cardType: 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';
}

// Card type detection
export const detectCardType = (number: string): InteractiveCreditCardProps['cardType'] => {
  if (!number || typeof number !== 'string') return 'unknown';

  const cleanNumber = number.replace(/\s/g, '');

  if (/^4/.test(cleanNumber)) return 'visa';
  if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) return 'mastercard';
  if (/^3[47]/.test(cleanNumber)) return 'amex';
  if (/^6011|^65/.test(cleanNumber)) return 'discover';

  return 'unknown';
};

// Format card number with spaces
export const formatCardNumber = (value: string, cardType: string): string => {
  const cleaned = value.replace(/\s+/g, '');
  const isAmex = cardType === 'amex';

  if (isAmex) {
    // Amex format: 4-6-5
    const match = cleaned.match(/(\d{1,4})(\d{1,6})?(\d{1,5})?/);
    if (!match) return cleaned;
    return [match[1], match[2], match[3]].filter(Boolean).join(' ');
  } else {
    // Other cards: 4-4-4-4
    const match = cleaned.match(/(\d{1,4})(\d{1,4})?(\d{1,4})?(\d{1,4})?/);
    if (!match) return cleaned;
    return [match[1], match[2], match[3], match[4]].filter(Boolean).join(' ');
  }
};

// Get card gradient based on type
const getCardGradient = (cardType: string) => {
  const gradients = {
    visa: 'from-slate-900 via-blue-900 to-slate-800',
    mastercard: 'from-slate-900 via-red-800 to-amber-800',
    amex: 'from-slate-900 via-emerald-800 to-slate-800',
    discover: 'from-slate-900 via-orange-700 to-slate-800',
    unknown: 'from-slate-900 via-slate-700 to-slate-800',
  };
  return gradients[cardType as keyof typeof gradients] || gradients.unknown;
};

// Get card logo
const getCardLogo = (cardType: string) => {
  const logos = {
    visa: <Visa className="h-8 w-auto" />,
    mastercard: <Mastercard className="h-8 w-auto" />,
    amex: <Amex className="h-8 w-auto" />,
    discover: <Discover className="h-8 w-auto" />,
    unknown: null,
  };
  return logos[cardType as keyof typeof logos];
};

export const InteractiveCreditCard: React.FC<InteractiveCreditCardProps> = ({
  cardNumber,
  cardHolder,
  expiryMonth,
  expiryYear,
  cvv,
  isFlipped,
  cardType,
}) => {
  // const [displayNumber, setDisplayNumber] = useState('');
  const [animatedDigits, setAnimatedDigits] = useState<string[]>([]);

  // Animate card number typing
  useEffect(() => {
    if (!cardNumber) {
      setAnimatedDigits([]);
      return;
    }

    const formatted = formatCardNumber(cardNumber, cardType);
    const digits = formatted.split('');

    // Clear existing digits first
    setAnimatedDigits([]);

    // Add digits with delay
    digits.forEach((digit, index) => {
      setTimeout(() => {
        setAnimatedDigits(prev => {
          const newDigits = [...prev];
          newDigits[index] = digit;
          return newDigits.slice(0, index + 1);
        });
      }, index * 50);
    });
  }, [cardNumber, cardType]);

  // Format display number with hidden digits
  // const getDisplayNumber = () => {
  //   if (!cardNumber) return '•••• •••• •••• ••••';

  //   const formatted = formatCardNumber(cardNumber, cardType);
  //   const parts = formatted.split(' ');

  //   if (parts.length <= 1) return formatted;

  //   // Show only last group
  //   return parts
  //     .map((part, idx) => {
  //       if (idx === parts.length - 1) return part;
  //       return part
  //         .split('')
  //         .map(() => '•')
  //         .join('');
  //     })
  //     .join(' ');
  // };

  return (
    <div className="relative w-full max-w-md mx-auto h-60 perspective-1000">
      <motion.div
        className="relative w-full h-full transition-transform duration-700 transform-style-preserve-3d"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
      >
        {/* Front of card */}
        <div
          className={cn(
            'absolute inset-0 w-full h-full rounded-2xl p-6 backface-hidden',
            'bg-gradient-to-br shadow-xl border border-white/20',
            'overflow-hidden',
            getCardGradient(cardType)
          )}
        >
          {/* Bank card texture */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10" />

          {/* Subtle pattern */}
          <div className="absolute inset-0 opacity-[0.02]">
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `radial-gradient(circle at 25% 25%, white 1px, transparent 1px)`,
                backgroundSize: '24px 24px',
              }}
            />
          </div>

          {/* Card content */}
          <div className="relative h-full flex flex-col text-white z-10">
            {/* Top row */}
            <div className="flex justify-between items-start mb-6">
              {/* Empty space for clean look */}
              <div></div>

              {/* Card logo */}
              <div className="opacity-90">{getCardLogo(cardType)}</div>
            </div>

            {/* Card number - centered */}
            <div className="mb-8">
              <div className="font-mono text-xl tracking-[0.15em] font-medium text-center">
                {animatedDigits.length > 0 ? (
                  animatedDigits.map((digit, idx) => (
                    <motion.span
                      key={idx}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.05 }}
                    >
                      {digit}
                    </motion.span>
                  ))
                ) : (
                  <span className="text-white/50">•••• •••• •••• ••••</span>
                )}
              </div>
            </div>

            {/* Bottom row - cardholder and expiry */}
            <div className="flex justify-between items-end mt-auto">
              <div className="flex-1">
                <div className="text-xs text-white/60 font-medium uppercase tracking-widest mb-1">
                  Card Holder
                </div>
                <div className="text-sm font-semibold uppercase tracking-wider truncate">
                  {cardHolder || 'YOUR NAME'}
                </div>
              </div>

              <div className="text-right ml-4">
                <div className="text-xs text-white/60 font-medium uppercase tracking-widest mb-1">
                  Valid Thru
                </div>
                <div className="text-sm font-semibold tracking-wider">
                  {expiryMonth || 'MM'}/{expiryYear || 'YY'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Back of card */}
        <div
          className={cn(
            'absolute inset-0 w-full h-full rounded-2xl backface-hidden rotate-y-180',
            'bg-gradient-to-br shadow-xl border border-white/20',
            'overflow-hidden',
            getCardGradient(cardType)
          )}
        >
          {/* Bank card texture */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10" />

          {/* Magnetic stripe */}
          <div className="w-full h-12 bg-gradient-to-r from-black via-gray-800 to-black mt-4 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-black/50" />
          </div>

          <div className="p-6 space-y-4 mt-2">
            {/* Signature strip */}
            <div className="bg-gray-100 h-10 rounded flex items-center justify-end px-3 shadow-inner border border-gray-300">
              <div className="font-mono text-black text-base font-bold tracking-wide">
                {cvv || '•••'}
              </div>
            </div>

            {/* Card info */}
            <div className="text-[10px] text-white/70 space-y-1 leading-tight">
              <p>This card is property of the issuing bank.</p>
              <p>If found, please return to any branch.</p>
              <p className="mt-2">Customer Service: 1-800-XXX-XXXX</p>
            </div>

            {/* Security hologram */}
            <div className="absolute bottom-6 right-6">
              <div className="w-12 h-8 border border-white/30 rounded bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center">
                <span className="text-white/60 text-[8px] font-bold">SECURE</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Custom styles for card animations */}
      <style>
        {`
          .perspective-1000 {
            perspective: 1000px;
          }
          .transform-style-preserve-3d {
            transform-style: preserve-3d;
          }
          .backface-hidden {
            backface-visibility: hidden;
          }
          .rotate-y-180 {
            transform: rotateY(180deg);
          }
        `}
      </style>
    </div>
  );
};
