import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Star,
  Settings,
  Eye,
  Send,
  Activity,
  TrendingUp,
  Timer,
  MessageSquare,
  Users,
} from 'lucide-react';
import { ModernButton } from '@/components/ui';
import type { ActiveStandup } from '@/types';

interface StandupCardProps {
  standup: ActiveStandup;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onViewResponses: () => void;
  onSettings?: () => void;
  onSendToChannel?: () => void;
  onMemberReminders?: () => void;
  index?: number;
}

export const StandupCard = React.memo<StandupCardProps>(
  ({
    standup,
    isFavorite = false,
    onToggleFavorite,
    onViewResponses,
    onSettings,
    onSendToChannel,
    onMemberReminders,
    index = 0,
  }) => {
    const [isHovered, setIsHovered] = useState(false);

    // Get the standup title from the actual API data
    const getStandupTitle = () => {
      // Use the configName field if available (this is the real standup config name)
      if (standup.configName) {
        return standup.configName;
      }

      // Fall back to a generic name if no config name is provided
      return 'Standup';
    };

    const progressPercentage = useMemo(
      () =>
        standup.totalMembers > 0 ? (standup.respondedMembers / standup.totalMembers) * 100 : 0,
      [standup.respondedMembers, standup.totalMembers]
    );

    const overdueMembers = useMemo(
      () => standup.members?.filter(m => m.status === 'overdue').length || 0,
      [standup.members]
    );

    const completedMembers = useMemo(
      () => standup.members?.filter(m => m.status === 'completed').length || 0,
      [standup.members]
    );

    const notStartedMembers = useMemo(
      () => standup.members?.filter(m => m.status === 'not_started').length || 0,
      [standup.members]
    );

    const healthScore = useMemo(() => {
      let score = 0;

      if (progressPercentage === 100) {
        score = 100;
      } else if (progressPercentage >= 80) {
        score = 85;
      } else if (progressPercentage >= 60) {
        score = 70;
      } else if (progressPercentage >= 40) {
        score = 50;
      } else {
        score = 30;
      }

      if (overdueMembers > 0) {
        score -= overdueMembers * 5;
      }

      if (standup.participationStreak && standup.participationStreak > 5) {
        score += 10;
      }

      return Math.max(0, Math.min(100, score));
    }, [progressPercentage, overdueMembers, standup.participationStreak]);

    const healthColor = useMemo(
      () =>
        healthScore > 70 ? 'text-green-500' : healthScore > 40 ? 'text-yellow-500' : 'text-red-500',
      [healthScore]
    );

    const formatTime = (minutes?: number) => {
      if (!minutes) return 'N/A';
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    };

    const getActivityStatus = () => {
      const now = new Date();
      const targetDate = new Date(standup.targetDate);
      const hoursDiff = Math.abs(now.getTime() - targetDate.getTime()) / (1000 * 60 * 60);

      if (hoursDiff < 1) return 'Just now';
      if (hoursDiff < 24) return `${Math.floor(hoursDiff)}h ago`;
      const daysDiff = Math.floor(hoursDiff / 24);
      return `${daysDiff}d ago`;
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -4 }}
        transition={{
          duration: 0.4,
          delay: index * 0.1,
          ease: 'easeOut',
        }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="bg-white border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 overflow-hidden group relative rounded-2xl"
      >
        {/* Fixed Header Layout */}
        <div className="relative p-6 pb-4 border-b border-slate-100">
          {/* Favorite Star - Fixed positioning to avoid overlap */}
          {onToggleFavorite && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={e => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={`absolute top-4 right-4 z-10 p-2 rounded-lg transition-all ${
                isFavorite
                  ? 'bg-yellow-500/20 text-yellow-500'
                  : 'bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-yellow-500'
              }`}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </motion.button>
          )}

          <div className="flex items-start gap-4 mb-4 pr-12">
            <div className="relative">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"
              >
                <Calendar className="w-8 h-8 text-white" />
              </motion.div>
              {standup.state === 'collecting' && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white animate-pulse flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              )}
            </div>

            <div className="flex-1">
              {/* Status Badge - Moved here to avoid star overlap */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${
                    standup.state === 'collecting'
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : standup.state === 'completed'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : standup.state === 'pending'
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  {standup.state === 'collecting'
                    ? '🟢 Active'
                    : standup.state === 'completed'
                      ? '✅ Complete'
                      : standup.state === 'pending'
                        ? '⏳ Scheduled'
                        : standup.state === 'cancelled'
                          ? '❌ Cancelled'
                          : '⏸️ Paused'}
                </div>
                {standup.questions && (
                  <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-md">
                    {standup.questions.length} questions
                  </span>
                )}
              </div>

              {/* Main Title - Only standup name */}
              <h3 className="font-bold text-2xl text-slate-800 group-hover:text-blue-600 transition-colors mb-2">
                {getStandupTitle()}
              </h3>

              {/* Team name and metadata */}
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5">👥 {standup.teamName}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500">
                    {standup.totalMembers} member{standup.totalMembers !== 1 ? 's' : ''}
                  </span>
                </p>
                <p className="text-sm text-slate-500 font-medium">
                  📅{' '}
                  {new Date(standup.targetDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {standup.timeLocal && <span className="ml-2">⏰ {standup.timeLocal}</span>}
                  {standup.timezone && <span className="text-xs ml-1">({standup.timezone})</span>}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Stats Section - Fixed Height */}
        <div className="p-6 flex-1 flex flex-col justify-between min-h-[200px]">
          {/* Progress Bar with Enhanced Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">Response Progress</span>
                <p className="text-xs text-slate-500">
                  {standup.respondedMembers} of {standup.totalMembers} responses •{' '}
                  {Math.round(progressPercentage)}% complete
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-slate-800">
                  {standup.respondedMembers}/{standup.totalMembers}
                </span>
                {progressPercentage === 100 && (
                  <div className="text-xs text-emerald-600 font-medium">🎉 All done!</div>
                )}
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className={`h-full rounded-full ${
                  progressPercentage === 100
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    : 'bg-gradient-to-r from-blue-500 to-blue-400'
                }`}
              />
            </div>
          </div>

          {/* Consistent Status Grid - Always show all categories - Fixed at bottom */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {/* Completed - Always show */}
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                completedMembers > 0
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-slate-50 border border-slate-200 text-slate-500'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{completedMembers} completed</span>
            </div>

            {/* Overdue - Always show */}
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                overdueMembers > 0
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-slate-50 border border-slate-200 text-slate-500'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{overdueMembers} overdue</span>
            </div>

            {/* Pending - Always show */}
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                notStartedMembers > 0
                  ? 'bg-amber-50 border border-amber-200 text-amber-700'
                  : 'bg-slate-50 border border-slate-200 text-slate-500'
              }`}
            >
              <Timer className="w-4 h-4" />
              <span>{notStartedMembers} pending</span>
            </div>

            {/* Streak or In Progress - Show one or the other */}
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                standup.participationStreak && standup.participationStreak > 0
                  ? 'bg-purple-50 border border-purple-200 text-purple-700'
                  : standup.totalMembers - completedMembers - overdueMembers - notStartedMembers > 0
                    ? 'bg-blue-50 border border-blue-200 text-blue-700'
                    : 'bg-slate-50 border border-slate-200 text-slate-500'
              }`}
            >
              {standup.participationStreak && standup.participationStreak > 0 ? (
                <>
                  <TrendingUp className="w-4 h-4" />
                  <span>{standup.participationStreak}d streak</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  <span>
                    {standup.totalMembers - completedMembers - overdueMembers - notStartedMembers}{' '}
                    in progress
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Simplified Info Section - Fixed Height */}
        <div className="px-6 pb-4 min-h-[120px] flex flex-col justify-between">
          {/* Delivery Method - Always consistent */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {standup.deliveryType === 'channel' ? (
                <>
                  <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-green-400 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-green-700">
                      #{standup.targetChannel?.name || 'Channel'}
                    </span>
                    <p className="text-xs text-slate-500">Public delivery</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-400 rounded-lg flex items-center justify-center">
                    <Send className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-blue-700">Direct Messages</span>
                    <p className="text-xs text-slate-500">Private delivery</p>
                  </div>
                </>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs">{getActivityStatus()}</span>
              </div>
            </div>
          </div>

          {/* Health Score - Simplified and always visible */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-3 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-700">
                  Health Score • {standup.questions?.length || 0} questions
                </span>
              </div>
              <span className={`text-sm font-bold ${healthColor}`}>{healthScore}%</span>
            </div>
            <div className="w-full bg-white rounded-full h-2 overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${healthScore}%` }}
                transition={{ duration: 1, delay: 0.2 }}
                className={`h-full rounded-full ${
                  healthScore > 70
                    ? 'bg-gradient-to-r from-green-500 to-green-400'
                    : healthScore > 40
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                      : 'bg-gradient-to-r from-red-500 to-red-400'
                }`}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-slate-500">
                {healthScore > 80
                  ? '🟢 Excellent'
                  : healthScore > 60
                    ? '🟡 Good'
                    : healthScore > 40
                      ? '🟠 Fair'
                      : '🔴 Poor'}
              </p>
              <p className="text-xs text-slate-500">
                {standup.questions?.length
                  ? `${standup.questions.length} questions`
                  : 'No questions'}
              </p>
            </div>
          </div>
        </div>

        {/* Enhanced Actions Bar - Always Consistent */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-t border-slate-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            {/* Primary Action - View Responses (Always visible) */}
            <ModernButton
              variant="secondary"
              size="sm"
              onClick={onViewResponses}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-sm hover:from-blue-600 hover:to-blue-700 font-semibold text-xs h-9"
              title="View responses and details"
            >
              <Eye className="w-4 h-4 mr-1.5" />
              <span>View Responses</span>
            </ModernButton>

            {/* Secondary Action - Context dependent */}
            {onSettings ? (
              <ModernButton
                variant="outline"
                size="sm"
                onClick={onSettings}
                className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs h-9"
                title="Standup settings and configuration"
              >
                <Settings className="w-4 h-4 mr-1.5" />
                <span>Settings</span>
              </ModernButton>
            ) : standup.state === 'collecting' &&
              onSendToChannel &&
              standup.deliveryType === 'channel' ? (
              <ModernButton
                variant="outline"
                size="sm"
                onClick={onSendToChannel}
                className="border-green-300 text-green-700 hover:bg-green-50 font-semibold text-xs h-9"
                title="Send standup summary to channel"
              >
                <MessageSquare className="w-4 h-4 mr-1.5" />
                <span>Send</span>
              </ModernButton>
            ) : standup.state === 'collecting' && progressPercentage < 100 && onMemberReminders ? (
              <ModernButton
                variant="outline"
                size="sm"
                onClick={onMemberReminders}
                className="border-orange-300 text-orange-700 hover:bg-orange-50 font-semibold text-xs h-9"
                title="Send reminders to members"
              >
                <Users className="w-4 h-4 mr-1.5" />
                <span>Remind</span>
              </ModernButton>
            ) : (
              <div className="flex items-center justify-center h-9 bg-slate-100 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-500 font-medium">
                  {standup.state === 'completed'
                    ? '✅ Complete'
                    : standup.state === 'collecting'
                      ? '⏳ Active'
                      : standup.state === 'pending'
                        ? '⏳ Scheduled'
                        : standup.state === 'cancelled'
                          ? '❌ Cancelled'
                          : '⏸️ Paused'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Hover Preview */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 right-0 mb-2 p-3 bg-popover rounded-lg border border-border shadow-xl z-20"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Last activity: {getActivityStatus()}</span>
                </div>
                {standup.avgResponseTime && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">
                      Avg response time: {formatTime(standup.avgResponseTime)}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm">
                    {completedMembers} completed, {overdueMembers} overdue
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
);

StandupCard.displayName = 'StandupCard';
