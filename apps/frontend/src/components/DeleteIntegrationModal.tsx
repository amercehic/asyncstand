import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts';
import type { SlackIntegration } from '@/lib/api';

interface DeleteIntegrationModalProps {
  integration: SlackIntegration | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (integrationId: string) => Promise<void>;
  isDeleting?: boolean;
}

export const DeleteIntegrationModal = React.memo(
  ({
    integration,
    isOpen,
    onClose,
    onConfirm,
  }: Omit<DeleteIntegrationModalProps, 'isDeleting'>) => {
    const { user } = useAuth();
    const [confirmationId, setConfirmationId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const canDelete = user?.role === 'owner';
    const confirmationText = integration?.externalTeamId || '';
    const isValidConfirmation = confirmationId === confirmationText;

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!integration || !canDelete || !isValidConfirmation || isSubmitting) {
        return;
      }

      try {
        setIsSubmitting(true);
        await onConfirm(integration.id);
        onClose();
        setConfirmationId('');
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleClose = () => {
      if (isSubmitting) return;
      setConfirmationId('');
      onClose();
    };

    if (!integration) return null;

    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={handleClose}
            >
              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="bg-card rounded-2xl border border-border max-w-md w-full mx-4 relative"
                onClick={e => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="absolute right-4 top-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Content */}
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Delete Integration</h2>
                      <p className="text-muted-foreground text-sm">This action cannot be undone</p>
                    </div>
                  </div>

                  {/* Permission Check */}
                  {!canDelete ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            Insufficient Permissions
                          </p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                            Only organization owners can delete integrations.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Warning */}
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                        <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">
                          This will permanently delete:
                        </p>
                        <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                          <li>• The Slack workspace integration "{integration.externalTeamId}"</li>
                          <li>• All associated teams and their configurations</li>
                          <li>• All standup schedules and responses</li>
                          <li>• All sync history and channel mappings</li>
                        </ul>
                      </div>

                      {/* Form */}
                      <form onSubmit={handleSubmit}>
                        <div className="mb-6">
                          <label className="block text-sm font-medium mb-2">
                            Enter the workspace ID to confirm deletion:
                          </label>
                          <p className="text-xs text-muted-foreground mb-3">
                            Workspace ID:{' '}
                            <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                              {confirmationText}
                            </code>
                          </p>
                          <input
                            type="text"
                            value={confirmationId}
                            onChange={e => setConfirmationId(e.target.value)}
                            placeholder="Enter workspace ID"
                            className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            disabled={isSubmitting}
                            autoComplete="off"
                            spellCheck={false}
                          />
                          {confirmationId && !isValidConfirmation && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                              Workspace ID does not match
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                          <ModernButton
                            type="button"
                            variant="secondary"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1"
                          >
                            Cancel
                          </ModernButton>
                          <ModernButton
                            type="submit"
                            variant="primary"
                            disabled={!isValidConfirmation || isSubmitting}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
                          >
                            {isSubmitting ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Integration
                              </>
                            )}
                          </ModernButton>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }
);

DeleteIntegrationModal.displayName = 'DeleteIntegrationModal';
