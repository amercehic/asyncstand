import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, ModernButton } from '@/components/ui';
import { Textarea, Label } from '@/components/ui';
import { FormField } from '@/components/form';
import { X, Building2, Globe, Clock } from 'lucide-react';
import { integrationsApi } from '@/lib/api';
import { useTeams, useModal } from '@/contexts';
import type { CreateTeamRequest, Team } from '@/types';

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (teamName?: string, team?: Team) => void;
}

interface CreateTeamFormData {
  name: string;
  description: string;
  integrationId: string;
  timezone: string;
}

interface FormFieldError {
  [key: string]: string;
}

const SUPPORTED_TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
] as const;

export const CreateTeamModal = React.memo<CreateTeamModalProps>(
  ({ isOpen, onClose, onSuccess }) => {
    const { createTeam, isCreating } = useTeams();
    const { setModalOpen } = useModal();
    const [formData, setFormData] = useState<CreateTeamFormData>({
      name: '',
      description: '',
      integrationId: '',
      timezone: 'America/New_York', // Default timezone
    });
    const [errors, setErrors] = useState<FormFieldError>({});
    const [availableIntegrations, setAvailableIntegrations] = useState<
      Array<{ id: string; teamName: string; isActive: boolean; platform: string }>
    >([]);
    const [dataLoaded, setDataLoaded] = useState(false);

    const loadFormData = useCallback(async () => {
      if (dataLoaded || !isOpen) return;

      try {
        const integrationsResponse = await integrationsApi.getSlackIntegrationsForTeamCreation();
        setAvailableIntegrations(integrationsResponse);
        setDataLoaded(true);
      } catch (error) {
        console.error('Error loading form data:', error);
        toast.error('Failed to load team creation data', { id: 'load-team-data' });
      }
    }, [isOpen, dataLoaded]);

    React.useEffect(() => {
      if (isOpen) {
        loadFormData();
      }
    }, [isOpen, loadFormData]);

    // Prevent background scroll when modal is open
    React.useEffect(() => {
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

    // Track modal open/close state
    useEffect(() => {
      setModalOpen(isOpen);
    }, [isOpen, setModalOpen]);

    const validateForm = useCallback((): boolean => {
      const newErrors: FormFieldError = {};

      if (!formData.name.trim()) {
        newErrors.name = 'Team name is required';
      } else if (formData.name.trim().length < 2) {
        newErrors.name = 'Team name must be at least 2 characters';
      }

      if (!formData.integrationId) {
        newErrors.integrationId = 'Integration is required';
      }

      if (!formData.timezone) {
        newErrors.timezone = 'Timezone is required';
      }

      // Channel is now optional since teams are not tied to channels

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }, [formData]);

    // Check if form is valid for button enabling
    const isFormValid = React.useMemo(() => {
      return formData.name.trim().length >= 2 && formData.integrationId && formData.timezone;
    }, [formData]);

    const handleClose = useCallback(() => {
      if (isCreating) return;
      setFormData({
        name: '',
        description: '',
        integrationId: '',
        timezone: 'America/New_York',
      });
      setErrors({});
      setDataLoaded(false);
      onClose();
    }, [isCreating, onClose]);

    const handleSubmit = useCallback(
      async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
          toast.error('Please fix the errors below', { id: 'form-validation' });
          return;
        }

        try {
          const createTeamData: CreateTeamRequest = {
            name: formData.name.trim(),
            integrationId: formData.integrationId,
            timezone: formData.timezone,
            description: formData.description.trim() || undefined,
          };

          const newTeam = await createTeam(createTeamData);
          onSuccess(newTeam.name, newTeam);
          handleClose();
        } catch (error) {
          // Error handling is done in the context
          console.error('Failed to create team:', error);
        }
      },
      [validateForm, formData, createTeam, onSuccess, handleClose]
    );

    const handleInputChange = useCallback(
      (field: keyof CreateTeamFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
          setErrors(prev => ({ ...prev, [field]: '' }));
        }
      },
      [errors]
    );

    // Add ESC key handler
    React.useEffect(() => {
      const handleEscKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && isOpen && !isCreating) {
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
    }, [isOpen, isCreating, handleClose]);

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
            className="bg-card rounded-xl sm:rounded-2xl border border-border w-full max-w-[95vw] sm:max-w-md max-h-[95vh] overflow-auto shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-primary to-primary/80 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Create Team</h2>
                  <p className="text-sm text-muted-foreground">
                    Set up a new team for async standups
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={isCreating}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
                data-testid="close-modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Team Name */}
              <FormField
                label="Team Name"
                id="name"
                placeholder="Engineering Team"
                value={formData.name}
                onChange={e => handleInputChange('name', e.target.value)}
                error={errors.name}
                required
                data-testid="team-name-input"
              />

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of your team's purpose..."
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    handleInputChange('description', e.target.value)
                  }
                  className="min-h-20 resize-none border-border"
                  data-testid="team-description-input"
                />
                {errors.description && (
                  <p className="text-sm text-destructive">{errors.description}</p>
                )}
              </div>

              {/* Slack Integration */}
              <div className="space-y-2">
                <Label htmlFor="integrationId">
                  <Globe className="w-4 h-4 inline mr-2" />
                  Integration Workspace
                </Label>
                <select
                  id="integrationId"
                  value={formData.integrationId}
                  onChange={e => handleInputChange('integrationId', e.target.value)}
                  className="w-full h-12 px-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                  data-testid="integration-select"
                  disabled={isCreating || (!availableIntegrations.length && dataLoaded)}
                >
                  <option value="">Select workspace...</option>
                  {availableIntegrations.map(integration => (
                    <option key={integration.id} value={integration.id}>
                      {integration.platform}: {integration.teamName}
                    </option>
                  ))}
                </select>
                {dataLoaded && availableIntegrations.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No workspaces connected yet. Connect your Slack workspace first to create a
                    team.
                  </p>
                )}
                {errors.integrationId && (
                  <p className="text-sm text-destructive">{errors.integrationId}</p>
                )}
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <Label htmlFor="timezone">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Timezone
                </Label>
                <select
                  id="timezone"
                  value={formData.timezone}
                  onChange={e => handleInputChange('timezone', e.target.value)}
                  className="w-full h-12 px-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                  data-testid="timezone-select"
                  disabled={isCreating}
                >
                  {SUPPORTED_TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  This timezone will be used for standup scheduling.
                </p>
                {errors.timezone && <p className="text-sm text-destructive">{errors.timezone}</p>}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <ModernButton
                  type="button"
                  variant="secondary"
                  onClick={handleClose}
                  disabled={isCreating}
                  className="flex-1"
                  data-testid="cancel-button"
                >
                  Cancel
                </ModernButton>
                <ModernButton
                  type="submit"
                  variant="primary"
                  isLoading={isCreating}
                  disabled={
                    isCreating || !isFormValid || (dataLoaded && availableIntegrations.length === 0)
                  }
                  className="flex-1"
                  data-testid="create-team-submit-button"
                >
                  Create Team
                </ModernButton>
              </div>
            </form>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }
);

CreateTeamModal.displayName = 'CreateTeamModal';
