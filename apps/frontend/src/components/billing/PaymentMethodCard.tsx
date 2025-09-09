import React, { useState, useEffect, useRef } from 'react';
import { MoreVertical, Trash2, Star, Shield, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/components/ui/utils';
import { Visa, Mastercard, Amex, Discover } from 'react-pay-icons';

interface PaymentMethodCardProps {
  method: {
    id: string;
    card: {
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    } | null;
    isDefault: boolean;
  };
  onSetDefault?: (id: string) => void;
  onRemove?: (id: string) => void;
  isLoading?: boolean;
  isDeleting?: boolean;
}

// Get card gradient based on brand
const getCardGradient = (brand: string) => {
  const gradients = {
    visa: 'from-slate-900 via-blue-900 to-slate-800',
    mastercard: 'from-slate-900 via-red-800 to-amber-800',
    amex: 'from-slate-900 via-emerald-800 to-slate-800',
    discover: 'from-slate-900 via-orange-700 to-slate-800',
    unknown: 'from-slate-900 via-slate-700 to-slate-800',
  };
  return gradients[brand.toLowerCase() as keyof typeof gradients] || gradients.unknown;
};

// Get card logo
const getCardLogo = (brand: string) => {
  const brandLower = brand.toLowerCase();

  const logos = {
    visa: <Visa className="h-8 w-auto" />,
    mastercard: <Mastercard className="h-8 w-auto" />,
    amex: <Amex className="h-8 w-auto" />,
    discover: <Discover className="h-8 w-auto" />,
  };

  return logos[brandLower as keyof typeof logos] || null;
};

export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
  method,
  onSetDefault,
  onRemove,
  isLoading = false,
  isDeleting = false,
}) => {
  const [showActions, setShowActions] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Close actions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setShowActions(false);
      }
    };

    if (showActions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {}; // Return cleanup function for when showActions is false
  }, [showActions]);

  if (!method.card) return null;

  const { brand, last4, expMonth, expYear } = method.card;

  return (
    <div ref={cardRef} className="relative group w-full max-w-md mx-auto h-60">
      <motion.div
        className={cn(
          'relative w-full h-full rounded-2xl p-6 shadow-xl cursor-pointer',
          'bg-gradient-to-br border border-white/20 overflow-hidden transition-all duration-300',
          getCardGradient(brand)
        )}
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
        onClick={() => setShowActions(!showActions)}
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

        {/* Default badge */}
        {method.isDefault && (
          <div className="absolute -top-2 -right-2 z-20">
            <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-amber-900 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg border border-yellow-300/50">
              <Star className="w-3 h-3 fill-current" />
              Default
            </div>
          </div>
        )}

        {/* Card content */}
        <div className="relative h-full flex flex-col text-white z-10">
          {/* Top row */}
          <div className="flex justify-between items-start mb-6">
            {/* Empty space for clean look */}
            <div></div>

            {/* Card logo */}
            <div className="opacity-90">{getCardLogo(brand)}</div>
          </div>

          {/* Card number - centered */}
          <div className="mb-8">
            <div className="font-mono text-xl tracking-[0.15em] font-medium text-center">
              •••• •••• •••• {last4}
            </div>
          </div>

          {/* Bottom row - cardholder and expiry */}
          <div className="flex justify-between items-end mt-auto">
            <div className="flex-1">
              <div className="text-xs text-white/60 font-medium uppercase tracking-widest mb-1">
                Card Holder
              </div>
              <div className="text-sm font-semibold uppercase tracking-wider truncate">
                CARDHOLDER
              </div>
            </div>

            <div className="text-right ml-4">
              <div className="text-xs text-white/60 font-medium uppercase tracking-widest mb-1">
                Valid Thru
              </div>
              <div className="text-sm font-semibold tracking-wider">
                {String(expMonth).padStart(2, '0')}/{String(expYear).slice(-2)}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile-friendly action overlay - shows on click/tap */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-[1px] rounded-2xl flex items-center justify-center z-20"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 10 }}
                transition={{ duration: 0.25, delay: 0.05 }}
                className="flex flex-col sm:flex-row items-center gap-3 px-4"
              >
                {/* Set as default button */}
                {!method.isDefault && onSetDefault && (
                  <motion.button
                    onClick={e => {
                      e.stopPropagation();
                      onSetDefault(method.id);
                      setShowActions(false);
                    }}
                    disabled={isLoading}
                    className="bg-white/20 hover:bg-white/30 active:bg-white/40 backdrop-blur-sm border border-white/30 text-white px-4 py-3 sm:py-2 rounded-xl w-full sm:w-auto text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 min-h-[44px] touch-manipulation"
                    whileTap={{ scale: 0.95 }}
                  >
                    <Star className="w-4 h-4" />
                    Set Default
                  </motion.button>
                )}

                {/* Delete button */}
                {onRemove && (
                  <motion.button
                    onClick={e => {
                      e.stopPropagation();
                      onRemove(method.id);
                      setShowActions(false);
                    }}
                    disabled={isLoading}
                    className="bg-red-500/90 hover:bg-red-500 active:bg-red-600 backdrop-blur-sm border border-red-400/50 text-white px-4 py-3 sm:py-2 rounded-xl w-full sm:w-auto text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 min-h-[44px] touch-manipulation"
                    whileTap={{ scale: 0.95 }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </motion.button>
                )}

                {/* Close button */}
                <motion.button
                  onClick={e => {
                    e.stopPropagation();
                    setShowActions(false);
                  }}
                  className="bg-gray-500/20 hover:bg-gray-500/30 active:bg-gray-500/40 backdrop-blur-sm border border-gray-400/30 text-white p-3 sm:p-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center min-h-[44px] min-w-[44px] touch-manipulation"
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop hover indicator - moved to top left to avoid logo overlap */}
        <div className="absolute top-4 left-4 opacity-50 sm:opacity-0 sm:group-hover:opacity-70 transition-opacity duration-200">
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-1.5">
            <MoreVertical className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Deletion loading overlay */}
        <AnimatePresence>
          {isDeleting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 bg-red-500/20 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-30 border border-red-400/30"
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
                  <div className="text-sm">Deleting payment method...</div>

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
                className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-red-600/20 rounded-2xl"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

// Add Payment Method Card (Placeholder)
export const AddPaymentMethodCard: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full max-w-md mx-auto h-60 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-colors group"
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
        <Shield className="w-6 h-6 text-primary" />
      </div>
      <div className="text-base font-medium text-muted-foreground group-hover:text-foreground">
        Add Payment Method
      </div>
      <div className="text-sm text-muted-foreground/70">Secure & encrypted</div>
    </button>
  );
};
