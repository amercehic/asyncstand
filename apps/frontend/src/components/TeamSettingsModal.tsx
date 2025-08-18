import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/components/ui';
import { ModernButton, FormField } from '@/components/ui';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { X, Settings, Hash, Building2, Trash2, AlertTriangle } from 'lucide-react';
import { teamsApi } from '@/lib/api';
import type { Team, UpdateTeamRequest } from '@/types';

interface TeamSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  team: Team;
}

interface TeamSettingsFormData {
  name: string;
  description: string;
}

interface FormFieldError {
  [key: string]: string;
}

export const TeamSettingsModal = React.memo<TeamSettingsModalProps>(
  ({ isOpen, onClose, onSuccess, team }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [formData, setFormData] = useState<TeamSettingsFormData>({
      name: team.name,
      description: team.description || '',
    });
    const [errors, setErrors] = useState<FormFieldError>({});
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Update form data when team changes
    useEffect(() => {
      setFormData({
        name: team.name,
        description: team.description || '',
      });
    }, [team]);

    // Prevent background scroll when modal is open
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

    const validateForm = useCallback((): boolean => {
      const newErrors: FormFieldError = {};

      if (!formData.name.trim()) {
        newErrors.name = 'Team name is required';
      } else if (formData.name.trim().length < 2) {
        newErrors.name = 'Team name must be at least 2 characters';
      } else if (formData.name.trim().length > 100) {
        newErrors.name = 'Team name cannot exceed 100 characters';
      }

      if (formData.description.length > 500) {
        newErrors.description = 'Description cannot exceed 500 characters';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }, [formData]);

    // Check if form is valid for button enabling
    const isFormValid = React.useMemo(() => {
      return (
        formData.name.trim().length >= 2 &&
        formData.name.trim().length <= 100 &&
        formData.description.length <= 500
      );
    }, [formData]);

    // Check if form has changes
    const hasChanges = React.useMemo(() => {
      return formData.name !== team.name || formData.description !== (team.description || '');
    }, [formData, team]);

    const handleClose = useCallback(() => {
      if (isUpdating || isDeleting) return;
      setFormData({
        name: team.name,
        description: team.description || '',
      });
      setErrors({});
      setShowDeleteConfirmation(false);
      setDeleteConfirmationText('');
      onClose();
    }, [isUpdating, isDeleting, team, onClose]);

    const handleSubmit = useCallback(
      async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
          toast.error('Please fix the errors in the form');
          return;
        }

        setIsUpdating(true);
        try {
          const updateData: UpdateTeamRequest = {};

          // Only include changed fields
          if (formData.name !== team.name) {
            updateData.name = formData.name.trim();
          }
          if (formData.description !== (team.description || '')) {
            updateData.description = formData.description.trim();
          }

          await teamsApi.updateTeam(team.id, updateData);
          toast.success('Team settings updated successfully');
          onSuccess();
          handleClose();
        } catch (error) {
          console.error('Error updating team:', error);
          toast.error('Failed to update team settings');
        } finally {
          setIsUpdating(false);
        }
      },
      [validateForm, formData, team, onSuccess, handleClose]
    );

    const handleInputChange = useCallback(
      (field: keyof TeamSettingsFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
          setErrors(prev => ({ ...prev, [field]: '' }));
        }
      },
      [errors]
    );

    const handleDeleteTeam = useCallback(async () => {
      if (deleteConfirmationText !== team.name) {
        toast.error('Please type the team name exactly to confirm deletion');
        return;
      }

      setIsDeleting(true);
      try {
        await teamsApi.deleteTeam(team.id);
        toast.success('Team deleted successfully!', {
          id: `delete-team-${team.id}`,
        });
        onSuccess();
        handleClose();
      } catch (error) {
        console.error('Error deleting team:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete team';
        toast.error(errorMessage, { id: `delete-team-${team.id}` });
      } finally {
        setIsDeleting(false);
      }
    }, [deleteConfirmationText, team.name, team.id, onSuccess, handleClose]);

    // Add ESC key handler
    useEffect(() => {
      const handleEscKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && isOpen && !isUpdating && !isDeleting) {
          handleClose();
        }
      };

      if (isOpen) {
        document.addEventListener('keydown', handleEscKey);
      }

      return () => {
        if (isOpen) {
          document.removeEventListener('keydown', handleEscKey);
        }
      };
    }, [isOpen, isUpdating, isDeleting, handleClose]);

    if (!isOpen) return null;

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-card rounded-xl sm:rounded-2xl border border-border shadow-2xl w-full max-w-[95vw] sm:max-w-lg max-h-[95vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Settings className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Team Settings</h2>
                    <p className="text-muted-foreground text-sm">Configure {team.name}</p>
                  </div>
                </div>
                <ModernButton
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  disabled={isUpdating}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </ModernButton>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <div className="space-y-6">
                  {/* Team Name */}
                  <div>
                    <Label
                      htmlFor="name"
                      className="flex items-center gap-2 text-sm font-medium mb-2"
                    >
                      <Building2 className="w-4 h-4" />
                      Team Name
                    </Label>
                    <FormField
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={e => handleInputChange('name', e.target.value)}
                      placeholder="Enter team name"
                      error={errors.name}
                      maxLength={100}
                      required
                      disabled={isUpdating}
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      {formData.name.length}/100 characters
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <Label htmlFor="description" className="text-sm font-medium mb-2 block">
                      Description (Optional)
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        handleInputChange('description', e.target.value)
                      }
                      placeholder="Describe your team's purpose and goals..."
                      className="min-h-[100px] px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-150 disabled:opacity-50"
                      maxLength={500}
                      disabled={isUpdating}
                    />
                    {errors.description && (
                      <p className="text-sm text-red-600 mt-1">{errors.description}</p>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {formData.description.length}/500 characters
                    </div>
                  </div>

                  {/* Channel Info (Read-only) */}
                  {team.channel && (
                    <div>
                      <Label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Hash className="w-4 h-4" />
                        Slack Channel
                      </Label>
                      <div className="px-4 py-3 bg-muted/50 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">#{team.channel.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Channel assignment cannot be changed from here
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Danger Zone */}
                  <div className="border-t border-border pt-6">
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                        Danger Zone
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                        Permanently delete this team and all associated data. This action cannot be
                        undone.
                      </p>

                      {!showDeleteConfirmation ? (
                        <ModernButton
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowDeleteConfirmation(true)}
                          disabled={isUpdating || isDeleting}
                          data-testid="show-delete-confirmation"
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Team
                        </ModernButton>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-start gap-3 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                Are you absolutely sure?
                              </p>
                              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                This action cannot be undone. This will permanently delete the team,
                                all standups, and remove all team members.
                              </p>
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-red-800 dark:text-red-200 mb-2 block">
                              Please type{' '}
                              <span className="font-mono bg-red-200 dark:bg-red-800 px-1 rounded">
                                {team.name}
                              </span>{' '}
                              to confirm:
                            </Label>
                            <FormField
                              id="delete-confirmation"
                              type="text"
                              value={deleteConfirmationText}
                              onChange={e => setDeleteConfirmationText(e.target.value)}
                              placeholder={`Type "${team.name}" to confirm`}
                              disabled={isDeleting}
                              className="mb-3"
                            />
                          </div>

                          <div className="flex gap-3">
                            <ModernButton
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setShowDeleteConfirmation(false);
                                setDeleteConfirmationText('');
                              }}
                              disabled={isDeleting}
                            >
                              Cancel
                            </ModernButton>
                            <ModernButton
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={handleDeleteTeam}
                              disabled={isDeleting || deleteConfirmationText !== team.name}
                              data-testid="confirm-delete-team"
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              {isDeleting ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Team
                                </>
                              )}
                            </ModernButton>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions - Fixed at bottom */}
              <div className="flex flex-col sm:flex-row gap-3 p-4 sm:p-6 pt-4 border-t border-border bg-background rounded-b-xl sm:rounded-b-2xl">
                <ModernButton
                  type="button"
                  variant="ghost"
                  onClick={handleClose}
                  disabled={isUpdating || isDeleting}
                  className="flex-1"
                >
                  Cancel
                </ModernButton>
                <ModernButton
                  type="submit"
                  variant="primary"
                  disabled={isUpdating || isDeleting || !isFormValid || !hasChanges}
                  className="flex-1"
                >
                  {isUpdating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </ModernButton>
              </div>
            </form>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }
);

TeamSettingsModal.displayName = 'TeamSettingsModal';
