import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import {
  X,
  Search,
  Users,
  UserPlus,
  UserMinus,
  CheckSquare,
  Square,
  Filter,
  Slack,
} from 'lucide-react';
import { toast } from '@/components/ui';
import { teamsApi } from '@/lib/api';
import type { Team } from '@/types';
import type { AvailableMemberDetails } from '@/types/backend';

interface TeamMemberAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  team: Team;
}

interface PlatformMember extends AvailableMemberDetails {
  isAssigned: boolean;
  isSelected: boolean;
  teamMemberId?: string; // ID of the team member record for removal
}

export const TeamMemberAssignmentModal: React.FC<TeamMemberAssignmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  team,
}) => {
  const [platformMembers, setPlatformMembers] = useState<PlatformMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'available' | 'assigned'>('all');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Load platform members and determine assignment status
  useEffect(() => {
    const loadPlatformMembers = async () => {
      if (!isOpen) return;

      setIsLoading(true);
      try {
        const membersData = await teamsApi.getAvailableMembers();

        // Map platform members with current assignment status
        const membersWithStatus: PlatformMember[] = membersData.members.map(member => {
          const assignedTeamMember = team.members.find(
            teamMember => teamMember.name === member.name
          );

          return {
            ...member,
            isAssigned: !!assignedTeamMember,
            isSelected: false,
            teamMemberId: assignedTeamMember?.id,
          };
        });

        setPlatformMembers(membersWithStatus);
      } catch (error) {
        console.error('Error loading platform members:', error);
        toast.error('Failed to load workspace members', { id: `load-members-${team.id}` });
      } finally {
        setIsLoading(false);
      }
    };

    loadPlatformMembers();
  }, [isOpen, team.members]);

  // Filter and search members
  const filteredMembers = useMemo(() => {
    let filtered = platformMembers;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        member =>
          member.name.toLowerCase().includes(query) ||
          member.platformUserId.toLowerCase().includes(query)
      );
    }

    // Apply assignment filter
    switch (filterMode) {
      case 'available':
        filtered = filtered.filter(member => !member.isAssigned);
        break;
      case 'assigned':
        filtered = filtered.filter(member => member.isAssigned);
        break;
      default:
        // Show all
        break;
    }

    return filtered;
  }, [platformMembers, searchQuery, filterMode]);

  // Selection state
  const selectedMembers = platformMembers.filter(member => member.isSelected);
  const selectedToAdd = selectedMembers.filter(member => !member.isAssigned);
  const selectedToRemove = selectedMembers.filter(member => member.isAssigned);

  // Handle individual member selection toggle
  const handleToggleMember = (memberId: string) => {
    setPlatformMembers(prev =>
      prev.map(member =>
        member.id === memberId ? { ...member, isSelected: !member.isSelected } : member
      )
    );
  };

  // Handle select all toggle
  const handleSelectAll = () => {
    const allSelected = filteredMembers.every(member => member.isSelected);
    const memberIds = new Set(filteredMembers.map(m => m.id));

    setPlatformMembers(prev =>
      prev.map(member =>
        memberIds.has(member.id) ? { ...member, isSelected: !allSelected } : member
      )
    );
  };

  // Handle save changes
  const handleSave = async () => {
    if (selectedToAdd.length === 0 && selectedToRemove.length === 0) {
      toast.info('No changes to save');
      return;
    }

    // Show confirmation dialog for bulk operations (more than 5 members affected)
    const totalChanges = selectedToAdd.length + selectedToRemove.length;
    if (totalChanges > 5 && !showConfirmDialog) {
      setShowConfirmDialog(true);
      return;
    }

    await performMemberUpdates();
  };

  // Perform the actual member updates
  const performMemberUpdates = async () => {
    setIsSaving(true);
    try {
      // Execute API calls for assign/remove operations
      const operations = [];

      if (selectedToAdd.length > 0) {
        operations.push(
          teamsApi.assignPlatformMembers(
            team.id,
            selectedToAdd.map(m => m.platformUserId)
          )
        );
      }

      if (selectedToRemove.length > 0) {
        const teamMemberIds = selectedToRemove
          .map(m => m.teamMemberId)
          .filter((id): id is string => !!id);

        if (teamMemberIds.length > 0) {
          operations.push(teamsApi.removePlatformMembers(team.id, teamMemberIds));
        }
      }

      // Wait for all operations to complete
      await Promise.all(operations);

      // Success toast notification
      if (selectedToAdd.length > 0 && selectedToRemove.length > 0) {
        toast.success(
          `Updated team members successfully! Added ${selectedToAdd.length}, removed ${selectedToRemove.length}`,
          {
            id: `team-members-${team.id}`,
          }
        );
      } else if (selectedToAdd.length > 0) {
        toast.success(
          `Added ${selectedToAdd.length} member${selectedToAdd.length > 1 ? 's' : ''} to ${team.name} team`,
          {
            id: `team-members-${team.id}`,
          }
        );
      } else if (selectedToRemove.length > 0) {
        toast.success(
          `Removed ${selectedToRemove.length} member${selectedToRemove.length > 1 ? 's' : ''} from ${team.name} team`,
          {
            id: `team-members-${team.id}`,
          }
        );
      }

      onSuccess();
      setShowConfirmDialog(false);
      onClose();
    } catch (error) {
      console.error('Error updating team members:', error);
      toast.error('Failed to update team members', { id: `update-members-${team.id}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle confirmation dialog
  const handleConfirmBulkOperation = async () => {
    await performMemberUpdates();
  };

  const handleCancelBulkOperation = () => {
    setShowConfirmDialog(false);
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center pt-2 pb-2 sm:pt-8 sm:pb-8">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-[95vw] sm:max-w-2xl my-2 sm:my-4 mx-2 sm:mx-4 bg-background rounded-xl sm:rounded-2xl shadow-2xl border border-border max-h-[95vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-primary to-primary/80 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Manage Team Members</h2>
                <p className="text-sm text-muted-foreground">
                  Assign workspace members to {team.name}
                </p>
              </div>
            </div>
            <ModernButton variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </ModernButton>
          </div>

          {/* Search and Filters */}
          <div className="p-4 sm:p-6 border-b border-border space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search workspace members..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-150"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  value={filterMode}
                  onChange={e => setFilterMode(e.target.value as typeof filterMode)}
                  className="text-sm border border-border rounded-md px-3 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Members</option>
                  <option value="available">Available Only</option>
                  <option value="assigned">Currently Assigned</option>
                </select>
                <span className="text-sm text-muted-foreground">
                  ({filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''})
                </span>
              </div>

              <ModernButton
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={filteredMembers.length === 0}
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                {filteredMembers.every(member => member.isSelected) ? 'Deselect All' : 'Select All'}
              </ModernButton>
            </div>
          </div>

          {/* Members List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <span className="ml-3 text-muted-foreground">Loading workspace members...</span>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No members found</h3>
                <p className="text-muted-foreground">
                  {searchQuery.trim()
                    ? 'Try adjusting your search or filter criteria'
                    : 'No workspace members available'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMembers.map(member => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
                      member.isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/30'
                    }`}
                    onClick={() => handleToggleMember(member.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {member.isSelected ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>

                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-medium text-sm">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{member.name}</p>
                          <Slack className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          @{member.platformUserId}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {member.isAssigned ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            ✓ In Team
                          </span>
                        ) : (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                            Available
                          </span>
                        )}

                        {member.inTeamCount > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            {member.inTeamCount} team{member.inTeamCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 border-t border-border">
            {/* Selection Summary */}
            {selectedMembers.length > 0 && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {selectedMembers.length} member{selectedMembers.length > 1 ? 's' : ''} selected
                  </span>
                  <div className="flex items-center gap-4 text-sm">
                    {selectedToAdd.length > 0 && (
                      <span className="text-green-600 flex items-center gap-1">
                        <UserPlus className="w-4 h-4" />
                        {selectedToAdd.length} to add
                      </span>
                    )}
                    {selectedToRemove.length > 0 && (
                      <span className="text-red-600 flex items-center gap-1">
                        <UserMinus className="w-4 h-4" />
                        {selectedToRemove.length} to remove
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <ModernButton variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </ModernButton>
              <ModernButton
                variant="primary"
                onClick={handleSave}
                disabled={isSaving || selectedMembers.length === 0}
                className="flex-1"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Apply Changes
                  </>
                )}
              </ModernButton>
            </div>
          </div>
        </motion.div>

        {/* Bulk Operation Confirmation Dialog */}
        {showConfirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background rounded-2xl shadow-2xl border border-border max-w-md w-full p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Confirm Bulk Operation</h3>
                  <p className="text-sm text-muted-foreground">
                    You're about to affect {selectedToAdd.length + selectedToRemove.length} members
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {selectedToAdd.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <UserPlus className="w-4 h-4 text-green-600" />
                    <span>
                      Add <strong>{selectedToAdd.length}</strong> member
                      {selectedToAdd.length > 1 ? 's' : ''} to {team.name}
                    </span>
                  </div>
                )}
                {selectedToRemove.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <UserMinus className="w-4 h-4 text-red-600" />
                    <span>
                      Remove <strong>{selectedToRemove.length}</strong> member
                      {selectedToRemove.length > 1 ? 's' : ''} from {team.name}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <ModernButton
                  variant="secondary"
                  onClick={handleCancelBulkOperation}
                  className="flex-1"
                  disabled={isSaving}
                >
                  Cancel
                </ModernButton>
                <ModernButton
                  variant="primary"
                  onClick={handleConfirmBulkOperation}
                  className="flex-1"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4 mr-2" />
                      Confirm Changes
                    </>
                  )}
                </ModernButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
};
