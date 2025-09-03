import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  Send,
  Eye,
  Timer,
  User,
} from 'lucide-react';
import { ModernButton } from '@/components/ui';
import type { StandupMember } from '@/types';

interface MemberResponseCardProps {
  member: StandupMember;
  questions: string[];
  deliveryType: 'channel' | 'direct_message';
  onSendReminder: (userId: string) => void;
  onViewResponse: (userId: string) => void;
  className?: string;
}

export const MemberResponseCard: React.FC<MemberResponseCardProps> = ({
  member,
  questions,
  deliveryType,
  onSendReminder,
  onViewResponse,
  className = '',
}) => {
  const getStatusConfig = (status: StandupMember['status']) => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle2,
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200',
          label: 'Completed',
          actionable: false,
        };
      case 'in_progress':
        return {
          icon: Clock,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200',
          label: 'In Progress',
          actionable: true,
        };
      case 'overdue':
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50 border-red-200',
          label: 'Overdue',
          actionable: true,
        };
      default:
        return {
          icon: Timer,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200',
          label: 'Not Started',
          actionable: true,
        };
    }
  };

  const statusConfig = getStatusConfig(member.status);
  const StatusIcon = statusConfig.icon;

  const formatResponseTime = (minutes?: number) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getReminderText = () => {
    if (member.reminderCount === 0) return 'Send Reminder';
    if (member.reminderCount === 1) return 'Send Follow-up';
    return `Send Reminder (${member.reminderCount})`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card rounded-lg border p-4 hover:shadow-md transition-all ${statusConfig.bgColor} ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            {member.avatar ? (
              <img
                src={member.avatar}
                alt={member.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
            )}
            <div
              className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                statusConfig.color === 'text-green-600'
                  ? 'bg-green-500'
                  : statusConfig.color === 'text-blue-600'
                    ? 'bg-blue-500'
                    : statusConfig.color === 'text-red-600'
                      ? 'bg-red-500'
                      : 'bg-gray-400'
              }`}
            />
          </div>
          <div>
            <h4 className="font-medium text-foreground">{member.name}</h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <StatusIcon className={`w-3 h-3 ${statusConfig.color}`} />
              <span>{statusConfig.label}</span>
            </div>
          </div>
        </div>

        {member.isLate && (
          <div className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-md font-medium">
            Late
          </div>
        )}
      </div>

      {/* Progress Info */}
      <div className="space-y-2 mb-4">
        {member.response && (
          <div className="flex items-center gap-2 text-sm">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Answered {Object.keys(member.response.answers).length} of {questions.length} questions
            </span>
          </div>
        )}

        {member.responseTime && (
          <div className="flex items-center gap-2 text-sm">
            <Timer className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Response time: {formatResponseTime(member.responseTime)}
            </span>
          </div>
        )}

        {member.lastReminderSent && (
          <div className="flex items-center gap-2 text-sm">
            <Send className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Last reminder: {new Date(member.lastReminderSent).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {member.response && (
          <ModernButton
            variant="ghost"
            size="sm"
            onClick={() => onViewResponse(member.id)}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-1" />
            View Response
          </ModernButton>
        )}

        {statusConfig.actionable && (
          <ModernButton
            variant={member.reminderCount > 0 ? 'outline' : 'secondary'}
            size="sm"
            onClick={() => onSendReminder(member.id)}
            className="flex-1"
          >
            <Send className="w-4 h-4 mr-1" />
            {getReminderText()}
          </ModernButton>
        )}
      </div>

      {/* Reminder Count Badge */}
      {member.reminderCount > 0 && (
        <div className="mt-2 text-xs text-center text-muted-foreground">
          {member.reminderCount} reminder{member.reminderCount > 1 ? 's' : ''} sent
          {deliveryType === 'channel' ? ' via channel mention' : ' via DM'}
        </div>
      )}
    </motion.div>
  );
};
