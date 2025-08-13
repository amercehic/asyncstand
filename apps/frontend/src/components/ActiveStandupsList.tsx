import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ModernButton, Dropdown } from '@/components/ui';
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
  CheckCircle2,
  AlertTriangle,
  Play,
  Settings,
  Copy,
  BarChart3,
  Zap,
} from 'lucide-react';
import { toast } from '@/components/ui';
import { standupsApi } from '@/lib/api';
import { StandupEditModal } from '@/components/StandupEditModal';
import type { StandupConfig } from '@/types';

interface ActiveStandupsListProps {
  teamId?: string;
  showHeader?: boolean;
  showCreateButton?: boolean;
  className?: string;
  onStandupsChange?: () => void;
}

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  standupName: string;
  isDeleting: boolean;
}

const DeleteConfirmationModal: React.FC<DeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  standupName,
  isDeleting,
}) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card rounded-2xl p-6 border border-border max-w-md w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Delete Standup</h3>
            <p className="text-sm text-muted-foreground">This action cannot be undone</p>
          </div>
        </div>

        <div className="bg-muted/30 rounded-lg p-4 mb-6">
          <p className="text-sm">
            Are you sure you want to delete <span className="font-medium">"{standupName}"</span>?
            <br />
            <br />
            This will permanently remove the standup configuration, all associated responses, and
            cannot be recovered.
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <ModernButton variant="ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </ModernButton>
          <ModernButton
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="min-w-[100px]"
          >
            {isDeleting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </div>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </>
            )}
          </ModernButton>
        </div>
      </motion.div>
    </motion.div>
  );
};

const getStatusColor = (isActive: boolean) => {
  return isActive
    ? 'text-green-700 bg-green-50 border-green-200'
    : 'text-gray-600 bg-gray-50 border-gray-200';
};

const getTimeDisplay = (days: string[], time: string) => {
  if (
    days.length === 5 &&
    days.includes('monday') &&
    days.includes('tuesday') &&
    days.includes('wednesday') &&
    days.includes('thursday') &&
    days.includes('friday')
  ) {
    return `Weekdays at ${time}`;
  } else if (days.length === 1) {
    return `${days[0].charAt(0).toUpperCase() + days[0].slice(1)}s at ${time}`;
  } else {
    const dayNames = days.map(day => day.charAt(0).toUpperCase() + day.slice(1, 3));
    return `${dayNames.join(', ')} at ${time}`;
  }
};

