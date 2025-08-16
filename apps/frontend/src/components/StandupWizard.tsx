import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { StandupDeliveryType } from '@/types/backend';
import type { CreateStandupConfigRequest, User } from '@/types/api';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  MessageCircle,
  Hash,
  Users,
  Check,
  X,
  Zap,
  Coffee,
  Target,
  Repeat,
  UserCheck,
  UserX,
} from 'lucide-react';

// Wizard Steps
type WizardStep = 'template' | 'details' | 'schedule' | 'delivery' | 'members' | 'review';

// Standup Templates
interface StandupTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  questions: string[];
  defaultTime: string;
  defaultDays: number[];
}

const STANDUP_TEMPLATES: StandupTemplate[] = [
  {
    id: 'daily',
    name: 'Daily Standup',
    description: 'Classic daily check-in with progress updates',
    icon: Coffee,
    color: 'bg-blue-500',
    questions: [
      'What did you accomplish yesterday?',
      'What will you work on today?',
      'Are there any blockers or impediments?',
    ],
    defaultTime: '09:00',
    defaultDays: [1, 2, 3, 4, 5], // Mon-Fri
  },
  {
    id: 'sprint-planning',
    name: 'Sprint Planning',
    description: 'Weekly sprint planning and goal setting',
    icon: Target,
    color: 'bg-green-500',
    questions: [
      'What are your main goals for this sprint?',
      'What tasks are you planning to work on?',
      'Do you have any concerns or dependencies?',
    ],
    defaultTime: '10:00',
    defaultDays: [1], // Monday
  },
  {
    id: 'retrospective',
    name: 'Retrospective',
    description: "Weekly reflection on what worked and what didn't",
    icon: Repeat,
    color: 'bg-purple-500',
    questions: [
      'What went well this week?',
      'What could be improved?',
      'What will you try differently next week?',
    ],
    defaultTime: '16:00',
    defaultDays: [5], // Friday
  },
  {
    id: 'custom',
    name: 'Custom Standup',
    description: 'Create your own standup from scratch',
    icon: Zap,
    color: 'bg-orange-500',
    questions: ['Tell us about your progress'],
    defaultTime: '09:00',
    defaultDays: [1, 2, 3, 4, 5],
  },
];

interface StandupWizardProps {
  teamId: string;
  teamMembers: User[];
  onComplete: (standup: CreateStandupConfigRequest) => Promise<void>;
  onCancel: () => void;
  availableChannels?: Array<{ id: string; name: string }>;
}

