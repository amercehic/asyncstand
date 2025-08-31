import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Search,
  Filter,
  Download,
  Send,
  RefreshCw,
  Eye,
  X,
  SortAsc,
} from 'lucide-react';
import { ModernButton, Dropdown, toast } from '@/components/ui';
import { ResponseDetailsModal } from '@/components/ResponseDetailsModal';
import { standupsApi } from '@/lib/api';
import type { ActiveStandup, StandupMember, DetailedStandupResponse } from '@/types';

type FilterType = 'all' | 'completed' | 'in_progress' | 'not_started' | 'overdue';
type SortType = 'name' | 'status' | 'response_time' | 'completion';

export const StandupResponsesPage: React.FC = () => {
  const { standupId } = useParams<{ standupId: string }>();
  const navigate = useNavigate();

  const [standup, setStandup] = useState<ActiveStandup | null>(null);

  // Get the standup title from the actual API data
  const getStandupTitle = (standupData: ActiveStandup) => {
    // Use the configName field if available (this is the real standup config name)
    if (standupData.configName) {
      return standupData.configName;
    }

    // Fall back to a generic name if no config name is provided
    return 'Standup';
  };
  const [members, setMembers] = useState<StandupMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<StandupMember | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<DetailedStandupResponse | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('status');
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

  const completionRate = useMemo(() => {
    if (members.length === 0) return 0;
    const completed = members.filter(m => m.status === 'completed').length;
    return Math.round((completed / members.length) * 100);
  }, [members]);

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
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Simple Header */}
        <div className="mb-6">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-4">
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={() => navigate('/standups')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Standups
            </ModernButton>
            <div className="flex items-center gap-2">
              <ModernButton
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </ModernButton>
              <ModernButton variant="secondary" size="sm" onClick={handleExportResponses}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </ModernButton>
            </div>
          </div>

          {/* Title Section */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 mb-1">
                  {getStandupTitle(standup)}
                </h1>
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <span>Team: {standup.teamName}</span>
                  <span>•</span>
                  <span>
                    {new Date(standup.targetDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span>•</span>
                  <span>{standup.questions?.length || 0} questions</span>
                  <span>•</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      standup.state === 'collecting'
                        ? 'bg-green-100 text-green-700'
                        : standup.state === 'completed'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {standup.state}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-slate-800">{completionRate}%</div>
                <div className="text-sm text-slate-600">Complete</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

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

          {selectedMembers.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-600">{selectedMembers.length} selected</span>
              <ModernButton variant="primary" size="sm" onClick={() => handleSendReminder()}>
                <Send className="w-4 h-4 mr-2" />
                Send Reminder
              </ModernButton>
              <ModernButton variant="ghost" size="sm" onClick={() => setSelectedMembers([])}>
                Clear
              </ModernButton>
            </div>
          )}
        </div>

        {/* Members Table */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 text-left w-8">
                  <input
                    type="checkbox"
                    checked={
                      filteredAndSortedMembers.length > 0 &&
                      selectedMembers.length === filteredAndSortedMembers.length
                    }
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Member</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Status</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Progress</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Response Time</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedMembers.map(member => (
                <tr key={member.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member.id)}
                      onChange={() => handleToggleMemberSelection(member.id)}
                      className="rounded"
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
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <Users className="w-4 h-4 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        {member.email && <p className="text-xs text-gray-500">{member.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        member.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : member.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : member.status === 'overdue'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {member.status === 'completed'
                        ? 'Completed'
                        : member.status === 'in_progress'
                          ? 'In Progress'
                          : member.status === 'overdue'
                            ? 'Overdue'
                            : 'Not Started'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-16">
                        <div
                          className={`h-full rounded-full ${
                            member.completionPercentage === 100 ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${member.completionPercentage || 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 min-w-8">
                        {member.completionPercentage || 0}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="text-sm text-gray-600">{formatTime(member.responseTime)}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <ModernButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewMemberDetails(member)}
                        disabled={member.status === 'not_started'}
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

        {/* Empty State */}
        {filteredAndSortedMembers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No members found</h3>
            <p className="text-gray-500">
              {searchQuery || filterType !== 'all'
                ? 'Try adjusting your search or filters'
                : 'No members in this standup'}
            </p>
          </div>
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
    </div>
  );
};
