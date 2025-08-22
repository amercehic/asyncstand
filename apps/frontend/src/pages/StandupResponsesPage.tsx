import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Timer,
  Search,
  Filter,
  Download,
  Send,
  RefreshCw,
  Activity,
  Eye,
  Zap,
  X,
  SortAsc,
  Trophy,
} from 'lucide-react';
import { ModernButton, Dropdown, toast } from '@/components/ui';
import { ResponseDetailsModal } from '@/components/ResponseDetailsModal';
import { SmartReminderModal } from '@/components/SmartReminderModal';
import { MemberResponseCard } from '@/components/MemberResponseCard';
import { standupsApi } from '@/lib/api';
import type { ActiveStandup, StandupMember, DetailedStandupResponse } from '@/types';

type FilterType = 'all' | 'completed' | 'in_progress' | 'not_started' | 'overdue';
type SortType = 'name' | 'status' | 'response_time' | 'completion';
type ViewType = 'grid' | 'table' | 'timeline';

interface ResponseStats {
  totalMembers: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  overdueCount: number;
  avgResponseTime: number;
  completionRate: number;
  participationStreak: number;
  topPerformers: string[];
}

const StatsCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; isPositive: boolean };
}> = ({ title, value, subtitle, icon: Icon, color, trend }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-gradient-to-br ${color} backdrop-blur-sm rounded-xl p-4 border border-border/50`}
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs text-muted-foreground">{title}</p>
          {trend && (
            <span
              className={`text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}
            >
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className={`p-2 rounded-lg bg-background/50`}>
        <Icon className="w-5 h-5 text-foreground" />
      </div>
    </div>
  </motion.div>
);

