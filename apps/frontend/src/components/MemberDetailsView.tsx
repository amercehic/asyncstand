import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Filter, Search, Zap } from 'lucide-react';
import { ModernButton, Dropdown } from '@/components/ui';
import { MemberResponseCard } from '@/components/MemberResponseCard';
import { ResponseDetailsModal } from '@/components/ResponseDetailsModal';
import { SmartReminderModal } from '@/components/SmartReminderModal';
import type {
  ActiveStandup,
  StandupMember,
  DetailedStandupResponse,
  SendReminderRequest,
} from '@/types';

interface MemberDetailsViewProps {
  isOpen: boolean;
  onClose: () => void;
  instance: ActiveStandup;
  onSendReminder: (request: SendReminderRequest) => Promise<void>;
  onUpdateResponse: (
    instanceId: string,
    userId: string,
    answers: Record<string, string>
  ) => Promise<void>;
}

type FilterType = 'all' | 'completed' | 'overdue' | 'not_started' | 'in_progress';

export const MemberDetailsView: React.FC<MemberDetailsViewProps> = ({
  isOpen,
  onClose,
  instance,
  onSendReminder,
  onUpdateResponse,
}) => {
  const [selectedMember, setSelectedMember] = useState<StandupMember | null>(null);
  const [selectedMemberResponse, setSelectedMemberResponse] =
    useState<DetailedStandupResponse | null>(null);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'responseTime'>('status');

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

  const filteredMembers =
    instance.members?.filter(member => {
      // Apply status filter
      if (filter !== 'all' && member.status !== filter) return false;

      // Apply search filter
      if (searchQuery && !member.name.toLowerCase().includes(searchQuery.toLowerCase()))
        return false;

      return true;
    }) || [];

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'status': {
        const statusOrder = { overdue: 0, not_started: 1, in_progress: 2, completed: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      }
      case 'responseTime':
        return (a.responseTime || 999) - (b.responseTime || 999);
      default:
        return 0;
    }
  });

  const handleViewResponse = async (userId: string) => {
    const member = instance.members?.find(m => m.id === userId);
    if (!member) return;

    setSelectedMember(member);

    // In a real app, this would fetch the detailed response
    if (member.response) {
      setSelectedMemberResponse({
        ...member.response,
        user: {
          id: member.id,
          name: member.name,
          avatar: member.avatar,
        },
        isLate: member.isLate,
        responseTimeMinutes: member.responseTime || 0,
      });
    }

    setIsResponseModalOpen(true);
  };

  const handleSendIndividualReminder = async (userId: string) => {
    await onSendReminder({
      instanceId: instance.id,
      userIds: [userId],
      type: 'individual',
      deliveryMethod: instance.deliveryType === 'channel' ? 'channel_mention' : 'direct_message',
    });
  };

  const handleSaveResponse = async (answers: Record<string, string>) => {
    if (!selectedMember) return;
    await onUpdateResponse(instance.id, selectedMember.id, answers);
    setIsResponseModalOpen(false);
  };

  const getFilterCounts = () => {
    const members = instance.members || [];
    return {
      all: members.length,
      completed: members.filter(m => m.status === 'completed').length,
      overdue: members.filter(m => m.status === 'overdue').length,
      not_started: members.filter(m => m.status === 'not_started').length,
      in_progress: members.filter(m => m.status === 'in_progress').length,
    };
  };

  const counts = getFilterCounts();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-background rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Team Members - {instance.teamName}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(instance.targetDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                at {instance.timeLocal}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats & Controls */}
          <div className="p-6 border-b border-border bg-muted/30">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{counts.all}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{counts.completed}</div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{counts.overdue}</div>
                <div className="text-xs text-muted-foreground">Overdue</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{counts.in_progress}</div>
                <div className="text-xs text-muted-foreground">In Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{counts.not_started}</div>
                <div className="text-xs text-muted-foreground">Not Started</div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-border rounded-lg w-64"
                  />
                </div>

                {/* Filter */}
                <Dropdown
                  trigger={
                    <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-muted">
                      <Filter className="w-4 h-4" />
                      <span className="capitalize">{filter.replace('_', ' ')}</span>
                      {filter !== 'all' && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                          {counts[filter]}
                        </span>
                      )}
                    </button>
                  }
                  items={[
                    { label: `All (${counts.all})`, onClick: () => setFilter('all') },
                    {
                      label: `Completed (${counts.completed})`,
                      onClick: () => setFilter('completed'),
                    },
                    { label: `Overdue (${counts.overdue})`, onClick: () => setFilter('overdue') },
                    {
                      label: `In Progress (${counts.in_progress})`,
                      onClick: () => setFilter('in_progress'),
                    },
                    {
                      label: `Not Started (${counts.not_started})`,
                      onClick: () => setFilter('not_started'),
                    },
                  ]}
                />

                {/* Sort */}
                <Dropdown
                  trigger={
                    <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-muted">
                      <span>
                        Sort:{' '}
                        {sortBy === 'responseTime'
                          ? 'Response Time'
                          : sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                      </span>
                    </button>
                  }
                  items={[
                    { label: 'Status', onClick: () => setSortBy('status') },
                    { label: 'Name', onClick: () => setSortBy('name') },
                    { label: 'Response Time', onClick: () => setSortBy('responseTime') },
                  ]}
                />
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <ModernButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsReminderModalOpen(true)}
                  disabled={counts.overdue + counts.not_started === 0}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Smart Reminder
                </ModernButton>
              </div>
            </div>
          </div>

          {/* Members Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {sortedMembers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedMembers.map((member, index) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <MemberResponseCard
                      member={member}
                      questions={instance.questions}
                      deliveryType={instance.deliveryType}
                      onSendReminder={handleSendIndividualReminder}
                      onViewResponse={handleViewResponse}
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No members found</h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? 'Try adjusting your search query or filters'
                    : 'No members match the current filter'}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-border bg-muted/30">
            <div className="text-sm text-muted-foreground">
              Showing {sortedMembers.length} of {instance.members?.length || 0} members
            </div>
            <ModernButton variant="ghost" onClick={onClose}>
              Close
            </ModernButton>
          </div>
        </motion.div>

        {/* Modals */}
        <ResponseDetailsModal
          isOpen={isResponseModalOpen}
          onClose={() => {
            setIsResponseModalOpen(false);
            setSelectedMember(null);
            setSelectedMemberResponse(null);
          }}
          member={selectedMember!}
          response={selectedMemberResponse!}
          questions={instance.questions}
          onSaveResponse={handleSaveResponse}
          onSendReminder={() => selectedMember && handleSendIndividualReminder(selectedMember.id)}
        />

        <SmartReminderModal
          isOpen={isReminderModalOpen}
          onClose={() => setIsReminderModalOpen(false)}
          instanceId={instance.id}
          members={instance.members || []}
          deliveryType={instance.deliveryType}
          onSendReminder={onSendReminder}
          teamName={instance.teamName}
        />
      </div>
    </AnimatePresence>
  );
};
