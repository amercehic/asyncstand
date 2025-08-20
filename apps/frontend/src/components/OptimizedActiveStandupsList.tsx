import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ModernButton, Dropdown, OptimizedVirtualList } from '@/components/ui';
import {
  Calendar,
  Clock,
  Users,
  Hash,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Plus,
  AlertTriangle,
  Play,
  Copy,
  Send,
  Filter,
} from 'lucide-react';
import { toast } from '@/components/ui';
import { useOptimizedQuery } from '@/hooks';
import { standupsApi } from '@/lib/api';
import type { Standup, ActiveStandup } from '@/types';

type FilterType = 'all' | 'active' | 'paused' | 'channel' | 'direct' | 'daily' | 'weekly';

interface ActiveStandupsListProps {
  teamId?: string;
  showHeader?: boolean;
  showCreateButton?: boolean;
  className?: string;
  onStandupsChange?: () => void;
}

type StandupItem = Standup | ActiveStandup;

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  standupName: string;
  isDeleting: boolean;
}

// Optimized Delete Confirmation Modal
const DeleteConfirmationModal = React.memo<DeleteModalProps>(
  ({ isOpen, onClose, onConfirm, standupName, isDeleting }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">Delete Standup</h3>
              <p className="text-muted-foreground mb-6">
                Are you sure you want to delete "{standupName}"? This action cannot be undone and
                will remove all associated data.
              </p>
              <div className="flex gap-3 justify-end">
                <ModernButton variant="ghost" onClick={onClose} disabled={isDeleting}>
                  Cancel
                </ModernButton>
                <ModernButton
                  variant="destructive"
                  onClick={onConfirm}
                  disabled={isDeleting}
                  isLoading={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </ModernButton>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }
);

DeleteConfirmationModal.displayName = 'DeleteConfirmationModal';

// Optimized Standup Card Component
const OptimizedStandupCard = React.memo<{
  standup: StandupItem;
  index: number;
  onView: (standup: StandupItem) => void;
  onEdit: (standup: StandupItem) => void;
  onDelete: (standup: StandupItem) => void;
  onToggleStatus: (standup: StandupItem) => void;
  onCopyLink: (standup: StandupItem) => void;
}>(({ standup, index, onView, onEdit, onDelete, onToggleStatus, onCopyLink }) => {
  const isActive = 'isActive' in standup ? standup.isActive : standup.state === 'collecting';
  const standupName = 'name' in standup ? standup.name : `Standup ${standup.id.slice(0, 8)}`;

  const statusColor = useMemo(() => {
    return isActive ? 'text-green-500' : 'text-yellow-500';
  }, [isActive]);

  const statusBg = useMemo(() => {
    return isActive ? 'bg-green-500/20' : 'bg-yellow-500/20';
  }, [isActive]);

  const nextRun = useMemo(() => {
    if ('schedule' in standup) {
      if (!standup.schedule?.time || !standup.schedule?.days?.length) {
        return 'Not scheduled';
      }

      const now = new Date();
      const today = now.getDay();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      const [hours, minutes] = standup.schedule.time.split(':').map(Number);
      const standupTime = hours * 60 + minutes;

      for (let daysAhead = 0; daysAhead < 7; daysAhead++) {
        const checkDay = (today + daysAhead) % 7;
        const dayName = [
          'sunday',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
        ][checkDay];

        if (
          standup.schedule.days.includes(
            dayName as
              | 'monday'
              | 'tuesday'
              | 'wednesday'
              | 'thursday'
              | 'friday'
              | 'saturday'
              | 'sunday'
          )
        ) {
          if (daysAhead === 0 && currentTime < standupTime) {
            return 'Today';
          } else if (daysAhead === 1) {
            return 'Tomorrow';
          } else if (daysAhead > 0) {
            const targetDate = new Date(now);
            targetDate.setDate(now.getDate() + daysAhead);
            return targetDate.toLocaleDateString('en-US', { weekday: 'long' });
          }
        }
      }
    } else {
      return standup.targetDate ? new Date(standup.targetDate).toLocaleDateString() : 'Today';
    }

    return 'Next week';
  }, [standup]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      transition={{
        duration: 0.2,
        delay: index * 0.05,
        ease: 'easeOut',
      }}
      className="bg-card rounded-xl border border-border hover:border-primary/30 transition-all duration-200 overflow-hidden group"
    >
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors truncate">
                {standupName}
              </h3>
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium ${statusBg} ${statusColor}`}
              >
                {isActive ? 'Active' : 'Paused'}
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {'teamName' in standup ? `Team: ${standup.teamName}` : 'Configuration details'}
            </p>
          </div>
          <Dropdown
            trigger={
              <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            }
            items={[
              { label: 'View Details', icon: Eye, onClick: () => onView(standup) },
              { label: 'Edit Standup', icon: Edit, onClick: () => onEdit(standup) },
              { label: 'Copy Link', icon: Copy, onClick: () => onCopyLink(standup) },
              {
                label: isActive ? 'Pause' : 'Activate',
                icon: isActive ? AlertTriangle : Play,
                onClick: () => onToggleStatus(standup),
              },
              {
                label: 'Delete',
                icon: Trash2,
                onClick: () => onDelete(standup),
                variant: 'destructive',
              },
            ]}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-5 pb-3 grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {'schedule' in standup ? standup.schedule?.days?.length || 0 : 'N/A'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Days/Week</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Hash className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {'questions' in standup ? standup.questions?.length || 0 : 'N/A'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Questions</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {'totalMembers' in standup ? standup.totalMembers : 0}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Members</p>
        </div>
      </div>

      {/* Schedule Info */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {'schedule' in standup ? standup.schedule?.time || 'No time set' : 'Instance'}
            </span>
          </div>
          <span className="text-muted-foreground">Next: {nextRun}</span>
        </div>
      </div>

      {/* Delivery Method */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-2">
          {'deliveryType' in standup ? (
            standup.deliveryType === 'channel' ? (
              <>
                <Hash className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-blue-500 font-medium">Channel Delivery</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-500 font-medium">Direct Message</span>
              </>
            )
          ) : (
            <>
              <Hash className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-blue-500 font-medium">Instance</span>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-5 pb-5 flex gap-2">
        <ModernButton
          variant="ghost"
          size="sm"
          onClick={() => onView(standup)}
          className="flex-1 text-xs"
        >
          <Eye className="w-4 h-4 mr-1" />
          View
        </ModernButton>
        <ModernButton
          variant="ghost"
          size="sm"
          onClick={() => onEdit(standup)}
          className="flex-1 text-xs"
        >
          <Edit className="w-4 h-4 mr-1" />
          Edit
        </ModernButton>
        <ModernButton
          variant={isActive ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => onToggleStatus(standup)}
          className="flex-1 text-xs"
        >
          {isActive ? (
            <>
              <AlertTriangle className="w-4 h-4 mr-1" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-1" />
              Activate
            </>
          )}
        </ModernButton>
      </div>
    </motion.div>
  );
});

OptimizedStandupCard.displayName = 'OptimizedStandupCard';

// Main OptimizedActiveStandupsList Component
export const OptimizedActiveStandupsList = React.memo<ActiveStandupsListProps>(
  ({ teamId, showHeader = true, showCreateButton = true, className = '', onStandupsChange }) => {
    const navigate = useNavigate();
    const [filter, setFilter] = useState<FilterType>('all');
    const [deleteModal, setDeleteModal] = useState<{
      isOpen: boolean;
      standup: StandupItem | null;
      isDeleting: boolean;
    }>({
      isOpen: false,
      standup: null,
      isDeleting: false,
    });

    // Optimized data fetching
    const {
      data: standups = [],
      isLoading,
      error,
      refetch,
    } = useOptimizedQuery(
      teamId ? ['team-standups', teamId] : ['all-standups'],
      async () => {
        if (teamId) {
          return await standupsApi.getTeamStandups(teamId);
        } else {
          return await standupsApi.getActiveStandups();
        }
      },
      {
        staleTime: 60 * 1000, // 1 minute
        cacheTime: 5 * 60 * 1000, // 5 minutes
        refetchOnFocus: true,
      }
    );

    // Memoized filtered standups
    const filteredStandups = useMemo(() => {
      if (!standups) return [];

      return standups.filter((standup: StandupItem) => {
        switch (filter) {
          case 'active': {
            const isActive =
              'isActive' in standup ? standup.isActive : standup.state === 'collecting';
            return isActive;
          }
          case 'paused': {
            const isActive =
              'isActive' in standup ? standup.isActive : standup.state === 'collecting';
            return !isActive;
          }
          case 'channel':
            return 'deliveryType' in standup ? standup.deliveryType === 'channel' : true;
          case 'direct':
            return 'deliveryType' in standup ? standup.deliveryType === 'direct_message' : false;
          case 'daily':
            return 'schedule' in standup ? standup.schedule?.days?.length === 7 : false;
          case 'weekly':
            return 'schedule' in standup
              ? standup.schedule?.days?.length && standup.schedule.days.length < 7
              : false;
          default:
            return true;
        }
      });
    }, [standups, filter]);

    // Memoized callbacks
    const handleView = useCallback(
      (standup: StandupItem) => {
        navigate(`/standups/${standup.id}`);
      },
      [navigate]
    );

    const handleEdit = useCallback(
      (standup: StandupItem) => {
        navigate(`/standups/${standup.id}/edit`);
      },
      [navigate]
    );

    const handleDelete = useCallback((standup: StandupItem) => {
      setDeleteModal({
        isOpen: true,
        standup,
        isDeleting: false,
      });
    }, []);

    const handleConfirmDelete = useCallback(async () => {
      const standup = deleteModal.standup;
      if (!standup) return;

      setDeleteModal(prev => ({ ...prev, isDeleting: true }));

      try {
        await standupsApi.deleteStandup(standup.id);
        toast.success('Standup deleted successfully');
        setDeleteModal({ isOpen: false, standup: null, isDeleting: false });
        refetch();
        onStandupsChange?.();
      } catch (error) {
        console.error('Error deleting standup:', error);
        toast.error('Failed to delete standup');
        setDeleteModal(prev => ({ ...prev, isDeleting: false }));
      }
    }, [deleteModal.standup, refetch, onStandupsChange]);

    const handleToggleStatus = useCallback(
      async (standup: StandupItem) => {
        try {
          const isActive =
            'isActive' in standup ? standup.isActive : standup.state === 'collecting';
          await standupsApi.updateStandup(standup.id, {
            isActive: !isActive,
          });

          toast.success(
            isActive ? 'Standup paused successfully' : 'Standup activated successfully'
          );
          refetch();
          onStandupsChange?.();
        } catch (error) {
          console.error('Error updating standup status:', error);
          toast.error('Failed to update standup status');
        }
      },
      [refetch, onStandupsChange]
    );

    const handleCopyLink = useCallback((standup: StandupItem) => {
      const url = `${window.location.origin}/standups/${standup.id}`;
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }, []);

    const handleCreateStandup = useCallback(() => {
      if (teamId) {
        navigate(`/teams/${teamId}/standups/wizard`);
      } else {
        navigate('/teams'); // Redirect to teams page to select a team first
      }
    }, [navigate, teamId]);

    // Virtual list render function
    const renderStandupItem = useCallback(
      (standup: StandupItem, index: number) => (
        <div className="p-3">
          <OptimizedStandupCard
            standup={standup}
            index={index}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleStatus={handleToggleStatus}
            onCopyLink={handleCopyLink}
          />
        </div>
      ),
      [handleView, handleEdit, handleDelete, handleToggleStatus, handleCopyLink]
    );

    if (error) {
      return (
        <div className={`text-center py-8 ${className}`}>
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-red-500" />
          <h3 className="text-lg font-medium text-foreground mb-2">Error loading standups</h3>
          <p className="text-muted-foreground mb-4">
            There was a problem fetching the standups. Please try again.
          </p>
          <ModernButton onClick={() => refetch()}>Try Again</ModernButton>
        </div>
      );
    }

    return (
      <div className={`space-y-6 ${className}`}>
        {showHeader && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {teamId ? 'Team Standups' : 'Active Standups'}
              </h2>
              <p className="text-muted-foreground">
                {filteredStandups.length} standup{filteredStandups.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-3">
              <Dropdown
                trigger={
                  <ModernButton variant="ghost" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    {filter === 'all'
                      ? 'All'
                      : filter === 'active'
                        ? 'Active'
                        : filter === 'paused'
                          ? 'Paused'
                          : filter === 'channel'
                            ? 'Channel'
                            : filter === 'direct'
                              ? 'Direct'
                              : filter === 'daily'
                                ? 'Daily'
                                : 'Weekly'}
                  </ModernButton>
                }
                items={[
                  { label: 'All', onClick: () => setFilter('all') },
                  { label: 'Active', onClick: () => setFilter('active') },
                  { label: 'Paused', onClick: () => setFilter('paused') },
                  { label: 'Channel Delivery', onClick: () => setFilter('channel') },
                  { label: 'Direct Message', onClick: () => setFilter('direct') },
                  { label: 'Daily', onClick: () => setFilter('daily') },
                  { label: 'Weekly', onClick: () => setFilter('weekly') },
                ]}
              />
              {showCreateButton && (
                <ModernButton onClick={handleCreateStandup}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Standup
                </ModernButton>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 animate-pulse">
                <div className="h-6 bg-muted rounded mb-3" />
                <div className="h-4 bg-muted rounded w-2/3 mb-4" />
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="h-8 bg-muted rounded" />
                  <div className="h-8 bg-muted rounded" />
                  <div className="h-8 bg-muted rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 bg-muted rounded flex-1" />
                  <div className="h-8 bg-muted rounded flex-1" />
                  <div className="h-8 bg-muted rounded flex-1" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredStandups.length > 0 ? (
          filteredStandups.length > 20 ? (
            // Use virtual scrolling for large lists
            <OptimizedVirtualList
              items={filteredStandups}
              itemHeight={320} // Fixed height including padding
              containerHeight={600}
              renderItem={renderStandupItem}
              getItemKey={standup => standup.id}
              className="border border-border rounded-lg"
            />
          ) : (
            // Use regular grid for small lists
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredStandups.map((standup, index) => (
                  <OptimizedStandupCard
                    key={standup.id}
                    standup={standup}
                    index={index}
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleStatus={handleToggleStatus}
                    onCopyLink={handleCopyLink}
                  />
                ))}
              </AnimatePresence>
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {filter === 'all' ? 'No standups yet' : 'No standups match your filter'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {filter === 'all'
                ? 'Create your first standup to get started'
                : 'Try adjusting your filter or create a new standup'}
            </p>
            {showCreateButton && (
              <ModernButton onClick={handleCreateStandup}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Standup
              </ModernButton>
            )}
          </div>
        )}

        <DeleteConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, standup: null, isDeleting: false })}
          onConfirm={handleConfirmDelete}
          standupName={
            deleteModal.standup
              ? 'name' in deleteModal.standup
                ? deleteModal.standup.name
                : `Standup ${deleteModal.standup.id.slice(0, 8)}`
              : ''
          }
          isDeleting={deleteModal.isDeleting}
        />
      </div>
    );
  }
);

OptimizedActiveStandupsList.displayName = 'OptimizedActiveStandupsList';
