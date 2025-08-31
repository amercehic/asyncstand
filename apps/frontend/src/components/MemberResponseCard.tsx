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
      className={`bg-white rounded-xl border-2 hover:shadow-xl transition-all duration-300 h-full flex flex-col overflow-hidden group ${statusConfig.bgColor} ${className}`}
    >
      {/* Enhanced Header with Status Banner */}
      <div className="relative">
        <div
          className={`h-2 ${
            member.status === 'completed'
              ? 'bg-gradient-to-r from-green-400 to-green-500'
              : member.status === 'in_progress'
                ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                : member.status === 'overdue'
                  ? 'bg-gradient-to-r from-red-400 to-red-500'
                  : 'bg-gradient-to-r from-gray-300 to-gray-400'
          }`}
        />

        <div className="p-5 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-14 h-14 rounded-full object-cover border-3 border-white shadow-md"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                    <User className="w-7 h-7 text-white" />
                  </div>
                )}
                <div
                  className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-3 border-white shadow-lg flex items-center justify-center ${
                    member.status === 'completed'
                      ? 'bg-green-500'
                      : member.status === 'in_progress'
                        ? 'bg-blue-500'
                        : member.status === 'overdue'
                          ? 'bg-red-500'
                          : 'bg-gray-400'
                  }`}
                >
                  <StatusIcon className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">
                  {member.name}
                </h4>
                {member.email && <p className="text-sm text-slate-500 mb-1">{member.email}</p>}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      member.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : member.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-700'
                          : member.status === 'overdue'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {statusConfig.label}
                  </span>
                  {member.isLate && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-md font-medium">
                      ⏰ Late
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Progress Section */}
          <div className="space-y-4 mb-4">
            {/* Progress Bar for Question Completion */}
            {member.response && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Question Progress
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {Object.keys(member.response.answers).length}/{questions.length}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(Object.keys(member.response.answers).length / questions.length) * 100}%`,
                    }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className={`h-full rounded-full ${
                      member.status === 'completed'
                        ? 'bg-gradient-to-r from-green-500 to-green-400'
                        : 'bg-gradient-to-r from-blue-500 to-blue-400'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              {member.responseTime && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Timer className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-semibold text-slate-600">Response Time</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    {formatResponseTime(member.responseTime)}
                  </p>
                </div>
              )}

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Send className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-600">Reminders</span>
                </div>
                <p className="text-sm font-bold text-slate-800">{member.reminderCount || 0} sent</p>
              </div>
            </div>

            {/* Last Activity */}
            {member.lastReminderSent && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700">Last Reminder</span>
                </div>
                <p className="text-sm text-amber-700">
                  {new Date(member.lastReminderSent).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
                <p className="text-xs text-amber-600">
                  via {deliveryType === 'channel' ? 'channel mention' : 'direct message'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Actions Footer */}
      <div className="mt-auto bg-gradient-to-r from-slate-50 to-slate-100 p-4 border-t border-slate-200">
        <div className="flex gap-2">
          <ModernButton
            variant="secondary"
            size="sm"
            onClick={() => onViewResponse(member.id)}
            disabled={member.status === 'not_started'}
            className={`flex-1 font-semibold ${
              member.status !== 'not_started'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 border-0 shadow-md'
                : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            }`}
            title={
              member.status === 'not_started'
                ? 'Member has not started answering questions yet'
                : member.status === 'completed'
                  ? 'View completed answers'
                  : member.status === 'overdue'
                    ? 'View partial answers (overdue)'
                    : 'View partial answers'
            }
          >
            <Eye className="w-4 h-4 mr-2" />
            {member.status === 'completed'
              ? 'View Answers'
              : member.status === 'in_progress'
                ? 'View Progress'
                : member.status === 'overdue'
                  ? 'View Partial'
                  : 'Not Started'}
          </ModernButton>

          {statusConfig.actionable && (
            <ModernButton
              variant="outline"
              size="sm"
              onClick={() => onSendReminder(member.id)}
              className={`flex-1 font-semibold ${
                member.reminderCount > 0
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 hover:from-orange-600 hover:to-red-600 shadow-md'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 hover:from-indigo-600 hover:to-purple-700 shadow-md'
              }`}
            >
              <Send className="w-4 h-4 mr-2" />
              {getReminderText()}
            </ModernButton>
          )}
        </div>

        {/* Enhanced Status Footer */}
        <div className="mt-3 pt-3 border-t border-slate-300">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">
              {member.status === 'completed'
                ? '✅ Response complete'
                : member.status === 'in_progress'
                  ? '⏳ Answering questions...'
                  : member.status === 'overdue'
                    ? '🚨 Overdue response'
                    : '⏸️ Not started yet'}
            </span>
            {member.completionPercentage !== undefined && (
              <span className="font-semibold text-slate-700">
                {Math.round(member.completionPercentage)}% done
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
