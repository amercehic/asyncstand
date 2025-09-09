import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, ModernButton } from '@/components/ui';
import { Textarea, Label } from '@/components/ui';
import { FormField } from '@/components/form';
import { X, Settings, Hash, Building2 } from 'lucide-react';
import { useTeams, useModal } from '@/contexts';
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
    const { updateTeam } = useTeams();
    const { setModalOpen } = useModal();
    const [isUpdating, setIsUpdating] = useState(false);
    const [formData, setFormData] = useState<TeamSettingsFormData>({
      name: team.name,
      description: team.description || '',
    });
    const [errors, setErrors] = useState<FormFieldError>({});

    // Update form data when team changes
    useEffect(() => {
      setFormData({
        name: team.name,
        description: team.description || '',
      });
    }, [team]);

    // Track modal open/close state
    useEffect(() => {
      setModalOpen(isOpen);
    }, [isOpen, setModalOpen]);

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
      if (isUpdating) return;
      setFormData({
        name: team.name,
        description: team.description || '',
      });
      setErrors({});
      onClose();
    }, [isUpdating, team, onClose]);

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

          await updateTeam(team.id, updateData);
          onSuccess();
          handleClose();
        } catch (error) {
          console.error('Error updating team:', error);
          // The context already shows error toasts
        } finally {
          setIsUpdating(false);
        }
      },
      [validateForm, formData, team, updateTeam, onSuccess, handleClose]
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

    // Add ESC key handler
    useEffect(() => {
      const handleEscKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && isOpen && !isUpdating) {
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
    }, [isOpen, isUpdating, handleClose]);

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
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
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
                </div>
              </div>

              {/* Actions - Fixed at bottom */}
              <div className="flex flex-col sm:flex-row gap-3 p-4 sm:p-6 pt-4 border-t border-border bg-background rounded-b-xl sm:rounded-b-2xl">
                <ModernButton
                  type="button"
                  variant="ghost"
                  onClick={handleClose}
                  disabled={isUpdating}
                  className="flex-1"
                >
                  Cancel
                </ModernButton>
                <ModernButton
                  type="submit"
                  variant="primary"
                  disabled={isUpdating || !isFormValid || !hasChanges}
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
