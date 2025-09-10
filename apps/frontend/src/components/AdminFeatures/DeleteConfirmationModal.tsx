import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, AlertTriangle, Shield, AlertCircle } from 'lucide-react';
import { ModernButton } from '@/components/ui';
import { featuresApi, type Feature } from '@/lib/api-client';
import { toast } from '@/components/ui';
import { useModal } from '@/contexts/ModalContext';

// Define available features locally to match backend constants
const FEATURES = {
  // Navigation Features (Base Platform Access)
  DASHBOARD: 'dashboard',
  TEAMS: 'teams',
  STANDUPS: 'standups',
  INTEGRATIONS: 'integrations',
  SETTINGS: 'settings',
  // Core Features
  BASIC_STANDUPS: 'basic_standups',
  // Platform Integrations
  SLACK_INTEGRATION: 'slack_integration',
  DISCORD_INTEGRATION: 'discord_integration',
  // Billing
  BILLING_PORTAL: 'billing_portal',
} as const;

const AVAILABLE_FEATURES = Object.values(FEATURES) as string[];

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFeatureDeleted: () => void;
  feature: Feature | null;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onFeatureDeleted,
  feature,
}) => {
  const { setModalOpen } = useModal();
  const [loading, setLoading] = useState(false);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !loading) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
    return undefined;
  }, [isOpen, loading]);

  // Track modal open/close state
  useEffect(() => {
    setModalOpen(isOpen);
  }, [isOpen, setModalOpen]);

  if (!feature) return null;

  const isFeatureInCode = AVAILABLE_FEATURES.includes(feature.key);

  const handleDelete = async () => {
    if (!feature || isFeatureInCode) return;

    setLoading(true);
    try {
      await featuresApi.deleteFeature(feature.key);
      toast.success('Feature deleted successfully');
      onFeatureDeleted();
      onClose();
    } catch (error: unknown) {
      console.error('Failed to delete feature:', error);

      // Handle different error types
      let errorMessage = 'Failed to delete feature';

      if (error && typeof error === 'object' && 'response' in error) {
        const response = error.response as {
          status?: number;
          data?: {
            title?: string;
            message?: string;
            response?: {
              message?: string | string[];
            };
          };
        };

        if (response?.status === 400 && response?.data?.response?.message) {
          // Handle validation errors from backend
          const messages = response.data.response.message;
          if (Array.isArray(messages)) {
            errorMessage = messages[0]; // Show first validation error
          } else if (typeof messages === 'string') {
            errorMessage = messages;
          }
        } else if (response?.data?.message) {
          // Handle other API errors
          errorMessage = String(response.data.message);
        } else if (response?.data?.title) {
          // Handle problem+json format
          errorMessage = String(response.data.title);
        }
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-card rounded-lg border border-border shadow-lg w-full max-w-md mx-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                {isFeatureInCode ? (
                  <div className="p-2 bg-amber-50 rounded-full border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                    <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                ) : (
                  <div className="p-2 bg-red-50 rounded-full border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                )}
                <h2 className="text-lg font-semibold text-foreground">
                  {isFeatureInCode ? 'Cannot Delete Feature' : 'Delete Feature'}
                </h2>
              </div>
              <ModernButton
                variant="ghost"
                onClick={handleClose}
                className="p-2"
                disabled={loading}
              >
                <X className="h-5 w-5" />
              </ModernButton>
            </div>

            {/* Content */}
            <div className="p-6">
              {isFeatureInCode ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm text-foreground">
                        <strong>{feature.name}</strong> ({feature.key}) cannot be deleted because it
                        is still defined in the code constants.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        To delete this feature, you must first remove it from the codebase feature
                        constants and deploy the changes.
                      </p>
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">
                      <strong>Protected features:</strong> {AVAILABLE_FEATURES.join(', ')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-foreground">
                        Are you sure you want to delete <strong>{feature.name}</strong> (
                        {feature.key})?
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        This action cannot be undone. All associated plan features and overrides
                        will also be removed.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 p-6 border-t border-border">
              <ModernButton type="button" variant="ghost" onClick={handleClose} disabled={loading}>
                {isFeatureInCode ? 'Close' : 'Cancel'}
              </ModernButton>
              {!isFeatureInCode && (
                <ModernButton
                  onClick={handleDelete}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {loading ? 'Deleting...' : 'Delete Feature'}
                </ModernButton>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