export const StandupResponsesPage: React.FC = () => {
  const { standupId } = useParams<{ standupId: string }>();
  const navigate = useNavigate();

  const [standup, setStandup] = useState<ActiveStandup | null>(null);
  const [members, setMembers] = useState<StandupMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<StandupMember | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<DetailedStandupResponse | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSmartReminderModalOpen, setIsSmartReminderModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('status');
  const [viewType, setViewType] = useState<ViewType>('grid');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (standupId) {
      fetchStandupData();
    }
  }, [standupId]);

  const fetchStandupData = async () => {
    setIsLoading(true);
    try {
      const [standupData, membersData] = await Promise.all([
        standupsApi.getStandupInstance(standupId!),
        standupsApi.getStandupMembers(standupId!),
      ]);
      setStandup(standupData);
      setMembers(membersData);
    } catch (error) {
      console.error('Failed to fetch standup data:', error);
      toast.error('Failed to load standup data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStandupData();
    setIsRefreshing(false);
    toast.success('Data refreshed');
  };

  const handleViewMemberDetails = async (member: StandupMember) => {
    setSelectedMember(member);
    try {
      const response = await standupsApi.getMemberResponse(standupId!, member.id);
      setSelectedResponse(response);
    } catch (error) {
      console.error('Failed to fetch member response:', error);
      setSelectedResponse(null);
    }
    setIsDetailsModalOpen(true);
  };

  const handleSendReminder = async (memberIds?: string[]) => {
    const targetIds = memberIds || selectedMembers;
    if (targetIds.length === 0) {
      toast.error('Please select members to send reminders');
      return;
    }

    try {
      await standupsApi.sendReminders(standupId!, { memberIds: targetIds });
      toast.success(`Reminder sent to ${targetIds.length} member(s)`);
      setSelectedMembers([]);
    } catch (error) {
      console.error('Failed to send reminders:', error);
      toast.error('Failed to send reminders');
    }
  };

  const handleExportResponses = () => {
    toast.info('Export functionality coming soon!');
  };

  const handleToggleMemberSelection = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSelectAll = () => {
    if (selectedMembers.length === filteredAndSortedMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(filteredAndSortedMembers.map(m => m.id));
    }
  };

  const stats = useMemo<ResponseStats>(() => {
    const completed = members.filter(m => m.status === 'completed');
    const inProgress = members.filter(m => m.status === 'in_progress');
    const notStarted = members.filter(m => m.status === 'not_started');
    const overdue = members.filter(m => m.status === 'overdue');

    const responseTimes = members.filter(m => m.responseTime).map(m => m.responseTime!);

    const avgTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    const topPerformers = completed
      .sort((a, b) => (a.responseTime || 999) - (b.responseTime || 999))
      .slice(0, 3)
      .map(m => m.name);

    return {
      totalMembers: members.length,
      completedCount: completed.length,
      inProgressCount: inProgress.length,
      notStartedCount: notStarted.length,
      overdueCount: overdue.length,
      avgResponseTime: avgTime,
      completionRate: members.length > 0 ? (completed.length / members.length) * 100 : 0,
      participationStreak: standup?.participationStreak || 0,
      topPerformers,
    };
  }, [members, standup]);

  const filteredAndSortedMembers = useMemo(() => {
    let filtered = [...members];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        member =>
          member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          member.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    switch (filterType) {
      case 'completed':
        filtered = filtered.filter(m => m.status === 'completed');
        break;
      case 'in_progress':
        filtered = filtered.filter(m => m.status === 'in_progress');
        break;
      case 'not_started':
        filtered = filtered.filter(m => m.status === 'not_started');
        break;
      case 'overdue':
        filtered = filtered.filter(m => m.status === 'overdue');
        break;
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortType) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status': {
          const statusOrder = { completed: 0, in_progress: 1, overdue: 2, not_started: 3 };
          return statusOrder[a.status] - statusOrder[b.status];
        }
        case 'response_time':
          return (a.responseTime || 999999) - (b.responseTime || 999999);
        case 'completion': {
          const aCompletion = a.completionPercentage || 0;
          const bCompletion = b.completionPercentage || 0;
          return bCompletion - aCompletion;
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [members, searchQuery, filterType, sortType]);

  const formatTime = (minutes?: number) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!standup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Standup not found</h2>
          <ModernButton onClick={() => navigate('/standups')}>Back to Standups</ModernButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-4">
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={() => navigate('/standups')}
              className="group"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back
            </ModernButton>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{standup.teamName}</h1>
              <p className="text-sm text-muted-foreground">
                {new Date(standup.targetDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {standup.timeLocal && ` • ${standup.timeLocal}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="group"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}
              />
              Refresh
            </ModernButton>
            <ModernButton variant="secondary" size="sm" onClick={handleExportResponses}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </ModernButton>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatsCard
            title="Completion Rate"
            value={`${Math.round(stats.completionRate)}%`}
            subtitle={`${stats.completedCount} of ${stats.totalMembers}`}
            icon={CheckCircle2}
            color="from-green-500/10 to-green-500/20"
            trend={{ value: 5, isPositive: true }}
          />
          <StatsCard
            title="In Progress"
            value={stats.inProgressCount}
            subtitle="Currently responding"
            icon={Clock}
            color="from-blue-500/10 to-blue-500/20"
          />
          <StatsCard
            title="Not Started"
            value={stats.notStartedCount}
            subtitle="Haven't started"
            icon={Timer}
            color="from-gray-500/10 to-gray-500/20"
          />
          <StatsCard
            title="Overdue"
            value={stats.overdueCount}
            subtitle="Need reminders"
            icon={AlertTriangle}
            color="from-red-500/10 to-red-500/20"
          />
          <StatsCard
            title="Avg Response"
            value={formatTime(stats.avgResponseTime)}
            subtitle="Response time"
            icon={Activity}
            color="from-purple-500/10 to-purple-500/20"
          />
        </div>

        {/* Top Performers */}
        {stats.topPerformers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl p-4 mb-6 border border-yellow-500/20"
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-yellow-600" />
              <span className="text-sm font-semibold text-foreground">Top Performers:</span>
              <div className="flex items-center gap-2">
                {stats.topPerformers.map((name, index) => (
                  <span
                    key={name}
                    className="px-3 py-1 bg-background/80 rounded-full text-sm font-medium"
                  >
                    {index === 0 && '🥇'} {index === 1 && '🥈'} {index === 2 && '🥉'} {name}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Filters and Actions Bar */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 flex items-center gap-3">
            {/* Search */}
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search members..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter */}
            <Dropdown
              trigger={
                <ModernButton variant="secondary" className="h-10">
                  <Filter className="w-4 h-4 mr-2" />
                  {filterType === 'all' ? 'All' : filterType.replace('_', ' ')}
                </ModernButton>
              }
              items={[
                { label: 'All Members', onClick: () => setFilterType('all') },
                { label: 'Completed', onClick: () => setFilterType('completed') },
                { label: 'In Progress', onClick: () => setFilterType('in_progress') },
                { label: 'Not Started', onClick: () => setFilterType('not_started') },
                { label: 'Overdue', onClick: () => setFilterType('overdue') },
              ]}
            />

            {/* Sort */}
            <Dropdown
              trigger={
                <ModernButton variant="secondary" className="h-10">
                  <SortAsc className="w-4 h-4 mr-2" />
                  Sort
                </ModernButton>
              }
              items={[
                { label: 'By Status', onClick: () => setSortType('status') },
                { label: 'By Name', onClick: () => setSortType('name') },
                { label: 'By Response Time', onClick: () => setSortType('response_time') },
                { label: 'By Completion', onClick: () => setSortType('completion') },
              ]}
            />

            {/* View Type */}
            <div className="flex items-center bg-card border border-border rounded-lg p-1">
              <button
                onClick={() => setViewType('grid')}
                className={`p-1.5 rounded ${viewType === 'grid' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7" strokeWidth="2" />
                  <rect x="14" y="3" width="7" height="7" strokeWidth="2" />
                  <rect x="3" y="14" width="7" height="7" strokeWidth="2" />
                  <rect x="14" y="14" width="7" height="7" strokeWidth="2" />
                </svg>
              </button>
              <button
                onClick={() => setViewType('table')}
                className={`p-1.5 rounded ${viewType === 'table' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" strokeWidth="2" />
                  <line x1="3" y1="9" x2="21" y2="9" strokeWidth="2" />
                  <line x1="3" y1="15" x2="21" y2="15" strokeWidth="2" />
                  <line x1="9" y1="3" x2="9" y2="21" strokeWidth="2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedMembers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <span className="text-sm text-muted-foreground mr-2">
                {selectedMembers.length} selected
              </span>
              <ModernButton
                variant="secondary"
                size="sm"
                onClick={() => setIsSmartReminderModalOpen(true)}
              >
                <Zap className="w-4 h-4 mr-2" />
                Smart Remind
              </ModernButton>
              <ModernButton variant="primary" size="sm" onClick={() => handleSendReminder()}>
                <Send className="w-4 h-4 mr-2" />
                Send Reminder
              </ModernButton>
              <ModernButton variant="ghost" size="sm" onClick={() => setSelectedMembers([])}>
                Clear
              </ModernButton>
            </motion.div>
          )}
        </div>

        {/* Members Grid/Table */}
        {viewType === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredAndSortedMembers.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(member.id)}
                    onChange={() => handleToggleMemberSelection(member.id)}
                    className="absolute top-3 right-3 z-10 rounded border-border"
                  />
                  <MemberResponseCard
                    member={member}
                    questions={standup?.questions || []}
                    deliveryType={standup?.deliveryType || 'direct_message'}
                    onSendReminder={() => handleSendReminder([member.id])}
                    onViewResponse={() => handleViewMemberDetails(member)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="p-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedMembers.length === filteredAndSortedMembers.length}
                      onChange={handleSelectAll}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                    Member
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                    Progress
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                    Response Time
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedMembers.map(member => (
                  <tr key={member.id} className="border-b border-border hover:bg-muted/30">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.id)}
                        onChange={() => handleToggleMemberSelection(member.id)}
                        className="rounded border-border"
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{member.name}</p>
                          {member.email && (
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          member.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : member.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-700'
                              : member.status === 'overdue'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {member.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${
                              member.completionPercentage === 100 ? 'bg-green-500' : 'bg-primary'
                            }`}
                            style={{ width: `${member.completionPercentage || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {member.completionPercentage || 0}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-sm text-muted-foreground">
                        {formatTime(member.responseTime)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <ModernButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewMemberDetails(member)}
                        >
                          <Eye className="w-4 h-4" />
                        </ModernButton>
                        {member.status !== 'completed' && (
                          <ModernButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSendReminder([member.id])}
                          >
                            <Send className="w-4 h-4" />
                          </ModernButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {filteredAndSortedMembers.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No members found</h3>
            <p className="text-muted-foreground">
              {searchQuery || filterType !== 'all'
                ? 'Try adjusting your search or filters'
                : 'No members in this standup'}
            </p>
          </motion.div>
        )}
      </main>

      {/* Modals */}
      {selectedMember && (
        <ResponseDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedMember(null);
            setSelectedResponse(null);
          }}
          member={selectedMember}
          response={selectedResponse || undefined}
          questions={standup?.questions || []}
          isReadOnly
        />
      )}

      <SmartReminderModal
        isOpen={isSmartReminderModalOpen}
        onClose={() => setIsSmartReminderModalOpen(false)}
        instanceId={standupId!}
        members={members.filter(m => selectedMembers.includes(m.id))}
        deliveryType={standup?.deliveryType || 'direct_message'}
        teamName={standup?.teamName || ''}
        onSendReminder={async request => {
          try {
            await standupsApi.sendIndividualReminder(request);
            setSelectedMembers([]);
            fetchStandupData();
          } catch (error) {
            console.error('Failed to send reminder:', error);
          }
        }}
      />
    </div>
  );
};
