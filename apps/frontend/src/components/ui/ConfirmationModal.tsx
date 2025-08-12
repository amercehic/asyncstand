import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { AlertTriangle, type LucideIcon } from 'lucide-react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  loadingText?: string;
  variant?: 'danger' | 'warning' | 'info';
  icon?: LucideIcon;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  loadingText = 'Loading...',
  variant = 'danger',
  icon: Icon = AlertTriangle,
}) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          confirmBg: 'bg-red-600 hover:bg-red-700',
        };
      case 'warning':
        return {
          iconBg: 'bg-yellow-100',
          iconColor: 'text-yellow-600',
          confirmBg: 'bg-yellow-600 hover:bg-yellow-700',
        };
      case 'info':
        return {
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          confirmBg: 'bg-blue-600 hover:bg-blue-700',
        };
      default:
        return {
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          confirmBg: 'bg-red-600 hover:bg-red-700',
        };
    }
  };

  const styles = getVariantStyles();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!isLoading ? onClose : undefined}
          className="fixed inset-0"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-background rounded-2xl shadow-2xl border border-border max-w-md w-full p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-10 h-10 ${styles.iconBg} rounded-lg flex items-center justify-center`}
            >
              <Icon className={`w-5 h-5 ${styles.iconColor}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">This action cannot be undone</p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm">{description}</p>
          </div>

          <div className="flex gap-3">
            <ModernButton
              variant="secondary"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
              size="sm"
            >
              {cancelText}
            </ModernButton>
            <ModernButton
              variant="primary"
              onClick={onConfirm}
              className={`flex-1 text-white ${styles.confirmBg}`}
              disabled={isLoading}
              size="sm"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                  {loadingText}
                </>
              ) : (
                confirmText
              )}
            </ModernButton>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
