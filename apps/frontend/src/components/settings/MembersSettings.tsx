import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  User,
  Mail,
  Trash2,
  Search,
  Filter,
  ChevronDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { ModernButton, toast, ConfirmationModal } from '@/components/ui';
import { organizationApi } from '@/lib/api';
import type { OrgMember, OrgRole } from '@/lib/api';

interface InviteMemberForm {
  email: string;
  role: OrgRole;
}

interface MembersSettingsProps {
  members: OrgMember[];
  canManageMembers: boolean;
  currentUserId?: string;
  onMembersUpdate: (updatedMembers: OrgMember[]) => void;
}

const isValidEmail = (email: string): boolean => {
  if (!email.trim()) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

export const MembersSettings = React.memo<MembersSettingsProps>(
  ({ members, canManageMembers, currentUserId, onMembersUpdate }) => {
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteForm, setInviteForm] = useState<InviteMemberForm>({
      email: '',
      role: 'member' as OrgRole,
    });
    const [isInviting, setIsInviting] = useState(false);
    const [emailTouched, setEmailTouched] = useState(false);

    // Member filtering and pagination state
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<OrgRole | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'invited'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'role' | 'joinedAt'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [showFilters, setShowFilters] = useState(false);

    // Member deletion state
    const [memberToDelete, setMemberToDelete] = useState<OrgMember | null>(null);
    const [isDeletingMember, setIsDeletingMember] = useState(false);

    const handleInviteModalToggle = (open: boolean) => {
      setShowInviteModal(open);
      if (!open) {
        setInviteForm({ email: '', role: 'member' as OrgRole });
        setEmailTouched(false);
      }
    };

    const handleInviteMember = async () => {
      if (!inviteForm.email.trim()) {
        toast.error('Please enter an email address');
        return;
      }

      if (!isValidEmail(inviteForm.email)) {
        toast.error('Please provide a valid email address (e.g., user@example.com)');
        return;
      }

      try {
        setIsInviting(true);
        await organizationApi.inviteMember(inviteForm.email, inviteForm.role);
        toast.success(`Invitation sent to ${inviteForm.email}`);
        handleInviteModalToggle(false);
        // Reload members to show pending invitation
        const updatedMembers = await organizationApi.getMembers();
        onMembersUpdate(updatedMembers);
      } catch (error: unknown) {
        console.error('Failed to invite member:', error);

        const apiError = error as {
          response?: {
            data?: {
              title?: string;
              message?: string;
              response?: { message?: string };
            };
          };
        };

        const errorMessage =
          apiError?.response?.data?.title ||
          apiError?.response?.data?.response?.message ||
          apiError?.response?.data?.message ||
          'Failed to send invitation';

        toast.error(errorMessage);
      } finally {
        setIsInviting(false);
      }
    };

    const handleUpdateMemberRole = async (memberId: string, newRole: OrgRole) => {
      try {
        await organizationApi.updateMemberRole(memberId, newRole);
        toast.success('Member role updated');
        const updatedMembers = members.map(m => (m.id === memberId ? { ...m, role: newRole } : m));
        onMembersUpdate(updatedMembers);
      } catch (error) {
        console.error('Failed to update member role:', error);
        toast.error('Failed to update member role');
      }
    };

    const handleRemoveMember = async (memberId: string) => {
      const member = members.find(m => m.id === memberId);
      if (member) {
        setMemberToDelete(member);
      }
    };

    const handleConfirmRemoveMember = async () => {
      if (!memberToDelete) return;

      try {
        setIsDeletingMember(true);
        await organizationApi.removeMember(memberToDelete.id);
        toast.success('Member removed');
        const updatedMembers = members.filter(m => m.id !== memberToDelete.id);
        onMembersUpdate(updatedMembers);
        setMemberToDelete(null);
      } catch (error) {
        console.error('Failed to remove member:', error);
        toast.error('Failed to remove member');
      } finally {
        setIsDeletingMember(false);
      }
    };

    const handleCancelRemoveMember = () => {
      setMemberToDelete(null);
      setIsDeletingMember(false);
    };

    // Filtered and paginated members
    const { filteredMembers, totalPages, displayedMembers } = useMemo(() => {
      const filtered = (members || []).filter(member => {
        const matchesSearch =
          searchQuery === '' ||
          member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          member.email.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesRole = roleFilter === 'all' || member.role === roleFilter;
        const matchesStatus = statusFilter === 'all' || member.status === statusFilter;

        return matchesSearch && matchesRole && matchesStatus;
      });

      // Sorting
      filtered.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch (sortBy) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'role':
            aValue = a.role;
            bValue = b.role;
            break;
          case 'joinedAt':
            aValue = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
            bValue = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
            break;
          default:
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
        }

        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });

      const totalPages = Math.ceil(filtered.length / itemsPerPage);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const displayedMembers = filtered.slice(startIndex, startIndex + itemsPerPage);

      return { filteredMembers: filtered, totalPages, displayedMembers };
    }, [
      members,
      searchQuery,
      roleFilter,
      statusFilter,
      sortBy,
      sortOrder,
      currentPage,
      itemsPerPage,
    ]);

    // Reset pagination when filters change
    useEffect(() => {
      setCurrentPage(1);
    }, [searchQuery, roleFilter, statusFilter, sortBy, sortOrder]);

    return (
      <>
        <motion.div
          key="members"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Team Members
                </h2>
                <p className="text-sm text-muted-foreground mt-1" data-testid="members-count">
                  {filteredMembers.length} of {(members || []).length} members
                </p>
              </div>
              {canManageMembers && (
                <ModernButton
                  onClick={() => handleInviteModalToggle(true)}
                  className="gap-2"
                  data-testid="invite-member-button"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite Member
                </ModernButton>
              )}
            </div>

            {/* Search and Filters */}
            <div className="space-y-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    data-testid="search-members-input"
                  />
                </div>

                {/* Filter Button */}
                <ModernButton
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-2 h-10"
                  data-testid="filters-button"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                  />
                </ModernButton>
              </div>

              {/* Expanded Filters */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                    data-testid="filters-panel"
                  >
                    <div className="flex flex-col sm:flex-row gap-4 p-4 bg-background rounded-lg border border-border">
                      {/* Role Filter */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-muted-foreground">Role</label>
                        <select
                          value={roleFilter}
                          onChange={e => setRoleFilter(e.target.value as OrgRole | 'all')}
                          className="px-3 py-2 bg-background border border-border rounded-md text-sm"
                          data-testid="role-filter-select"
                        >
                          <option value="all">All Roles</option>
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      </div>

                      {/* Status Filter */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-muted-foreground">Status</label>
                        <select
                          value={statusFilter}
                          onChange={e =>
                            setStatusFilter(e.target.value as 'all' | 'active' | 'invited')
                          }
                          className="px-3 py-2 bg-background border border-border rounded-md text-sm"
                          data-testid="status-filter-select"
                        >
                          <option value="all">All Status</option>
                          <option value="active">Active</option>
                          <option value="invited">Invited</option>
                        </select>
                      </div>

                      {/* Sort Options */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-muted-foreground">Sort By</label>
                        <div className="flex gap-2">
                          <select
                            value={sortBy}
                            onChange={e =>
                              setSortBy(e.target.value as 'name' | 'role' | 'joinedAt')
                            }
                            className="px-3 py-2 bg-background border border-border rounded-md text-sm"
                            data-testid="sort-by-select"
                          >
                            <option value="name">Name</option>
                            <option value="role">Role</option>
                            <option value="joinedAt">Join Date</option>
                          </select>
                          <ModernButton
                            variant="outline"
                            size="sm"
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="gap-1"
                            data-testid="sort-order-button"
                          >
                            <ArrowUpDown className="w-3 h-3" />
                            {sortOrder === 'asc' ? 'Asc' : 'Desc'}
                          </ModernButton>
                        </div>
                      </div>

                      {/* Clear Filters */}
                      <div className="flex flex-col gap-2 sm:justify-end">
                        <ModernButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearchQuery('');
                            setRoleFilter('all');
                            setStatusFilter('all');
                            setSortBy('name');
                            setSortOrder('asc');
                            setCurrentPage(1);
                          }}
                          className="text-muted-foreground mt-auto"
                          data-testid="clear-filters-button"
                        >
                          Clear All
                        </ModernButton>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Members Table */}
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="members-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Member
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedMembers.map(member => (
                    <tr
                      key={member.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      data-testid={`member-row-${member.id}`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{member.name}</span>
                              {member.id === currentUserId && (
                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex text-xs px-2 py-1 rounded-full font-medium ${
                            member.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {member.status === 'active' ? 'Active' : 'Invited'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <select
                          value={member.role}
                          onChange={e =>
                            handleUpdateMemberRole(member.id, e.target.value as OrgRole)
                          }
                          disabled={
                            !canManageMembers ||
                            member.id === currentUserId ||
                            member.role === 'owner'
                          }
                          className="w-full px-2 py-1 bg-background border border-border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          data-testid={`role-select-${member.id}`}
                        >
                          {member.role === 'owner' && <option value="owner">Owner</option>}
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          {member.status === 'active' && member.joinedAt ? (
                            <div>
                              <div className="font-medium">
                                {new Date(member.joinedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </div>
                              <div className="text-xs text-muted-foreground">Joined</div>
                            </div>
                          ) : member.status === 'invited' ? (
                            <div>
                              <div className="font-medium">
                                {member.invitedAt
                                  ? new Date(member.invitedAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })
                                  : 'Recently'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Invited
                                {member.invitedBy ? ` by ${member.invitedBy.name}` : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {canManageMembers &&
                          member.id !== currentUserId &&
                          member.role !== 'owner' && (
                            <ModernButton
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-destructive hover:bg-destructive/10"
                              data-testid={`remove-member-${member.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </ModernButton>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                className="flex items-center justify-between mt-6 pt-6 border-t border-border"
                data-testid="pagination"
              >
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, filteredMembers.length)} of{' '}
                  {filteredMembers.length} members
                </div>

                <div className="flex items-center gap-2">
                  <ModernButton
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="gap-1"
                    data-testid="previous-page-button"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    Previous
                  </ModernButton>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        return (
                          page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
                        );
                      })
                      .map((page, index, pages) => {
                        const prevPage = pages[index - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;

                        return (
                          <React.Fragment key={page}>
                            {showEllipsis && (
                              <span className="px-2 text-muted-foreground">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                                currentPage === page
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                              }`}
                              data-testid={`page-button-${page}`}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <ModernButton
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="gap-1"
                    data-testid="next-page-button"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </ModernButton>
                </div>
              </div>
            )}

            {/* Empty State */}
            {displayedMembers.length === 0 && (
              <div className="text-center py-12" data-testid="empty-state">
                <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                    ? 'No members found'
                    : 'No team members yet'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Invite your first team member to get started'}
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Invite Member Modal */}
        <AnimatePresence>
          {showInviteModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => handleInviteModalToggle(false)}
              data-testid="invite-member-modal"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-card rounded-2xl border border-border p-6 max-w-md w-full"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  Invite Team Member
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={e => {
                        setInviteForm(prev => ({ ...prev, email: e.target.value }));
                        setEmailTouched(true);
                      }}
                      onBlur={() => setEmailTouched(true)}
                      className={`w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        emailTouched && inviteForm.email && !isValidEmail(inviteForm.email)
                          ? 'border-red-500 focus:ring-red-500/50'
                          : emailTouched && isValidEmail(inviteForm.email)
                            ? 'border-green-500 focus:ring-green-500/50'
                            : 'border-border focus:ring-primary/50'
                      }`}
                      placeholder="colleague@example.com"
                      data-testid="invite-email-input"
                    />
                    {emailTouched && inviteForm.email && !isValidEmail(inviteForm.email) && (
                      <p className="text-red-500 text-xs mt-1" data-testid="email-error">
                        Please provide a valid email address (e.g., user@example.com)
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Role
                    </label>
                    <select
                      value={inviteForm.role}
                      onChange={e =>
                        setInviteForm(prev => ({ ...prev, role: e.target.value as OrgRole }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                      data-testid="invite-role-select"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {inviteForm.role === 'admin'
                        ? 'Can manage teams, standups, and invite members'
                        : 'Can participate in standups and view reports'}
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <ModernButton
                      onClick={handleInviteMember}
                      disabled={isInviting || !isValidEmail(inviteForm.email)}
                      className="flex-1 gap-2"
                      data-testid="send-invitation-button"
                    >
                      {isInviting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                      Send Invitation
                    </ModernButton>
                    <ModernButton
                      variant="outline"
                      onClick={() => handleInviteModalToggle(false)}
                      disabled={isInviting}
                      data-testid="cancel-invitation-button"
                    >
                      Cancel
                    </ModernButton>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Member Deletion Modal */}
        <ConfirmationModal
          isOpen={!!memberToDelete}
          onClose={handleCancelRemoveMember}
          onConfirm={handleConfirmRemoveMember}
          title="Remove Team Member"
          description={`Are you sure you want to remove ${memberToDelete?.name} from the organization? This action cannot be undone and they will lose access to all organizational resources.`}
          confirmText="Remove Member"
          isLoading={isDeletingMember}
          variant="danger"
        />
      </>
    );
  }
);

MembersSettings.displayName = 'MembersSettings';
