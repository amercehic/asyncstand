import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Users, User, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { ModernButton } from '@/components/ui';
import type { StandupMember, SendReminderRequest } from '@/types';

interface SmartReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
  members: StandupMember[];
  deliveryType: 'channel' | 'direct_message';
  onSendReminder: (request: SendReminderRequest) => Promise<void>;
  teamName: string;
}

const REMINDER_TEMPLATES = {
  gentle: {
    title: '👋 Gentle Reminder',
    message:
      "Hi there! Just a friendly reminder about today's standup. When you have a moment, could you please share your updates?",
  },
  standard: {
    title: '📋 Standard Reminder',
    message:
      "This is a reminder to complete today's standup. Please submit your responses when you can.",
  },
  urgent: {
    title: '⚡ Urgent Reminder',
    message:
      "We're still waiting for your standup response. Please complete it as soon as possible to help keep the team updated.",
  },
  final: {
    title: '🚨 Final Notice',
    message:
      "This is the final reminder for today's standup. Please respond immediately or let us know if you're unable to participate.",
  },
};

export const SmartReminderModal: React.FC<SmartReminderModalProps> = ({
  isOpen,
  onClose,
  instanceId,
  members,
  deliveryType,
  onSendReminder,
}) => {
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [reminderType, setReminderType] = useState<'individual' | 'broadcast'>('individual');
  const [reminderStyle, setReminderStyle] = useState<keyof typeof REMINDER_TEMPLATES>('standard');
  const [customMessage, setCustomMessage] = useState('');
  const [useCustomMessage, setUseCustomMessage] = useState(false);
  const [isSending, setIsSending] = useState(false);

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

  // More robust filtering - include all members if status is not properly set,
  // but exclude only explicitly completed ones
  const eligibleMembers = members.filter(member => {
    // If member doesn't have a status or it's null/undefined, consider them eligible
    if (!member.status) return true;
    // Exclude only completed and in_progress members
    return member.status !== 'completed' && member.status !== 'in_progress';
  });

  const overdueMembers = eligibleMembers.filter(member => member.status === 'overdue');
  const notStartedMembers = eligibleMembers.filter(
    member => member.status === 'not_started' || !member.status
  );

  const handleMemberToggle = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSelectGroup = (memberIds: string[]) => {
    setSelectedMembers(memberIds);
  };

  const handleSend = async () => {
    if (selectedMembers.length === 0) return;

    setIsSending(true);
    try {
      const message = useCustomMessage ? customMessage : REMINDER_TEMPLATES[reminderStyle].message;

      await onSendReminder({
        instanceId,
        userIds: selectedMembers,
        message,
        type: reminderType,
        deliveryMethod: deliveryType === 'channel' ? 'channel_mention' : 'direct_message',
      });

      onClose();
    } catch (error) {
      console.error('Failed to send reminders:', error);
    } finally {
      setIsSending(false);
    }
  };

  const getMemberStatusIcon = (status: StandupMember['status']) => {
    switch (status) {
      case 'overdue':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'not_started':
        return <Clock className="w-4 h-4 text-gray-600" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Send Smart Reminders</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Send targeted reminders to team members who haven't responded
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <h3 className="font-medium text-red-800">Overdue Members</h3>
                  </div>
                  <p className="text-sm text-red-700 mb-3">{overdueMembers.length} members</p>
                  <ModernButton
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectGroup(overdueMembers.map(m => m.id))}
                    className="w-full border-red-300 text-red-700 hover:bg-red-100"
                  >
                    Select All Overdue
                  </ModernButton>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Clock className="w-5 h-5 text-gray-600" />
                    <h3 className="font-medium text-gray-800">Not Started</h3>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">{notStartedMembers.length} members</p>
                  <ModernButton
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectGroup(notStartedMembers.map(m => m.id))}
                    className="w-full"
                  >
                    Select All Not Started
                  </ModernButton>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Users className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-blue-800">All Eligible</h3>
                  </div>
                  <p className="text-sm text-blue-700 mb-3">{eligibleMembers.length} members</p>
                  <ModernButton
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectGroup(eligibleMembers.map(m => m.id))}
                    className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    Select All Eligible
                  </ModernButton>
                </div>
              </div>

              {/* Member Selection */}
              <div>
                <h3 className="font-medium text-foreground mb-4">
                  Select Members to Remind ({eligibleMembers.length} of {members.length} eligible)
                </h3>
                <div className="border border-border rounded-lg p-4">
                  {eligibleMembers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                      {eligibleMembers.map(member => (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(member.id)}
                            onChange={() => handleMemberToggle(member.id)}
                            className="rounded border-border"
                          />
                          <div className="flex items-center gap-3 flex-1">
                            {member.avatar ? (
                              <img
                                src={member.avatar}
                                alt={member.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="w-4 h-4 text-primary" />
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-foreground">{member.name}</div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {getMemberStatusIcon(member.status)}
                                <span className="capitalize">
                                  {member.status.replace('_', ' ')}
                                </span>
                                {member.reminderCount > 0 && (
                                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-md">
                                    {member.reminderCount} reminder
                                    {member.reminderCount > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h4 className="font-medium text-foreground mb-2">
                        {members.length === 0
                          ? 'No Team Members Found'
                          : 'No Members Need Reminders'}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {members.length === 0
                          ? 'No team members are available for this standup instance.'
                          : 'All team members have either completed their standup or are currently in progress.'}
                      </p>
                      {members.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Total members: {members.length} | Completed/In Progress:{' '}
                          {members.length - eligibleMembers.length}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Reminder Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Reminder Type */}
                <div>
                  <h3 className="font-medium text-foreground mb-3">Reminder Type</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted">
                      <input
                        type="radio"
                        name="reminderType"
                        value="individual"
                        checked={reminderType === 'individual'}
                        onChange={e => setReminderType(e.target.value as 'individual')}
                      />
                      <div>
                        <div className="font-medium">Individual Reminders</div>
                        <div className="text-sm text-muted-foreground">
                          {deliveryType === 'channel'
                            ? 'Mention each member in the channel'
                            : 'Send separate DM to each member'}
                        </div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted">
                      <input
                        type="radio"
                        name="reminderType"
                        value="broadcast"
                        checked={reminderType === 'broadcast'}
                        onChange={e => setReminderType(e.target.value as 'broadcast')}
                      />
                      <div>
                        <div className="font-medium">Broadcast Reminder</div>
                        <div className="text-sm text-muted-foreground">
                          Single message mentioning all selected members
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Message Template */}
                <div>
                  <h3 className="font-medium text-foreground mb-3">Message Style</h3>
                  <div className="space-y-2">
                    {Object.entries(REMINDER_TEMPLATES).map(([key, template]) => (
                      <label
                        key={key}
                        className="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted"
                      >
                        <input
                          type="radio"
                          name="reminderStyle"
                          value={key}
                          checked={reminderStyle === key && !useCustomMessage}
                          onChange={() => {
                            setReminderStyle(key as keyof typeof REMINDER_TEMPLATES);
                            setUseCustomMessage(false);
                          }}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium">{template.title}</div>
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            {template.message}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Custom Message */}
              <div>
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={useCustomMessage}
                    onChange={e => setUseCustomMessage(e.target.checked)}
                  />
                  <span className="font-medium text-foreground">Use Custom Message</span>
                </label>
                {useCustomMessage && (
                  <textarea
                    value={customMessage}
                    onChange={e => setCustomMessage(e.target.value)}
                    placeholder="Write your custom reminder message..."
                    className="w-full h-24 p-3 border border-border rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                )}
              </div>

              {/* Preview */}
              {selectedMembers.length > 0 && (
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2">Preview</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      <strong>Recipients:</strong> {selectedMembers.length} member
                      {selectedMembers.length > 1 ? 's' : ''}
                    </p>
                    <p>
                      <strong>Delivery:</strong>{' '}
                      {deliveryType === 'channel' ? 'Channel mentions' : 'Direct messages'}
                    </p>
                    <p>
                      <strong>Message:</strong>{' '}
                      {useCustomMessage ? customMessage : REMINDER_TEMPLATES[reminderStyle].message}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between p-6 border-t border-border bg-muted/30">
            <div className="text-sm text-muted-foreground">
              {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
            </div>
            <div className="flex gap-3">
              <ModernButton variant="ghost" onClick={onClose}>
                Cancel
              </ModernButton>
              <ModernButton
                variant="primary"
                onClick={handleSend}
                disabled={selectedMembers.length === 0 || isSending}
              >
                {isSending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Reminder{selectedMembers.length > 1 ? 's' : ''}
              </ModernButton>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
