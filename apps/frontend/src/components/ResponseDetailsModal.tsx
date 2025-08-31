import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  User,
  MessageSquare,
  Edit3,
  Save,
  AlertCircle,
  CheckCircle2,
  Timer,
  Calendar,
} from 'lucide-react';
import { ModernButton } from '@/components/ui';
import type { StandupMember, DetailedStandupResponse } from '@/types';

interface ResponseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: StandupMember;
  response?: DetailedStandupResponse;
  questions: string[];
  onSaveResponse?: (answers: Record<string, string>) => Promise<void>;
  onSendReminder?: () => void;
  isReadOnly?: boolean;
}

export const ResponseDetailsModal: React.FC<ResponseDetailsModalProps> = ({
  isOpen,
  onClose,
  member,
  response,
  questions,
  onSaveResponse,
  onSendReminder,
  isReadOnly = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedAnswers, setEditedAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    return undefined;
  }, [isOpen, onClose]);

  // Prevent background scrolling when modal is open
  React.useEffect(() => {
    if (isOpen) {
      // Store original overflow style
      const originalStyle = window.getComputedStyle(document.body).overflow;
      // Prevent scrolling
      document.body.style.overflow = 'hidden';

      // Cleanup function to restore original scroll behavior
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (response?.answers) {
      setEditedAnswers(response.answers);
    } else {
      const initialAnswers: Record<string, string> = {};
      questions.forEach((_, index) => {
        initialAnswers[index.toString()] = '';
      });
      setEditedAnswers(initialAnswers);
    }
  }, [response, questions]);

  const handleSave = async () => {
    if (!onSaveResponse) return;

    setIsSaving(true);
    try {
      await onSaveResponse(editedAnswers);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save response:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatResponseTime = (minutes?: number) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getStatusIcon = () => {
    switch (member.status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'overdue':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Timer className="w-5 h-5 text-gray-600" />;
    }
  };

  const getCompletionPercentage = () => {
    const answeredQuestions = Object.values(editedAnswers).filter(
      answer => answer && answer.trim() !== ''
    ).length;
    return Math.round((answeredQuestions / questions.length) * 100);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="relative">
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1">{getStatusIcon()}</div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">{member.name}</h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="capitalize">{member.status.replace('_', ' ')}</span>
                  {member.isLate && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md font-medium">
                      Late Response
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="p-4 bg-muted/30 border-b border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {getCompletionPercentage()}%
                </div>
                <div className="text-xs text-muted-foreground">Complete</div>
              </div>
              {response && (
                <>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">
                      {formatResponseTime(member.responseTime)}
                    </div>
                    <div className="text-xs text-muted-foreground">Response Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{member.reminderCount}</div>
                    <div className="text-xs text-muted-foreground">Reminders</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-foreground">
                      {formatDate(response.submittedAt)}
                    </div>
                    <div className="text-xs text-muted-foreground">Submitted</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {questions.map((question, index) => {
              const answer = editedAnswers[index.toString()] || '';
              const hasAnswer = answer && answer.trim() !== '';

              return (
                <div key={index} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground mb-2">{question}</h3>
                      {isEditing && !isReadOnly ? (
                        <textarea
                          value={answer}
                          onChange={e =>
                            setEditedAnswers(prev => ({
                              ...prev,
                              [index.toString()]: e.target.value,
                            }))
                          }
                          placeholder="Type your answer here..."
                          className="w-full min-h-[100px] p-3 border border-border rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      ) : (
                        <div className="min-h-[60px] p-3 bg-muted/30 rounded-lg border">
                          {hasAnswer ? (
                            <p className="text-foreground whitespace-pre-wrap">{answer}</p>
                          ) : (
                            <p className="text-muted-foreground italic">No response provided</p>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {hasAnswer ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {hasAnswer ? 'Answered' : 'Not answered'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {member.lastReminderSent && (
              <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Last Reminder</span>
                </div>
                <p className="text-sm text-blue-700">
                  Sent on {formatDate(member.lastReminderSent)}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between p-6 border-t border-border bg-muted/30">
            <div className="flex items-center gap-2">
              {response?.lastUpdated && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  Last updated: {formatDate(response.lastUpdated)}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              {member.status !== 'completed' && onSendReminder && (
                <ModernButton variant="outline" onClick={onSendReminder}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send Reminder
                </ModernButton>
              )}

              {!isReadOnly && onSaveResponse && (
                <>
                  {isEditing ? (
                    <>
                      <ModernButton
                        variant="ghost"
                        onClick={() => {
                          setIsEditing(false);
                          if (response?.answers) {
                            setEditedAnswers(response.answers);
                          }
                        }}
                      >
                        Cancel
                      </ModernButton>
                      <ModernButton variant="primary" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Changes
                      </ModernButton>
                    </>
                  ) : (
                    <ModernButton variant="secondary" onClick={() => setIsEditing(true)}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit Response
                    </ModernButton>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
