import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ModernButton, FormField } from '@/components/ui';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { X, Settings, Hash, Globe, Building2, Trash2, AlertTriangle } from 'lucide-react';
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
  timezone: string;
}

interface FormFieldError {
  [key: string]: string;
}

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Toronto', label: 'Toronto' },
  { value: 'America/Vancouver', label: 'Vancouver' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Europe/Rome', label: 'Rome' },
  { value: 'Europe/Madrid', label: 'Madrid' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam' },
  { value: 'Europe/Stockholm', label: 'Stockholm' },
  { value: 'Europe/Oslo', label: 'Oslo' },
  { value: 'Europe/Copenhagen', label: 'Copenhagen' },
  { value: 'Europe/Helsinki', label: 'Helsinki' },
  { value: 'Europe/Warsaw', label: 'Warsaw' },
  { value: 'Europe/Prague', label: 'Prague' },
  { value: 'Europe/Vienna', label: 'Vienna' },
  { value: 'Europe/Zurich', label: 'Zurich' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Seoul', label: 'Seoul' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Bangkok', label: 'Bangkok' },
  { value: 'Asia/Mumbai', label: 'Mumbai' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Jerusalem', label: 'Jerusalem' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'Australia/Melbourne', label: 'Melbourne' },
  { value: 'Australia/Perth', label: 'Perth' },
  { value: 'Pacific/Auckland', label: 'Auckland' },
];

export const TeamSettingsModal = React.memo<TeamSettingsModalProps>(
  ({ isOpen, onClose, onSuccess, team }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    const [formData, setFormData] = useState<TeamSettingsFormData>({
      name: team.name,
      description: team.description || '',
      timezone: 'UTC', // Default to UTC if no timezone info available
    });
    const [errors, setErrors] = useState<FormFieldError>({});

    // Update form data when team changes
    useEffect(() => {
      setFormData({
        name: team.name,
        description: team.description || '',
        timezone: 'UTC', // Default since team timezone isn't in the current Team interface
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

      if (!formData.timezone) {
        newErrors.timezone = 'Timezone is required';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }, [formData]);

    // Check if form is valid for button enabling
    const isFormValid = React.useMemo(() => {
      return (
        formData.name.trim().length >= 2 &&
        formData.name.trim().length <= 100 &&
        formData.description.length <= 500 &&
        formData.timezone
      );
    }, [formData]);

    // Check if form has changes
    const hasChanges = React.useMemo(() => {
      return (
        formData.name !== team.name ||
        formData.description !== (team.description || '') ||
        formData.timezone !== 'UTC' // Always show as changed since we don't know original timezone
      );
    }, [formData, team]);

    const handleClose = useCallback(() => {
      if (isUpdating || isDeleting) return;
      setFormData({
        name: team.name,
        description: team.description || '',
        timezone: 'UTC',
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
          if (formData.timezone !== 'UTC') {
            // Always include timezone for now
            updateData.timezone = formData.timezone;
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
        toast.success(`Team "${team.name}" has been deleted`);
        onSuccess(); // Refresh the teams list
        handleClose();
      } catch (error) {
        console.error('Error deleting team:', error);
        toast.error('Failed to delete team. Please try again.');
      } finally {
        setIsDeleting(false);
      }
    }, [deleteConfirmationText, team, onSuccess, handleClose]);

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
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-border">
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
                  disabled={isUpdating || isDeleting}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </ModernButton>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 overflow-y-auto flex-1">
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
                      onChange={e => handleInputChange('description', e.target.value)}
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

                  {/* Timezone */}
                  <div>
                    <Label
                      htmlFor="timezone"
                      className="flex items-center gap-2 text-sm font-medium mb-2"
                    >
                      <Globe className="w-4 h-4" />
                      Timezone
                    </Label>
                    <select
                      id="timezone"
                      value={formData.timezone}
                      onChange={e => handleInputChange('timezone', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
                      required
                      disabled={isUpdating}
                    >
                      {TIMEZONES.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {errors.timezone && (
                      <p className="text-sm text-red-600 mt-1">{errors.timezone}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Used for standup scheduling and notifications
                    </p>
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

                {/* Danger Zone */}
                <div className="mt-8 p-6 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
                      Danger Zone
                    </h3>
                  </div>

                  {!showDeleteConfirmation ? (
                    <div>
                      <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                        Once you delete a team, there is no going back. This will permanently delete
                        the team, all its standups, and remove all members.
                      </p>
                      <ModernButton
                        type="button"
                        variant="ghost"
                        onClick={() => setShowDeleteConfirmation(true)}
                        disabled={isUpdating || isDeleting}
                        className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Team
                      </ModernButton>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                        This action cannot be undone. Type{' '}
                        <span className="font-mono font-bold">{team.name}</span> to confirm
                        deletion.
                      </p>
                      <div className="space-y-4">
                        <input
                          type="text"
                          value={deleteConfirmationText}
                          onChange={e => setDeleteConfirmationText(e.target.value)}
                          placeholder={`Type "${team.name}" to confirm`}
                          className="w-full px-4 py-3 rounded-lg border border-red-300 bg-background focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          disabled={isDeleting}
                        />
                        <div className="flex gap-3">
                          <ModernButton
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setShowDeleteConfirmation(false);
                              setDeleteConfirmationText('');
                            }}
                            disabled={isDeleting}
                            className="flex-1"
                          >
                            Cancel
                          </ModernButton>
                          <ModernButton
                            type="button"
                            variant="ghost"
                            onClick={handleDeleteTeam}
                            disabled={isDeleting || deleteConfirmationText !== team.name}
                            className="flex-1 text-red-600 hover:text-white hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-red-600"
                          >
                            {isDeleting ? (
                              <>
                                <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin mr-2" />
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
                    </div>
                  )}
                </div>
              </div>

              {/* Actions - Fixed at bottom */}
              <div className="flex gap-3 p-6 pt-4 border-t border-border bg-background rounded-b-2xl">
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
