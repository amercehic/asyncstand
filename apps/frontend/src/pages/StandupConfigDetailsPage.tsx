import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ModernButton, toast } from '@/components/ui';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Hash,
  MessageSquare,
  Edit,
  Pause,
  Play,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Target,
  Timer,
  UserCheck,
  Bell,
  ChevronRight,
  Mail,
  Settings,
} from 'lucide-react';
import { standupsApi, teamsApi } from '@/lib/api';
import type { StandupConfig, Team } from '@/types';
import type { StandupMetrics, MemberStats, RecentInstance } from '@/types/standup-metrics';
import { StandupDeliveryType } from '@/types/backend';

type TabType = 'overview' | 'activity' | 'members' | 'settings';

export const StandupConfigDetailsPage = React.memo(() => {
  const { standupId } = useParams<{ standupId: string }>();
  const navigate = useNavigate();

  const [standup, setStandup] = useState<StandupConfig | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [metrics, setMetrics] = useState<StandupMetrics | null>(null);
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [recentInstances, setRecentInstances] = useState<RecentInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isPausing, setIsPausing] = useState(false);

  useEffect(() => {
    loadStandupDetails();
  }, [standupId]);

  const loadStandupDetails = async () => {
    if (!standupId) return;

    try {
      setIsLoading(true);

      // Fetch standup configuration
      const standupData = await standupsApi.getStandupConfig(standupId);
      setStandup(standupData);

      // Fetch team details
      if (standupData.teamId) {
        const teamData = await teamsApi.getTeam(standupData.teamId);
        setTeam(teamData);
      }

      // Fetch real metrics and data
      const [metricsData, memberStatsData, recentInstancesData] = await Promise.all([
        standupsApi.getStandupMetrics(standupId),
        standupsApi.getMemberStats(standupId),
        standupsApi.getRecentInstances(standupId),
      ]);

      setMetrics(metricsData);
      setMemberStats(memberStatsData);
      setRecentInstances(recentInstancesData);
    } catch (error) {
      console.error('Error loading standup details:', error);
      toast.error('Failed to load standup details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePause = async () => {
    if (!standup) return;

    setIsPausing(true);
    try {
      await standupsApi.updateStandup(standup.id, {
        isActive: !standup.isActive,
      });
      setStandup(prev => (prev ? { ...prev, isActive: !prev.isActive } : null));
      toast.success(standup.isActive ? 'Standup paused' : 'Standup resumed');
    } catch {
      toast.error('Failed to update standup status');
    } finally {
      setIsPausing(false);
    }
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    toast.info('Export feature coming soon!');
  };

  const handleSendReminder = () => {
    // TODO: Implement send reminder
    toast.info('Reminder sent to pending members');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'collecting':
        return 'text-blue-600 bg-blue-50';
      case 'cancelled':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getResponseRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDaysList = (days: string[]) => {
    if (days.length === 7) return 'Every day';
    if (days.length === 5 && !days.includes('saturday') && !days.includes('sunday')) {
      return 'Weekdays';
    }
    if (days.length === 2 && days.includes('saturday') && days.includes('sunday')) {
      return 'Weekends';
    }
    return days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="h-64 bg-muted rounded" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-muted rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!standup) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Standup not found</h2>
            <ModernButton variant="outline" onClick={() => navigate(-1)}>
              Go Back
            </ModernButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <ModernButton variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </ModernButton>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-4">
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    standup.isActive
                      ? 'bg-gradient-to-br from-primary to-primary/80'
                      : 'bg-gradient-to-br from-gray-400 to-gray-500'
                  }`}
                >
                  <Calendar className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{standup.name}</h1>
                  <p className="text-muted-foreground">
                    {team?.name || 'Team'} • {getDaysList(standup.schedule.days)} at{' '}
                    {standup.schedule.time}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
                        standup.isActive
                          ? 'text-green-700 bg-green-50 border-green-200'
                          : 'text-gray-600 bg-gray-50 border-gray-200'
                      }`}
                    >
                      {standup.isActive ? (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          Active
                        </>
                      ) : (
                        'Paused'
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {standup.deliveryType === StandupDeliveryType.channel ? (
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          Channel delivery
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          Direct messages
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <ModernButton
                  variant="outline"
                  size="sm"
                  onClick={handleTogglePause}
                  disabled={isPausing}
                  className="gap-2 w-[90px]"
                >
                  {isPausing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {standup.isActive ? 'Pausing...' : 'Resuming...'}
                    </>
                  ) : standup.isActive ? (
                    <>
                      <Pause className="w-4 h-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Resume
                    </>
                  )}
                </ModernButton>
                <ModernButton variant="outline" size="sm" onClick={handleExport} className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </ModernButton>
                <ModernButton
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/standups/${standup.id}/edit`)}
                  className="gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </ModernButton>
              </div>
            </div>

            {/* Metrics Summary */}
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Response Rate</span>
                    {metrics.trend === 'up' ? (
                      <TrendingUp className="w-3 h-3 text-green-600" />
                    ) : metrics.trend === 'down' ? (
                      <TrendingDown className="w-3 h-3 text-red-600" />
                    ) : (
                      <Activity className="w-3 h-3 text-gray-600" />
                    )}
                  </div>
                  <div
                    className={`text-2xl font-bold ${getResponseRateColor(metrics.averageResponseRate)}`}
                  >
                    {metrics.averageResponseRate}%
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Avg Response Time
                    </span>
                    <Timer className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">{metrics.averageResponseTime}m</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Completion Streak
                    </span>
                    <Target className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">{metrics.completionStreak} days</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Total Instances
                    </span>
                    <BarChart3 className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">{metrics.totalInstances}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg w-fit">
            {(['overview', 'activity', 'members', 'settings'] as TabType[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Questions */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Questions ({standup.questions.length})
                </h2>
                <div className="space-y-3">
                  {standup.questions.map((question, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                      <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <p className="text-sm text-foreground">{question}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schedule Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Schedule Configuration
                  </h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Days</span>
                      <span className="text-sm font-medium">
                        {getDaysList(standup.schedule.days)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Time</span>
                      <span className="text-sm font-medium">{standup.schedule.time}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Timezone</span>
                      <span className="text-sm font-medium">{standup.schedule.timezone}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">Delivery Type</span>
                      <span className="text-sm font-medium">
                        {standup.deliveryType === StandupDeliveryType.channel
                          ? 'Channel'
                          : 'Direct Message'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Performance Insights */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Performance Insights
                  </h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Best Day</span>
                      <span className="text-sm font-medium text-green-600">{metrics?.bestDay}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Challenging Day</span>
                      <span className="text-sm font-medium text-orange-600">
                        {metrics?.worstDay}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Completed</span>
                      <span className="text-sm font-medium">
                        {metrics?.completedInstances}/{metrics?.totalInstances}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">Success Rate</span>
                      <span className="text-sm font-medium">
                        {metrics &&
                          Math.round((metrics.completedInstances / metrics.totalInstances) * 100)}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'activity' && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Recent Activity
                  </h2>
                  {recentInstances.some(i => i.status === 'collecting') && (
                    <ModernButton
                      variant="outline"
                      size="sm"
                      onClick={handleSendReminder}
                      className="gap-2"
                    >
                      <Bell className="w-4 h-4" />
                      Send Reminder
                    </ModernButton>
                  )}
                </div>

                <div className="space-y-4">
                  {recentInstances.map(instance => (
                    <div
                      key={instance.id}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/standups/instances/${instance.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            instance.status === 'completed'
                              ? 'bg-green-100'
                              : instance.status === 'collecting'
                                ? 'bg-blue-100'
                                : 'bg-gray-100'
                          }`}
                        >
                          {instance.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : instance.status === 'collecting' ? (
                            <Clock className="w-5 h-5 text-blue-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-gray-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">
                            {new Date(instance.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {instance.respondedCount}/{instance.totalCount} responded
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p
                            className={`text-lg font-semibold ${getResponseRateColor(instance.responseRate)}`}
                          >
                            {instance.responseRate}%
                          </p>
                          <p className="text-xs text-muted-foreground">Response rate</p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(instance.status)}`}
                        >
                          {instance.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>

                {recentInstances.length === 0 && (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No activity yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'members' && (
            <motion.div
              key="members"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Team Members ({memberStats.length})
                </h2>

                <div className="space-y-4">
                  {memberStats.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {member.name
                              .split(' ')
                              .map(n => n[0])
                              .join('')}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p
                            className={`text-lg font-semibold ${getResponseRateColor(member.responseRate)}`}
                          >
                            {member.responseRate}%
                          </p>
                          <p className="text-xs text-muted-foreground">Response rate</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold">{member.averageResponseTime}m</p>
                          <p className="text-xs text-muted-foreground">Avg time</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold">{member.streak}</p>
                          <p className="text-xs text-muted-foreground">Day streak</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1">
                            {member.lastResponseDate &&
                            new Date(member.lastResponseDate).toDateString() ===
                              new Date().toDateString() ? (
                              <UserCheck className="w-4 h-4 text-green-600" />
                            ) : (
                              <UserCheck className="w-4 h-4 text-gray-400" />
                            )}
                            <p className="text-sm text-muted-foreground">
                              {member.lastResponseDate
                                ? new Date(member.lastResponseDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : 'Never'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Configuration Details
                </h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">
                        Basic Information
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between py-2 border-b border-border/50">
                          <span className="text-sm text-muted-foreground">ID</span>
                          <span className="text-sm font-mono">{standup.id.slice(0, 8)}...</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border/50">
                          <span className="text-sm text-muted-foreground">Created</span>
                          <span className="text-sm">
                            {new Date(standup.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border/50">
                          <span className="text-sm text-muted-foreground">Updated</span>
                          <span className="text-sm">
                            {new Date(standup.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">
                        Advanced Settings
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between py-2 border-b border-border/50">
                          <span className="text-sm text-muted-foreground">Response Timeout</span>
                          <span className="text-sm">24 hours</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border/50">
                          <span className="text-sm text-muted-foreground">Reminder Before</span>
                          <span className="text-sm">30 minutes</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border/50">
                          <span className="text-sm text-muted-foreground">Auto-summary</span>
                          <span className="text-sm">Enabled</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Edit Configuration</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Modify questions, schedule, and delivery settings
                        </p>
                      </div>
                      <ModernButton
                        variant="outline"
                        onClick={() => navigate(`/standups/${standup.id}/edit`)}
                        className="gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit Settings
                      </ModernButton>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

StandupConfigDetailsPage.displayName = 'StandupConfigDetailsPage';
