import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { X, Plus, Trash2, Calendar, Clock, Users, Save } from 'lucide-react';
import { toast } from 'sonner';
import { standupsApi } from '@/lib/api';
import type { StandupConfig } from '@/types';

interface StandupEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  standup: StandupConfig;
}

interface StandupFormData {
  name: string;
  questions: string[];
  schedule: {
    time: string;
    days: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
    timezone: string;
  };
  slackChannelId?: string;
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
];

export const StandupEditModal: React.FC<StandupEditModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  standup,
}) => {
  const [formData, setFormData] = useState<StandupFormData>({
    name: standup.name,
    questions: [...standup.questions],
    schedule: {
      time: standup.schedule.time,
      days: [...standup.schedule.days],
      timezone: standup.schedule.timezone,
    },
    slackChannelId: standup.slackChannelId,
  });

  const [isSaving, setIsSaving] = useState(false);

  // Reset form when standup changes
  useEffect(() => {
    if (standup) {
      setFormData({
        name: standup.name,
        questions: [...standup.questions],
        schedule: {
          time: standup.schedule.time,
          days: [...standup.schedule.days],
          timezone: standup.schedule.timezone,
        },
        slackChannelId: standup.slackChannelId,
      });
    }
  }, [standup]);

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

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.questions.length === 0) {
      toast.error('Please add at least one question');
      return;
    }

    if (formData.schedule.days.length === 0) {
      toast.error('Please select at least one day');
      return;
    }

    setIsSaving(true);
    try {
      await standupsApi.updateStandup(standup.id, formData);
      toast.success('Standup updated successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating standup:', error);
      toast.error('Failed to update standup');
    } finally {
      setIsSaving(false);
    }
  };

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, ''],
    }));
  };

  const updateQuestion = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? value : q)),
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

  const toggleDay = (
    day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  ) => {
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

  const selectWeekdays = () => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      },
    }));
  };

  const selectAllDays = () => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        days: DAYS_OF_WEEK.map(d => d.key),
      },
    }));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center pt-16 pb-16">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl my-4 mx-4 bg-background rounded-2xl shadow-2xl border border-border"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-primary to-primary/80 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Edit Standup</h2>
                <p className="text-sm text-muted-foreground">Update standup configuration</p>
              </div>
            </div>
            <ModernButton variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </ModernButton>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2">Standup Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-150"
                placeholder="e.g., Daily Standup"
                required
              />
            </div>

            {/* Questions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium">Questions</label>
                <ModernButton type="button" variant="outline" size="sm" onClick={addQuestion}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Question
                </ModernButton>
              </div>
              <div className="space-y-3">
                {formData.questions.map((question, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={question}
                        onChange={e => updateQuestion(index, e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-150"
                        placeholder="Enter your question..."
                        required
                      />
                    </div>
                    {formData.questions.length > 1 && (
                      <ModernButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(index)}
                        className="text-red-600 hover:text-red-700 px-3"
                      >
                        <Trash2 className="w-4 h-4" />
                      </ModernButton>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div>
              <label className="block text-sm font-medium mb-3">Schedule</label>

              {/* Time */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Time</span>
                </div>
                <input
                  type="time"
                  value={formData.schedule.time}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      schedule: { ...prev.schedule, time: e.target.value },
                    }))
                  }
                  className="px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-150"
                  required
                />
              </div>

              {/* Timezone */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Timezone</span>
                </div>
                <select
                  value={formData.schedule.timezone}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      schedule: { ...prev.schedule, timezone: e.target.value },
                    }))
                  }
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-150"
                  required
                >
                  {SUPPORTED_TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Days */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Days</span>
                  </div>
                  <div className="flex gap-2">
                    <ModernButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectWeekdays}
                      className="text-xs"
                    >
                      Weekdays
                    </ModernButton>
                    <ModernButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectAllDays}
                      className="text-xs"
                    >
                      All Days
                    </ModernButton>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => toggleDay(day.key)}
                      className={`p-3 text-sm font-medium rounded-lg border transition-colors ${
                        formData.schedule.days.includes(day.key)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground'
                      }`}
                    >
                      {day.label.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <ModernButton type="button" variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </ModernButton>
              <ModernButton type="submit" variant="primary" disabled={isSaving} className="flex-1">
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Update Standup
                  </>
                )}
              </ModernButton>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
