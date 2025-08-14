import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { CheckCircle2, ArrowRight, X } from 'lucide-react';
import { SlackIcon } from '@/components/icons/IntegrationIcons';

interface IntegrationSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigure?: () => void;
  integration: {
    name: string;
    type: 'slack' | 'teams' | 'discord';
    workspaceName?: string;
  };
}

export const IntegrationSuccessDialog: React.FC<IntegrationSuccessDialogProps> = ({
  isOpen,
  onClose,
  onConfigure,
  integration,
}) => {
  // Auto-close with countdown
  const [countdown, setCountdown] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef(false);

  // Stable close callback
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Update ref when isPaused changes
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    // Clear existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isOpen) {
      setCountdown(5);
      setIsPaused(false);
      isPausedRef.current = false;
      return;
    }

    // Reset countdown
    setCountdown(5);
    setIsPaused(false);
    isPausedRef.current = false;

    // Start countdown interval that closes when reaching 0
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        // Check if paused at the time of execution using ref
        if (isPausedRef.current) {
          return prev; // Return current value without decrementing
        }

        const newCount = prev - 1;
        if (newCount <= 0) {
          // Clear interval and close
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          handleClose();
          return 0;
        }
        return newCount;
      });
    }, 1000);

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOpen, handleClose]);

  const getIntegrationIcon = () => {
    switch (integration.type) {
      case 'slack':
        return <SlackIcon size={40} className="text-white" />;
      default:
        return <SlackIcon size={40} className="text-white" />;
    }
  };

  const getIntegrationColors = () => {
    switch (integration.type) {
      case 'slack':
        return {
          gradient: 'from-[#4A154B] to-[#350d36]',
          border: 'border-[#4A154B]/20',
          bg: 'bg-[#4A154B]/5',
        };
      default:
        return {
          gradient: 'from-primary to-primary/80',
          border: 'border-primary/20',
          bg: 'bg-primary/5',
        };
    }
  };

  const colors = getIntegrationColors();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-md mx-auto bg-background rounded-2xl shadow-2xl border border-border overflow-hidden"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-accent/50 transition-colors z-10"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Content */}
            <div className="p-8 text-center">
              {/* Success Animation */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="relative mb-6"
              >
                {/* Integration Icon with gradient background */}
                <div
                  className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center mx-auto mb-4 shadow-lg`}
                >
                  {getIntegrationIcon()}
                </div>

                {/* Success checkmark overlay */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                  className="absolute -bottom-1 -right-1 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg"
                >
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </motion.div>
              </motion.div>

              {/* Text Content */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {integration.name} Connected!
                </h2>
                <p className="text-muted-foreground mb-6">
                  {integration.workspaceName ? (
                    <>
                      Your <span className="font-medium">{integration.workspaceName}</span>{' '}
                      workspace is now connected to AsyncStand.
                    </>
                  ) : (
                    <>Your workspace is now connected to AsyncStand.</>
                  )}{' '}
                  Team members can start receiving standup notifications.
                </p>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col gap-3"
              >
                {onConfigure && (
                  <ModernButton
                    variant="primary"
                    size="lg"
                    onClick={onConfigure}
                    className={`w-full bg-gradient-to-r ${colors.gradient} hover:opacity-90 text-white border-0 group`}
                  >
                    Configure Integration
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                  </ModernButton>
                )}
                <ModernButton variant="ghost" size="lg" onClick={onClose} className="w-full">
                  Continue
                </ModernButton>
              </motion.div>

              {/* Auto-close countdown */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground/60"
              >
                <span>{isPaused ? 'Timer paused' : `Closing in ${countdown} seconds`}</span>
                <div className="w-3 h-3 relative">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 24 24">
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="opacity-20"
                    />
                    <motion.circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray="62.83" // 2π * 10
                      initial={{ strokeDashoffset: 0 }}
                      animate={{ strokeDashoffset: (countdown / 5) * 62.83 }}
                      transition={{ duration: 0.5, ease: 'linear' }}
                      className="text-primary/40"
                    />
                  </svg>
                </div>
              </motion.div>
            </div>

            {/* Decorative elements */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
            <div
              className={`absolute -top-20 -right-20 w-40 h-40 ${colors.bg} rounded-full blur-3xl opacity-20`}
            />
            <div
              className={`absolute -bottom-20 -left-20 w-40 h-40 ${colors.bg} rounded-full blur-3xl opacity-20`}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
