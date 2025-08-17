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
  MessageSquare,
  Send,
  Settings,
} from 'lucide-react';
import { toast } from '@/components/ui';
import { standupsApi } from '@/lib/api';
import type { StandupConfig } from '@/types';
import { StandupDeliveryType } from '@/types/backend';

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

export const StandupEditPage = React.memo(() => {
  const { standupId } = useParams<{ standupId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [originalStandup, setOriginalStandup] = useState<StandupConfig | null>(null);

  const [formData, setFormData] = useState<StandupFormData>({
    name: '',
    deliveryType: StandupDeliveryType.channel,
    questions: [''],
    schedule: {
      time: '09:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      timezone: 'America/New_York',
    },
    targetChannelId: undefined,
  });

  // Check if form has changes
  const hasChanges = React.useMemo(() => {
    if (!originalStandup) return false;

    // Compare name
    if (formData.name !== originalStandup.name) return true;

    // Compare delivery type
    if (formData.deliveryType !== originalStandup.deliveryType) return true;

    // Compare questions
    if (formData.questions.length !== originalStandup.questions.length) return true;
    for (let i = 0; i < formData.questions.length; i++) {
      if (formData.questions[i] !== originalStandup.questions[i]) return true;
    }

    // Compare schedule
    if (formData.schedule.time !== originalStandup.schedule.time) return true;
    if (formData.schedule.timezone !== originalStandup.schedule.timezone) return true;
    if (formData.schedule.days.length !== originalStandup.schedule.days.length) return true;

    // Compare days (order matters for this comparison)
    const sortedFormDays = [...formData.schedule.days].sort();
    const sortedStandupDays = [...originalStandup.schedule.days].sort();
    for (let i = 0; i < sortedFormDays.length; i++) {
      if (sortedFormDays[i] !== sortedStandupDays[i]) return true;
    }

    // Compare slack channel
    if (formData.targetChannelId !== originalStandup.targetChannelId) return true;

    return false;
  }, [formData, originalStandup]);

  // Fetch standup data
  useEffect(() => {
    const fetchStandup = async () => {
      if (!standupId) return;

      try {
        setIsLoading(true);
        const standup = await standupsApi.getStandupConfig(standupId);
        setOriginalStandup(standup);
        setFormData({
          name: standup.name,
          deliveryType: standup.deliveryType,
          questions: [...standup.questions],
          schedule: {
            time: standup.schedule.time,
            days: [...standup.schedule.days],
            timezone: standup.schedule.timezone,
          },
          targetChannelId: standup.targetChannelId,
        });
      } catch (error) {
        console.error('Error fetching standup:', error);
        toast.error('Failed to load standup');
        navigate(-1);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStandup();
  }, [standupId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.questions.length === 0) {
      toast.error('Please add at least one question');
      return;
    }

    if (formData.questions.some(q => !q.trim())) {
      toast.error('All questions must be filled out');
      return;
    }

    if (formData.schedule.days.length === 0) {
      toast.error('Please select at least one day');
      return;
    }

    if (!standupId) return;

    setIsSaving(true);
    try {
      await standupsApi.updateStandup(standupId, formData);
      toast.success('Standup updated successfully!');
      navigate(`/standups/${standupId}`);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading standup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Link
            to={`/standups/${standupId}`}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Standup
          </Link>

          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-gradient-to-r from-primary to-primary/80 rounded-xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Edit Standup</h1>
              <p className="text-muted-foreground">Update your standup configuration</p>
            </div>
          </div>
        </motion.div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Name Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-card rounded-xl border border-border p-6"
          >
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
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
          </motion.div>

          {/* Delivery Type Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-card rounded-xl border border-border p-6"
          >
            <h2 className="text-lg font-semibold mb-4">Delivery Method</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() =>
                  setFormData(prev => ({ ...prev, deliveryType: StandupDeliveryType.channel }))
                }
                className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                  formData.deliveryType === StandupDeliveryType.channel
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border bg-background hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      formData.deliveryType === StandupDeliveryType.channel
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <span className="font-medium">Channel</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Send standup reminders to a Slack channel where team members respond in threads
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
                className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                  formData.deliveryType === StandupDeliveryType.direct_message
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border bg-background hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      formData.deliveryType === StandupDeliveryType.direct_message
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Send className="w-5 h-5" />
                  </div>
                  <span className="font-medium">Direct Message</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Send individual direct messages to each team member
                </p>
              </button>
            </div>
          </motion.div>

          {/* Questions Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-card rounded-xl border border-border p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Questions</h2>
              <ModernButton type="button" variant="outline" size="sm" onClick={addQuestion}>
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </ModernButton>
            </div>
            <div className="space-y-3">
              {formData.questions.map((question, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex gap-3"
                >
                  <div className="flex-1">
                    <input
                      type="text"
                      value={question}
                      onChange={e => updateQuestion(index, e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-150"
                      placeholder={`Question ${index + 1}`}
                      required
                    />
                  </div>
                  {formData.questions.length > 1 && (
                    <ModernButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </ModernButton>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Schedule Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-card rounded-xl border border-border p-6"
          >
            <h2 className="text-lg font-semibold mb-4">Schedule</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Time */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <label className="text-sm font-medium">Time</label>
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
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-150"
                  required
                />
              </div>

              {/* Timezone */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <label className="text-sm font-medium">Timezone</label>
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
            </div>

            {/* Days */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <label className="text-sm font-medium">Days</label>
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
                    className={`p-3 text-sm font-medium rounded-lg border-2 transition-all duration-200 ${
                      formData.schedule.days.includes(day.key)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    {day.label.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex gap-4"
          >
            <Link to={`/standups/${standupId}`} className="flex-1">
              <ModernButton type="button" variant="secondary" className="w-full">
                Cancel
              </ModernButton>
            </Link>
            <ModernButton
              type="submit"
              variant="primary"
              disabled={isSaving || !hasChanges}
              className="flex-1"
            >
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
          </motion.div>
        </form>
      </main>
    </div>
  );
});
