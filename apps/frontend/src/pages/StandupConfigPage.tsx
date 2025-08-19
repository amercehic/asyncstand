import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Users,
  Save,
  Hash,
  MessageSquare,
  Send,
} from 'lucide-react';
import { toast } from '@/components/ui';
import { teamsApi, standupsApi } from '@/lib/api';
import type { Team, Standup } from '@/types';
import type { AvailableChannel } from '@/types/backend';
import { StandupDeliveryType } from '@/types/backend';
import type { AxiosError } from 'axios';

interface StandupFormData {
  name: string;
  deliveryType: StandupDeliveryType;
  questions: string[];
  schedule: {
    time: string;
    days: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
    timezone: string;
  };
  targetChannelId?: string;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const;

const STANDUP_TEMPLATES = [
  {
    id: 'daily-scrum',
    name: 'Daily Scrum',
    description: 'Traditional agile standup questions',
    icon: '🏃‍♂️',
    questions: [
      'What did you work on yesterday?',
      'What are you working on today?',
      'Any blockers or challenges?',
    ],
    schedule: {
      time: '09:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const,
    },
  },
  {
    id: 'weekly-sync',
    name: 'Weekly Team Sync',
    description: 'Weekly check-in for broader updates',
    icon: '📅',
    questions: [
      'What were your key accomplishments this week?',
      'What are your priorities for next week?',
      'Any support or resources needed?',
    ],
    schedule: {
      time: '10:00',
      days: ['monday'] as const,
    },
  },
  {
    id: 'project-update',
    name: 'Project Status Update',
    description: 'Focus on project progress and milestones',
    icon: '🎯',
    questions: [
      'What progress have you made on your current project?',
      'Are you on track to meet your deadlines?',
      'Any risks or issues to highlight?',
      'Do you need help from the team?',
    ],
    schedule: {
      time: '14:00',
      days: ['wednesday', 'friday'] as const,
    },
  },
  {
    id: 'mood-check',
    name: 'Team Mood & Wellness',
    description: 'Check in on team wellbeing and morale',
    icon: '😊',
    questions: [
      'How are you feeling today? (1-10)',
      "What's energizing you this week?",
      'Any concerns or stress points?',
    ],
    schedule: {
      time: '09:30',
      days: ['friday'] as const,
    },
  },
  {
    id: 'custom',
    name: 'Custom Template',
    description: 'Start from scratch with your own questions',
    icon: '✏️',
    questions: [
      'What did you work on yesterday?',
      'What are you working on today?',
      'Any blockers or challenges?',
    ],
    schedule: {
      time: '09:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const,
    },
  },
] as const;

export const StandupConfigPage = React.memo(() => {
  const { teamId, standupId } = useParams<{ teamId?: string; standupId?: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplateSelection, setShowTemplateSelection] = useState(true);

  // Determine if we're in edit mode
  const isEditMode = Boolean(standupId);
  const [existingStandup, setExistingStandup] = useState<Standup | null>(null);
  const [availableChannels, setAvailableChannels] = useState<AvailableChannel[]>([]);
  const [formData, setFormData] = useState<StandupFormData>({
    name: 'Daily Standup',
    deliveryType: StandupDeliveryType.channel,
    questions: [...STANDUP_TEMPLATES[0].questions],
    schedule: {
      time: STANDUP_TEMPLATES[0].schedule.time,
      days: [...STANDUP_TEMPLATES[0].schedule.days],
      timezone: 'UTC',
    },
    targetChannelId: undefined,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        if (isEditMode && standupId) {
          // Edit mode: load existing standup data
          try {
            const [standupData, channelsData] = await Promise.all([
              standupsApi.getStandupConfig(standupId),
              teamsApi.getAvailableChannels(),
            ]);
            setExistingStandup(standupData);
            setAvailableChannels(channelsData.channels);

            // Set the team data from the loaded standup
            const teamData = await teamsApi.getTeam(standupData.teamId);
            setTeam(teamData);

            // Pre-populate the form with existing data
            setFormData({
              name: standupData.name,
              deliveryType: standupData.deliveryType,
              questions: standupData.questions,
              schedule: standupData.schedule,
              targetChannelId: standupData.targetChannelId || undefined,
            });

            // Hide template selection for edit mode
            setShowTemplateSelection(false);
          } catch (error) {
            console.error('Error loading standup config:', error);
            toast.error('Failed to load standup configuration');
            navigate('/standups');
            return;
          }
        } else if (teamId) {
          // Create mode: load team data and available channels
          const [teamData, channelsData] = await Promise.all([
            teamsApi.getTeam(teamId),
            teamsApi.getAvailableChannels(),
          ]);
          setTeam(teamData);
          setAvailableChannels(channelsData.channels);

          // Try to fetch existing standup config for pre-population first
          let shouldAutoSelectChannel = true;
          try {
            const standups = await standupsApi.getTeamStandups(teamId);
            if (standups.length > 0) {
              const existingStandup = standups[0];
              // Use existing standup data as template for new standup
              setFormData(prev => ({
                ...prev,
                name: `${existingStandup.name} Copy`, // Add "Copy" to differentiate
                deliveryType: existingStandup.deliveryType,
                questions: existingStandup.questions,
                schedule: existingStandup.schedule,
                // Don't copy targetChannelId, let it auto-select below
              }));
              // Still auto-select channel even when copying from existing standup
              shouldAutoSelectChannel = true;
            }
          } catch (configError: unknown) {
            // If standup config doesn't exist, that's okay - user can create one
            const axiosError = configError as AxiosError;
            const errorData = axiosError?.response?.data as
              | { code?: string; detail?: string }
              | undefined;

            if (
              axiosError?.response?.status === 404 ||
              errorData?.code === 'STANDUP_CONFIG_NOT_FOUND' ||
              (errorData?.detail && errorData.detail.includes('STANDUP_CONFIG_NOT_FOUND'))
            ) {
              // No existing standup config found, user can create one
            } else {
              console.error('Error fetching standup config:', configError);
              toast.error('Failed to load existing standup configuration');
            }
          }

          // Auto-select first available unassigned channel for new standups
          if (shouldAutoSelectChannel) {
            const unassignedChannels = channelsData.channels.filter(ch => !ch.isAssigned);
            if (unassignedChannels.length > 0) {
              setFormData(prev => ({
                ...prev,
                targetChannelId: unassignedChannels[0].id,
              }));
            }
          }
        } else {
          // Neither edit mode nor create mode with team - redirect
          navigate('/standups');
          return;
        }
      } catch (error: unknown) {
        console.error('Error fetching data:', error);
        if ((error as AxiosError)?.response?.status === 404) {
          toast.error(isEditMode ? 'Standup not found' : 'Team not found');
        } else {
          toast.error('Failed to load data');
        }
        navigate(isEditMode ? '/standups' : '/teams');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [teamId, standupId, isEditMode, navigate]);

  const handleInputChange = (field: keyof StandupFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Validation function to check if form is valid
  const isFormValid = (): boolean => {
    // Check required fields
    if (!formData.name.trim()) return false;
    if (formData.questions.some(q => !q.trim())) return false;
    if (formData.schedule.days.length === 0) return false;

    // Check channel selection for channel delivery type
    if (formData.deliveryType === StandupDeliveryType.channel && !formData.targetChannelId) {
      return false;
    }

    return true;
  };

  // Check if channel selection is valid (for displaying warnings)
  const isChannelSelectionValid = (): boolean => {
    if (formData.deliveryType !== StandupDeliveryType.channel) return true;
    return Boolean(formData.targetChannelId);
  };

  // Filter available channels and ensure selected channel is included in edit mode
  const availableChannelsForSelection = (() => {
    const baseChannels = availableChannels.filter(
      channel => !channel.isAssigned || (isEditMode && channel.id === formData.targetChannelId)
    );

    // In edit mode, if the current channel is not in the list, find and add it
    let channels = [...baseChannels];
    if (isEditMode && formData.targetChannelId) {
      const hasCurrentChannel = channels.some(ch => ch.id === formData.targetChannelId);
      if (!hasCurrentChannel) {
        const currentChannel = availableChannels.find(ch => ch.id === formData.targetChannelId);
        if (currentChannel) {
          channels = [...channels, currentChannel];
        }
      }
    }

    return channels.sort((a, b) => {
      // In edit mode, sort the currently selected channel first
      if (isEditMode && formData.targetChannelId) {
        if (a.id === formData.targetChannelId) return -1;
        if (b.id === formData.targetChannelId) return 1;
      }
      return a.name.localeCompare(b.name);
    });
  })();

  const handleScheduleChange = (
    field: keyof StandupFormData['schedule'],
    value: string | string[]
  ) => {
    setFormData(prev => ({
      ...prev,
      schedule: { ...prev.schedule, [field]: value },
    }));
  };

  const handleDayToggle = (day: (typeof DAYS_OF_WEEK)[number]['key']) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        days: prev.schedule.days.includes(day)
          ? prev.schedule.days.filter(d => d !== day)
          : [...prev.schedule.days, day],
      },
    }));
  };

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, ''],
    }));
  };

  const removeQuestion = (index: number) => {
    if (formData.questions.length <= 1) {
      toast.error('At least one question is required');
      return;
    }
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  const updateQuestion = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? value : q)),
    }));
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = STANDUP_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    setSelectedTemplate(templateId);
    setFormData(prev => ({
      ...prev,
      name: template.name,
      questions: [...template.questions],
      schedule: {
        ...prev.schedule,
        time: template.schedule.time,
        days: [...template.schedule.days],
      },
    }));
    setShowTemplateSelection(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Standup name is required');
      return;
    }

    if (formData.questions.some(q => !q.trim())) {
      toast.error('All questions must be filled out');
      return;
    }

    if (formData.schedule.days.length === 0) {
      toast.error('At least one day must be selected');
      return;
    }

    if (formData.deliveryType === StandupDeliveryType.channel && !formData.targetChannelId) {
      toast.error('Please select a channel for delivery');
      return;
    }

    setIsSaving(true);

    try {
      if (isEditMode && standupId) {
        // Update existing standup
        const updateData = {
          name: formData.name,
          deliveryType: formData.deliveryType,
          questions: formData.questions,
          schedule: formData.schedule,
          targetChannelId: formData.targetChannelId || undefined,
        };

        await standupsApi.updateStandup(standupId, updateData);
        toast.success('Standup configuration updated successfully');
        navigate(`/teams/${existingStandup?.teamId || teamId}?tab=standups`);
      } else if (teamId) {
        // Create new standup
        const standupData = {
          teamId: teamId!,
          name: formData.name,
          deliveryType: formData.deliveryType,
          questions: formData.questions,
          schedule: formData.schedule,
          targetChannelId: formData.targetChannelId || undefined,
        };

        await standupsApi.createStandup(teamId!, standupData);
        toast.success('Standup configuration created successfully');
        navigate(`/teams/${teamId}`);
      }
    } catch (error: unknown) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} standup:`, error);

      // Handle specific error cases with better messaging
      const axiosError = error as {
        response?: {
          data?: {
            code?: string;
            title?: string;
            message?: string;
            response?: { code?: string; message?: string };
          };
        };
      };

      const errorCode =
        axiosError?.response?.data?.code || axiosError?.response?.data?.response?.code;
      const errorMessage =
        axiosError?.response?.data?.title ||
        axiosError?.response?.data?.message ||
        axiosError?.response?.data?.response?.message;

      if (errorCode === 'STANDUP_CONFIG_ALREADY_EXISTS') {
        toast.error(
          errorMessage || 'A standup configuration with this name already exists for this team'
        );
      } else {
        toast.error(`Failed to ${isEditMode ? 'update' : 'save'} standup configuration`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading team...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Team Not Found</h1>
          <p className="text-muted-foreground mb-6">The team you're looking for doesn't exist.</p>
          <Link to="/teams">
            <ModernButton variant="primary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Teams
            </ModernButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4 mb-8"
        >
          <Link
            to={
              isEditMode
                ? `/teams/${existingStandup?.teamId || teamId}?tab=standups`
                : `/teams/${teamId}`
            }
          >
            <ModernButton variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </ModernButton>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{isEditMode ? 'Edit Standup' : 'Create Standup'}</h1>
            <p className="text-muted-foreground text-lg">
              {isEditMode
                ? `Editing "${formData.name}" for ${team.name}`
                : `Configure a new standup for ${team.name}`}
            </p>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-8">
              {/* Template Selection */}
              {showTemplateSelection && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="bg-card rounded-2xl p-6 border border-border"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold">Choose a Template</h2>
                      <p className="text-muted-foreground">
                        Start with a predefined template or create your own
                      </p>
                    </div>
                    <ModernButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTemplateSelection(false)}
                    >
                      Hide
                    </ModernButton>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {STANDUP_TEMPLATES.map(template => (
                      <motion.div
                        key={template.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                          selectedTemplate === template.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handleTemplateSelect(template.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">{template.icon}</div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm">{template.name}</h3>
                            <p className="text-xs text-muted-foreground mb-2">
                              {template.description}
                            </p>
                            <div className="text-xs text-muted-foreground">
                              <div className="flex items-center gap-1 mb-1">
                                <Calendar className="w-3 h-3" />
                                <span>
                                  {template.schedule.days.length === 5 &&
                                  template.schedule.days.includes(
                                    'monday' as (typeof template.schedule.days)[number]
                                  ) &&
                                  template.schedule.days.includes(
                                    'friday' as (typeof template.schedule.days)[number]
                                  )
                                    ? 'Weekdays'
                                    : `${template.schedule.days.length} day${template.schedule.days.length !== 1 ? 's' : ''}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{template.schedule.time}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
              {/* Basic Information */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: showTemplateSelection ? 0.2 : 0.1 }}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Basic Information</h2>
                  {!showTemplateSelection && (
                    <ModernButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTemplateSelection(true)}
                    >
                      Change Template
                    </ModernButton>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-2">
                      Standup Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={e => handleInputChange('name', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="e.g., Daily Standup, Weekly Check-in"
                      required
                    />
                  </div>

                  {/* Slack Channel Info - Read-only display */}
                  {team.channel && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Slack Channel</label>
                      <div className="px-4 py-3 bg-muted/50 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">#{team.channel.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Standup responses will be posted to your team's channel
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Delivery Type */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: showTemplateSelection ? 0.25 : 0.15 }}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <h2 className="text-xl font-semibold mb-6">Delivery Type</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData(prev => ({ ...prev, deliveryType: StandupDeliveryType.channel }))
                    }
                    className={`p-6 rounded-lg border transition-all duration-200 text-left ${
                      formData.deliveryType === StandupDeliveryType.channel
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border bg-background hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-4 mb-3">
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          formData.deliveryType === StandupDeliveryType.channel
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Channel</h3>
                        <p className="text-sm text-muted-foreground">Send to Slack channel</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Send standup reminders to a Slack channel where team members respond in
                      threads. Great for transparency and team visibility.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFormData(prev => ({
                        ...prev,
                        deliveryType: StandupDeliveryType.direct_message,
                      }))
                    }
                    className={`p-6 rounded-lg border transition-all duration-200 text-left ${
                      formData.deliveryType === StandupDeliveryType.direct_message
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border bg-background hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-4 mb-3">
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          formData.deliveryType === StandupDeliveryType.direct_message
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Send className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Direct Message</h3>
                        <p className="text-sm text-muted-foreground">Send individual DMs</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Send individual direct messages to each team member. Perfect for private
                      updates and sensitive information.
                    </p>
                  </button>
                </div>
              </motion.div>

              {/* Channel Selection - only show when delivery type is channel */}
              {formData.deliveryType === StandupDeliveryType.channel && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: showTemplateSelection ? 0.3 : 0.2 }}
                  className="bg-card rounded-2xl p-6 border border-border"
                >
                  <h2 className="text-xl font-semibold mb-4">Channel Selection</h2>
                  <p className="text-muted-foreground mb-6 text-sm">
                    Choose which Slack channel to send standup messages to.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="targetChannel" className="block text-sm font-medium mb-2">
                        Target Channel
                      </label>
                      <select
                        id="targetChannel"
                        value={formData.targetChannelId || ''}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            targetChannelId: e.target.value || undefined,
                          }))
                        }
                        className={`w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                          !isChannelSelectionValid()
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                            : 'border-border'
                        }`}
                        required
                        disabled={availableChannels.length === 0}
                      >
                        <option value="">
                          {availableChannels.length === 0
                            ? 'Loading channels...'
                            : 'Select a channel...'}
                        </option>
                        {availableChannelsForSelection.map(channel => (
                          <option key={channel.id} value={channel.id}>
                            #{channel.name}
                            {channel.isAssigned && channel.assignedTeamName
                              ? ` (used by ${channel.assignedTeamName})`
                              : ''}
                          </option>
                        ))}
                      </select>
                      {!isChannelSelectionValid() && (
                        <p className="text-sm text-red-600 mt-1">
                          Please select a channel for channel delivery type.
                        </p>
                      )}
                      {availableChannelsForSelection.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          No available channels. All channels are assigned to other standups.
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Questions */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: showTemplateSelection ? 0.35 : 0.25 }}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Standup Questions</h2>
                  <ModernButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addQuestion}
                    data-testid="add-question-button"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                  </ModernButton>
                </div>

                <div className="space-y-4">
                  {formData.questions.map((question, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="flex gap-3"
                    >
                      <div className="flex-1">
                        <label
                          htmlFor={`question-${index}`}
                          className="block text-sm font-medium mb-2"
                        >
                          Question {index + 1}
                        </label>
                        <input
                          id={`question-${index}`}
                          type="text"
                          value={question}
                          onChange={e => updateQuestion(index, e.target.value)}
                          className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="Enter your question here..."
                          required
                        />
                      </div>
                      {formData.questions.length > 1 && (
                        <div className="pt-8">
                          <ModernButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeQuestion(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            data-testid={`remove-question-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </ModernButton>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Schedule */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: showTemplateSelection ? 0.45 : 0.35 }}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <h2 className="text-xl font-semibold mb-6">Schedule</h2>

                <div className="space-y-6">
                  <div>
                    <label htmlFor="time" className="block text-sm font-medium mb-2">
                      Time
                    </label>
                    <input
                      id="time"
                      type="time"
                      value={formData.schedule.time}
                      onChange={e => handleScheduleChange('time', e.target.value)}
                      className="px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-3">Days of the Week</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {DAYS_OF_WEEK.map(day => (
                        <label
                          key={day.key}
                          className={`flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors ${
                            formData.schedule.days.includes(day.key)
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.schedule.days.includes(day.key)}
                            onChange={() => handleDayToggle(day.key)}
                            className="sr-only"
                          />
                          <span className="text-sm font-medium">{day.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="timezone" className="block text-sm font-medium mb-2">
                      Timezone
                    </label>
                    <select
                      id="timezone"
                      value={formData.schedule.timezone}
                      onChange={e => handleScheduleChange('timezone', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="UTC">UTC</option>
                      <optgroup label="Americas">
                        <option value="America/New_York">Eastern Time (New York)</option>
                        <option value="America/Chicago">Central Time (Chicago)</option>
                        <option value="America/Denver">Mountain Time (Denver)</option>
                        <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
                        <option value="America/Toronto">Toronto</option>
                        <option value="America/Vancouver">Vancouver</option>
                      </optgroup>
                      <optgroup label="Europe">
                        <option value="Europe/London">London</option>
                        <option value="Europe/Paris">Paris</option>
                        <option value="Europe/Berlin">Berlin</option>
                        <option value="Europe/Rome">Rome</option>
                        <option value="Europe/Madrid">Madrid</option>
                        <option value="Europe/Amsterdam">Amsterdam</option>
                        <option value="Europe/Stockholm">Stockholm</option>
                        <option value="Europe/Oslo">Oslo</option>
                        <option value="Europe/Copenhagen">Copenhagen</option>
                        <option value="Europe/Helsinki">Helsinki</option>
                        <option value="Europe/Warsaw">Warsaw</option>
                        <option value="Europe/Prague">Prague</option>
                        <option value="Europe/Vienna">Vienna</option>
                        <option value="Europe/Zurich">Zurich</option>
                      </optgroup>
                      <optgroup label="Asia">
                        <option value="Asia/Tokyo">Tokyo</option>
                        <option value="Asia/Seoul">Seoul</option>
                        <option value="Asia/Shanghai">Shanghai</option>
                        <option value="Asia/Hong_Kong">Hong Kong</option>
                        <option value="Asia/Singapore">Singapore</option>
                        <option value="Asia/Bangkok">Bangkok</option>
                        <option value="Asia/Mumbai">Mumbai</option>
                        <option value="Asia/Dubai">Dubai</option>
                        <option value="Asia/Jerusalem">Jerusalem</option>
                      </optgroup>
                      <optgroup label="Australia & Pacific">
                        <option value="Australia/Sydney">Sydney</option>
                        <option value="Australia/Melbourne">Melbourne</option>
                        <option value="Australia/Perth">Perth</option>
                        <option value="Pacific/Auckland">Auckland</option>
                      </optgroup>
                    </select>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Preview Sidebar */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-6"
            >
              <div className="bg-card rounded-2xl p-6 border border-border sticky top-6">
                <h3 className="text-lg font-semibold mb-4">Preview</h3>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">{formData.name || 'Unnamed Standup'}</p>
                      <p className="text-sm text-muted-foreground">
                        {formData.schedule.days.length > 0
                          ? `${formData.schedule.days.length} day${formData.schedule.days.length !== 1 ? 's' : ''} a week`
                          : 'No days selected'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">{formData.schedule.time}</p>
                      <p className="text-sm text-muted-foreground">{formData.schedule.timezone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">
                        {formData.questions.length} Question
                        {formData.questions.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-sm text-muted-foreground">For {team.name}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-border">
                  <ModernButton
                    type="submit"
                    variant="primary"
                    className="w-full"
                    disabled={isSaving || !isFormValid()}
                    data-testid="save-standup-button"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                        {isEditMode ? 'Updating...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {isEditMode ? 'Update Standup' : 'Create Standup'}
                      </>
                    )}
                  </ModernButton>
                </div>
              </div>
            </motion.div>
          </div>
        </form>
      </main>
    </div>
  );
});
