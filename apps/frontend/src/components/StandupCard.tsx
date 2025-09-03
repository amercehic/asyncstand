import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Star,
  Play,
  Pause,
  Settings,
  Eye,
  Send,
  Activity,
  TrendingUp,
  Timer,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { ModernButton } from '@/components/ui';
import type { ActiveStandup } from '@/types';

interface StandupCardProps {
  standup: ActiveStandup;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onViewResponses: () => void;
  onSettings?: () => void;
  onToggleActive?: () => void;
  onSendReminder?: () => void;
  index?: number;
}

export const StandupCard = React.memo<StandupCardProps>(
  ({
    standup,
    isFavorite = false,
    onToggleFavorite,
    onViewResponses,
    onSettings,
    onToggleActive,
    onSendReminder,
    index = 0,
  }) => {
    const [isHovered, setIsHovered] = useState(false);

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
        {/* Favorite Badge */}
        {onToggleFavorite && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={e => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`absolute top-3 right-3 z-10 p-2 rounded-lg transition-all ${
              isFavorite
                ? 'bg-yellow-500/20 text-yellow-500'
                : 'bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-yellow-500'
            }`}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </motion.button>
        )}

        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="relative">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"
              >
                <Calendar className="w-7 h-7 text-white" />
              </motion.div>
              {standup.state === 'collecting' && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              )}
            </div>
            <div
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                standup.state === 'collecting'
                  ? 'bg-emerald-100 text-emerald-700'
                  : standup.state === 'completed'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600'
              }`}
            >
              {standup.state === 'collecting' ? 'Active' : standup.state}
            </div>
          </div>
          <h3 className="font-bold text-xl text-slate-800 group-hover:text-blue-600 transition-colors mb-1">
            {standup.teamName}
          </h3>
          <p className="text-sm text-slate-500 font-medium">
            {new Date(standup.targetDate).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
            {standup.timeLocal && <span className="ml-2">at {standup.timeLocal}</span>}
          </p>
        </div>

        {/* Stats Section */}
        <div className="p-6 space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">Response Progress</span>
              <span className="text-sm font-bold text-slate-800">
                {standup.respondedMembers}/{standup.totalMembers}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className={`h-full rounded-full ${
                  progressPercentage === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
              />
            </div>
          </div>

          {/* Status Pills */}
          <div className="flex flex-wrap gap-2">
            {completedMembers > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-medium">
                <CheckCircle2 className="w-3 h-3" />
                {completedMembers} done
              </div>
            )}
            {overdueMembers > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-medium">
                <AlertTriangle className="w-3 h-3" />
                {overdueMembers} overdue
              </div>
            )}
            {notStartedMembers > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">
                <Timer className="w-3 h-3" />
                {notStartedMembers} pending
              </div>
            )}
            {standup.participationStreak && standup.participationStreak > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-medium">
                <TrendingUp className="w-3 h-3" />
                {standup.participationStreak}d streak
              </div>
            )}
          </div>
        </div>

        {/* Delivery Type & Channel */}
        <div className="px-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {standup.deliveryType === 'channel' ? (
                <>
                  <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-green-600">
                    #{standup.targetChannel?.name || 'Channel'}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                    <Send className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-blue-600">Direct messages</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{getActivityStatus()}</span>
            </div>
          </div>

          {/* Health Score */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Response Health</span>
              <span className={`text-xs font-medium ${healthColor}`}>{healthScore}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${healthScore}%` }}
                transition={{ duration: 1, delay: 0.2 }}
                className={`h-full rounded-full ${
                  healthScore > 70
                    ? 'bg-green-500'
                    : healthScore > 40
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-2 bg-muted/30 border-t border-border flex items-center gap-1">
          <ModernButton
            variant="ghost"
            size="sm"
            onClick={onViewResponses}
            className="flex-1 text-xs h-8"
            title="View responses"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="ml-1 hidden sm:inline">Responses</span>
          </ModernButton>

          {onSendReminder && standup.state === 'collecting' && progressPercentage < 100 && (
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={onSendReminder}
              className="flex-1 text-xs h-8"
              title="Send reminder"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="ml-1 hidden sm:inline">Remind</span>
            </ModernButton>
          )}

          {onSettings && (
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={onSettings}
              className="flex-1 text-xs h-8"
              title="Standup settings"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="ml-1 hidden sm:inline">Settings</span>
            </ModernButton>
          )}

          {onToggleActive && (
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={onToggleActive}
              className="flex-1 text-xs h-8"
              title={standup.state === 'collecting' ? 'Pause standup' : 'Resume standup'}
            >
              {standup.state === 'collecting' ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span className="ml-1 hidden sm:inline">
                {standup.state === 'collecting' ? 'Pause' : 'Resume'}
              </span>
            </ModernButton>
          )}
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