export const StandupWizard: React.FC<StandupWizardProps> = ({
  teamId,
  teamMembers,
  onComplete,
  onCancel,
  availableChannels = [],
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<StandupTemplate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [formData, setFormData] = useState<Partial<CreateStandupConfigRequest>>({
    teamId,
    name: '',
    deliveryType: StandupDeliveryType.direct_message,
    questions: [],
    schedule: {
      time: '09:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    reminderMinutesBefore: 15,
    responseTimeoutHours: 2,
  });

  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const steps: Array<{ key: WizardStep; title: string; description: string }> = [
    { key: 'template', title: 'Choose Template', description: 'Select a standup type' },
    { key: 'details', title: 'Standup Details', description: 'Name and questions' },
    { key: 'schedule', title: 'Schedule', description: 'When to run' },
    { key: 'delivery', title: 'Delivery', description: 'How to deliver' },
    { key: 'members', title: 'Team Members', description: 'Who participates' },
    { key: 'review', title: 'Review', description: 'Confirm settings' },
  ];

  const currentStepIndex = steps.findIndex(step => step.key === currentStep);

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const convertNumbersToNames = (dayNumbers: number[]) =>
    dayNumbers.map(num => dayNames[num] as CreateStandupConfigRequest['schedule']['days'][0]);

  const handleTemplateSelect = (template: StandupTemplate) => {
    setSelectedTemplate(template);
    setFormData(prev => ({
      ...prev,
      name: template.name,
      questions: [...template.questions],
      schedule: {
        ...prev.schedule!,
        time: template.defaultTime,
        days: convertNumbersToNames(template.defaultDays),
      },
    }));
    setCurrentStep('details');
  };

  const handleNext = () => {
    const stepOrder: WizardStep[] = [
      'template',
      'details',
      'schedule',
      'delivery',
      'members',
      'review',
    ];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    const stepOrder: WizardStep[] = [
      'template',
      'details',
      'schedule',
      'delivery',
      'members',
      'review',
    ];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.questions?.length) return;

    setIsSubmitting(true);
    try {
      const standupData = {
        ...formData,
        memberIds: selectedMembers,
      } as CreateStandupConfigRequest;

      await onComplete(standupData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (updates: Partial<CreateStandupConfigRequest>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const updateSchedule = (updates: Partial<CreateStandupConfigRequest['schedule']>) => {
    setFormData(prev => ({
      ...prev,
      schedule: { ...prev.schedule!, ...updates },
    }));
  };

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const selectAllMembers = () => {
    setSelectedMembers(teamMembers.map(m => m.id));
  };

  const deselectAllMembers = () => {
    setSelectedMembers([]);
  };

  const isStepComplete = (step: WizardStep): boolean => {
    switch (step) {
      case 'template':
        return !!selectedTemplate;
      case 'details':
        return !!(formData.name && formData.questions?.length);
      case 'schedule':
        return !!(formData.schedule?.time && formData.schedule?.days?.length);
      case 'delivery':
        return !!formData.deliveryType;
      case 'members':
        return selectedMembers.length > 0;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const canProceed = isStepComplete(currentStep);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Create New Standup</h1>
              <p className="text-muted-foreground mt-2">
                Set up a new standup configuration for your team
              </p>
            </div>
            <ModernButton
              variant="ghost"
              onClick={() => setShowCancelConfirm(true)}
              disabled={isSubmitting}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </ModernButton>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    index <= currentStepIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isStepComplete(step.key) ? <Check className="w-5 h-5" /> : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-3 transition-colors ${
                      index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <h2 className="text-xl font-semibold">{steps[currentStepIndex]?.title}</h2>
            <p className="text-muted-foreground">{steps[currentStepIndex]?.description}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-card rounded-xl border border-border p-8 min-h-[600px]">
          <AnimatePresence mode="wait">
            {currentStep === 'template' && (
              <motion.div
                key="template"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-semibold mb-2">Choose a Template</h3>
                  <p className="text-muted-foreground">
                    Select a standup template to get started quickly, or create a custom one
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {STANDUP_TEMPLATES.map(template => {
                    const IconComponent = template.icon;
                    return (
                      <motion.button
                        key={template.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleTemplateSelect(template)}
                        className={`p-6 rounded-xl border-2 text-left transition-all duration-200 ${
                          selectedTemplate?.id === template.id
                            ? 'border-primary bg-primary/5 shadow-lg'
                            : 'border-border hover:border-primary/50 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-16 h-16 rounded-xl ${template.color} flex items-center justify-center flex-shrink-0`}
                          >
                            <IconComponent className="w-8 h-8 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2">{template.name}</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                              {template.description}
                            </p>
                            <div className="text-xs text-muted-foreground">
                              {template.questions.length} questions included
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {currentStep === 'details' && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-semibold mb-2">Standup Details</h3>
                  <p className="text-muted-foreground">
                    Configure the name and questions for your standup
                  </p>
                </div>

                <div className="space-y-6 max-w-2xl mx-auto">
                  <div>
                    <label className="block text-sm font-medium mb-3">Standup Name</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={e => updateFormData({ name: e.target.value })}
                      className="w-full h-12 px-4 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg"
                      placeholder="e.g., Daily Standup, Sprint Planning"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-3">Questions</label>
                    <div className="space-y-4">
                      {formData.questions?.map((question, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium text-primary">
                            {index + 1}
                          </div>
                          <input
                            type="text"
                            value={question}
                            onChange={e => {
                              const newQuestions = [...(formData.questions || [])];
                              newQuestions[index] = e.target.value;
                              updateFormData({ questions: newQuestions });
                            }}
                            className="flex-1 h-12 px-4 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder={`Question ${index + 1}`}
                          />
                          <button
                            onClick={() => {
                              const newQuestions =
                                formData.questions?.filter((_, i) => i !== index) || [];
                              updateFormData({ questions: newQuestions });
                            }}
                            className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const newQuestions = [...(formData.questions || []), ''];
                          updateFormData({ questions: newQuestions });
                        }}
                        className="w-full h-12 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                      >
                        + Add Question
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 'schedule' && (
              <motion.div
                key="schedule"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-semibold mb-2">Schedule</h3>
                  <p className="text-muted-foreground">When should this standup run?</p>
                </div>

                <div className="space-y-8 max-w-2xl mx-auto">
                  <div>
                    <label className="block text-sm font-medium mb-3">Time</label>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                      <input
                        type="time"
                        value={formData.schedule?.time || '09:00'}
                        onChange={e => updateSchedule({ time: e.target.value })}
                        className="h-12 px-4 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-3">Days of the Week</label>
                    <div className="grid grid-cols-7 gap-2">
                      {dayLabels.map((label, index) => {
                        const dayName = dayNames[index];
                        const isSelected = formData.schedule?.days?.includes(
                          dayName as CreateStandupConfigRequest['schedule']['days'][0]
                        );
                        return (
                          <button
                            key={dayName}
                            onClick={() => {
                              const currentDays = formData.schedule?.days || [];
                              const newDays = isSelected
                                ? currentDays.filter(d => d !== dayName)
                                : [
                                    ...currentDays,
                                    dayName as CreateStandupConfigRequest['schedule']['days'][0],
                                  ];
                              updateSchedule({ days: newDays });
                            }}
                            className={`h-12 rounded-lg border text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-3">Timezone</label>
                    <input
                      type="text"
                      value={formData.schedule?.timezone || ''}
                      onChange={e => updateSchedule({ timezone: e.target.value })}
                      className="w-full h-12 px-4 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="e.g., America/New_York"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 'delivery' && (
              <motion.div
                key="delivery"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-semibold mb-2">Delivery Method</h3>
                  <p className="text-muted-foreground">
                    How should standup reminders be delivered?
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                  <button
                    onClick={() =>
                      updateFormData({
                        deliveryType: StandupDeliveryType.direct_message,
                        targetChannelId: undefined,
                      })
                    }
                    className={`p-6 rounded-xl border-2 text-left transition-all duration-200 ${
                      formData.deliveryType === StandupDeliveryType.direct_message
                        ? 'border-primary bg-primary/5 shadow-lg'
                        : 'border-border hover:border-primary/50 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">Direct Messages</h3>
                        <p className="text-sm text-muted-foreground">
                          Send standup reminders via direct messages to each team member
                          individually
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => updateFormData({ deliveryType: StandupDeliveryType.channel })}
                    className={`p-6 rounded-xl border-2 text-left transition-all duration-200 ${
                      formData.deliveryType === StandupDeliveryType.channel
                        ? 'border-primary bg-primary/5 shadow-lg'
                        : 'border-border hover:border-primary/50 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0">
                        <Hash className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">Slack Channel</h3>
                        <p className="text-sm text-muted-foreground">
                          Post standup reminders in a specific Slack channel for team collaboration
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {formData.deliveryType === StandupDeliveryType.channel && (
                  <div className="max-w-md mx-auto mt-8">
                    <label className="block text-sm font-medium mb-3">Select Channel</label>
                    <select
                      value={formData.targetChannelId || ''}
                      onChange={e => updateFormData({ targetChannelId: e.target.value })}
                      className="w-full h-12 px-4 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">Choose a channel...</option>
                      {availableChannels.map(channel => (
                        <option key={channel.id} value={channel.id}>
                          #{channel.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </motion.div>
            )}

            {currentStep === 'members' && (
              <motion.div
                key="members"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-semibold mb-2">Team Members</h3>
                  <p className="text-muted-foreground">
                    Select which team members will participate in this standup
                  </p>
                </div>

                <div className="max-w-2xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-sm text-muted-foreground">
                      {selectedMembers.length} of {teamMembers.length} members selected
                    </div>
                    <div className="flex gap-2">
                      <ModernButton
                        variant="ghost"
                        size="sm"
                        onClick={selectAllMembers}
                        className="gap-2"
                      >
                        <UserCheck className="w-4 h-4" />
                        Select All
                      </ModernButton>
                      <ModernButton
                        variant="ghost"
                        size="sm"
                        onClick={deselectAllMembers}
                        className="gap-2"
                      >
                        <UserX className="w-4 h-4" />
                        Deselect All
                      </ModernButton>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {teamMembers.map(member => (
                      <div
                        key={member.id}
                        onClick={() => toggleMemberSelection(member.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                          selectedMembers.includes(member.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              selectedMembers.includes(member.id)
                                ? 'border-primary bg-primary'
                                : 'border-border'
                            }`}
                          >
                            {selectedMembers.includes(member.id) && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{member.name}</div>
                            <div className="text-sm text-muted-foreground">{member.email}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 'review' && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-semibold mb-2">Review Configuration</h3>
                  <p className="text-muted-foreground">
                    Review your standup settings before creating
                  </p>
                </div>

                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="bg-muted/50 rounded-xl p-6">
                    <h4 className="font-semibold mb-4">Standup Configuration</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">{formData.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Template:</span>
                        <span className="font-medium">{selectedTemplate?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Questions:</span>
                        <span className="font-medium">{formData.questions?.length} questions</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Schedule:</span>
                        <span className="font-medium">
                          {formData.schedule?.time} on {formData.schedule?.days?.join(', ')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Delivery:</span>
                        <span className="font-medium">
                          {formData.deliveryType === StandupDeliveryType.direct_message
                            ? 'Direct Messages'
                            : 'Slack Channel'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Members:</span>
                        <span className="font-medium">{selectedMembers.length} members</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Timezone:</span>
                        <span className="font-medium">{formData.schedule?.timezone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-primary/5 rounded-xl p-6 border border-primary/20">
                    <h4 className="font-medium text-primary mb-2">Ready to create your standup!</h4>
                    <p className="text-sm text-muted-foreground">
                      Your standup will be scheduled to run automatically based on the configuration
                      above. You can always edit these settings later.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-card border-t border-border sticky bottom-0">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <ModernButton
            variant="ghost"
            onClick={currentStep === 'template' ? () => setShowCancelConfirm(true) : handlePrevious}
            disabled={isSubmitting}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {currentStep === 'template' ? 'Cancel' : 'Previous'}
          </ModernButton>

          <div className="flex gap-3">
            {currentStep === 'review' ? (
              <ModernButton
                variant="primary"
                onClick={handleSubmit}
                disabled={!canProceed || isSubmitting}
                isLoading={isSubmitting}
                className="gap-2"
                size="lg"
              >
                <Check className="w-4 h-4" />
                Create Standup
              </ModernButton>
            ) : (
              <ModernButton
                variant="primary"
                onClick={handleNext}
                disabled={!canProceed}
                className="gap-2"
                size="lg"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </ModernButton>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <X className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Cancel Standup Creation?</h3>
                <p className="text-sm text-muted-foreground">
                  You'll lose all progress on this standup
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <ModernButton
                variant="ghost"
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1"
              >
                Continue Editing
              </ModernButton>
              <ModernButton
                variant="destructive"
                onClick={() => {
                  setShowCancelConfirm(false);
                  onCancel();
                }}
                className="flex-1"
              >
                Yes, Cancel
              </ModernButton>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