export const ActiveStandupsList: React.FC<ActiveStandupsListProps> = ({
  teamId,
  showHeader = true,
  showCreateButton = true,
  className = '',
  onStandupsChange,
}) => {
  const navigate = useNavigate();
  const [standups, setStandups] = useState<StandupConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    standupId: string;
    standupName: string;
    isDeleting: boolean;
  }>({
    isOpen: false,
    standupId: '',
    standupName: '',
    isDeleting: false,
  });

  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    standup: StandupConfig | null;
  }>({
    isOpen: false,
    standup: null,
  });

  const fetchStandups = async () => {
    if (!teamId) return;

    try {
      setIsLoading(true);
      const data = await standupsApi.getTeamStandups(teamId);
      setStandups(data);
    } catch (error) {
      console.error('Error fetching standups:', error);
      toast.error('Failed to load standups');
      setStandups([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStandups();
  }, [teamId]);

  const handleDeleteStandup = (standup: StandupConfig) => {
    setDeleteModal({
      isOpen: true,
      standupId: standup.id,
      standupName: standup.name,
      isDeleting: false,
    });
  };

  const confirmDelete = async () => {
    if (!deleteModal.standupId) return;

    setDeleteModal(prev => ({ ...prev, isDeleting: true }));

    try {
      await standupsApi.deleteStandup(deleteModal.standupId);
      toast.success(`Standup "${deleteModal.standupName}" deleted successfully`);
      await fetchStandups(); // Refresh the list
      onStandupsChange?.(); // Notify parent component
      setDeleteModal({ isOpen: false, standupId: '', standupName: '', isDeleting: false });
    } catch (error) {
      console.error('Error deleting standup:', error);
      toast.error('Failed to delete standup');
      setDeleteModal(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const handleEditStandup = (standup: StandupConfig) => {
    setEditModal({
      isOpen: true,
      standup: standup,
    });
  };

  const handleEditSuccess = async () => {
    await fetchStandups(); // Refresh the standups list
    onStandupsChange?.(); // Notify parent component
    setEditModal({ isOpen: false, standup: null });
  };

  const handleDuplicateStandup = () => {
    // TODO: Implement duplication
    toast.info('Duplicate standup - Coming soon!');
  };

  const handleViewAnalytics = () => {
    // TODO: Navigate to analytics page
    toast.info('Analytics view - Coming soon!');
  };

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-muted rounded-xl" />
                  <div>
                    <div className="w-32 h-5 bg-muted rounded mb-2" />
                    <div className="w-48 h-4 bg-muted rounded" />
                  </div>
                </div>
                <div className="w-24 h-8 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {showHeader && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Active Standups</h2>
            <p className="text-muted-foreground">
              {standups.length} standup{standups.length !== 1 ? 's' : ''} configured
            </p>
          </div>
          {showCreateButton && teamId && (
            <ModernButton
              variant="primary"
              onClick={() => navigate(`/teams/${teamId}/standups/create`)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Standup
            </ModernButton>
          )}
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {standups.length > 0 ? (
          <div className="space-y-4">
            {standups.map((standup, index) => (
              <motion.div
                key={standup.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="group bg-card rounded-2xl border border-border hover:border-primary/20 hover:shadow-lg transition-all duration-300 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Standup Icon */}
                      <div className="relative">
                        <div
                          className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${
                            standup.isActive
                              ? 'bg-gradient-to-br from-primary to-primary/80 group-hover:from-primary/90 group-hover:to-primary/70'
                              : 'bg-gradient-to-br from-gray-400 to-gray-500'
                          }`}
                        >
                          <Calendar className="w-7 h-7 text-white" />
                        </div>
                        {standup.isActive && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Standup Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                              {standup.name}
                            </h3>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                <span>
                                  {getTimeDisplay(standup.schedule.days, standup.schedule.time)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Users className="w-4 h-4" />
                                <span>{standup.questions.length} questions</span>
                              </div>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div
                            className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(standup.isActive)}`}
                          >
                            {standup.isActive ? (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                Active
                              </div>
                            ) : (
                              'Paused'
                            )}
                          </div>
                        </div>

                        {/* Questions Preview */}
                        <div className="bg-muted/30 rounded-lg p-3 mb-4">
                          <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                            Questions ({standup.questions.length})
                          </div>
                          <div className="space-y-1">
                            {standup.questions.slice(0, 2).map((question, qIndex) => (
                              <div key={qIndex} className="text-sm text-foreground/80 truncate">
                                {qIndex + 1}. {question}
                              </div>
                            ))}
                            {standup.questions.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                +{standup.questions.length - 2} more questions
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Schedule Details */}
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {standup.schedule.days.length === 7
                                ? 'Daily'
                                : standup.schedule.days.length === 5 &&
                                    standup.schedule.days.includes('monday') &&
                                    standup.schedule.days.includes('friday')
                                  ? 'Weekdays'
                                  : `${standup.schedule.days.length} days/week`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Hash className="w-4 h-4" />
                            <span>{standup.schedule.timezone}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <ModernButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewAnalytics()}
                        className="hover:bg-blue-50 hover:text-blue-600"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </ModernButton>

                      <Dropdown
                        trigger={
                          <ModernButton variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </ModernButton>
                        }
                        items={[
                          {
                            label: 'View Details',
                            icon: Eye,
                            onClick: () => toast.info('View details - Coming soon!'),
                          },
                          {
                            label: 'Edit Standup',
                            icon: Edit,
                            onClick: () => handleEditStandup(standup),
                          },
                          {
                            label: 'Duplicate',
                            icon: Copy,
                            onClick: () => handleDuplicateStandup(),
                          },
                          {
                            label: 'Settings',
                            icon: Settings,
                            onClick: () => toast.info('Settings - Coming soon!'),
                          },
                          { type: 'separator' },
                          {
                            label: 'Delete Standup',
                            icon: Trash2,
                            onClick: () => handleDeleteStandup(standup),
                            className: 'text-red-600 hover:text-red-700',
                          },
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="px-6 py-4 bg-muted/20 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Created {new Date(standup.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Updated {new Date(standup.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ModernButton
                        variant="ghost"
                        size="sm"
                        onClick={() => toast.info('Run now - Coming soon!')}
                        className="text-xs"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Run Now
                      </ModernButton>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl p-12 border border-border text-center"
          >
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">No Active Standups</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Get started by creating your first standup configuration to begin collecting async
              updates from your team.
            </p>
            {showCreateButton && teamId && (
              <ModernButton
                variant="primary"
                onClick={() => navigate(`/teams/${teamId}/standups/create`)}
                className="inline-flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Create Your First Standup
              </ModernButton>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal.isOpen && (
          <DeleteConfirmationModal
            isOpen={deleteModal.isOpen}
            onClose={() =>
              !deleteModal.isDeleting &&
              setDeleteModal({ isOpen: false, standupId: '', standupName: '', isDeleting: false })
            }
            onConfirm={confirmDelete}
            standupName={deleteModal.standupName}
            isDeleting={deleteModal.isDeleting}
          />
        )}
      </AnimatePresence>

      {/* Edit Standup Modal */}
      {editModal.standup && (
        <StandupEditModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal({ isOpen: false, standup: null })}
          onSuccess={handleEditSuccess}
          standup={editModal.standup}
        />
      )}
    </div>
  );
};
