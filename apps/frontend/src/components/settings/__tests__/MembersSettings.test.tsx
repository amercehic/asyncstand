import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { MembersSettings } from '@/components/settings/MembersSettings';
import { organizationApi } from '@/lib/api';
import type { OrgMember } from '@/lib/api';

// Mock the API
vi.mock('@/lib/api', () => ({
  organizationApi: {
    inviteMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    getMembers: vi.fn(),
  },
}));

// Mock the toast and confirmation modal
vi.mock('@/components/ui', async () => {
  const actual = await vi.importActual('@/components/ui');
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
    ConfirmationModal: ({
      isOpen,
      onConfirm,
      onClose,
    }: {
      isOpen: boolean;
      onConfirm: () => void;
      onClose: () => void;
    }) =>
      isOpen ? (
        <div data-testid="confirmation-modal">
          <button onClick={onConfirm} data-testid="confirm-button">
            Confirm
          </button>
          <button onClick={onClose} data-testid="cancel-button">
            Cancel
          </button>
        </div>
      ) : null,
  };
});

describe('MembersSettings', () => {
  const mockMembers: OrgMember[] = [
    {
      id: 'member-1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'owner',
      status: 'active',
      joinedAt: '2023-01-01T00:00:00Z',
    },
    {
      id: 'member-2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'admin',
      status: 'active',
      joinedAt: '2023-01-02T00:00:00Z',
    },
    {
      id: 'member-3',
      name: 'Bob Johnson',
      email: 'bob@example.com',
      role: 'member',
      status: 'invited',
      invitedAt: '2023-01-03T00:00:00Z',
      invitedBy: { id: 'inviter-1', name: 'John Doe', email: 'john@example.com' },
    },
  ];

  const defaultProps = {
    members: mockMembers,
    canManageMembers: true,
    currentUserId: 'member-1',
    onMembersUpdate: vi.fn() as (members: OrgMember[]) => void,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Member Display', () => {
    it('renders members list correctly', () => {
      render(<MembersSettings {...defaultProps} />);

      expect(screen.getByText('Team Members')).toBeInTheDocument();
      expect(screen.getByTestId('members-count')).toHaveTextContent('3 of 3 members');
      expect(screen.getByTestId('members-table')).toBeInTheDocument();

      // Check individual members
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    it('shows invite button when user can manage members', () => {
      render(<MembersSettings {...defaultProps} />);

      expect(screen.getByTestId('invite-member-button')).toBeInTheDocument();
    });

    it('hides invite button when user cannot manage members', () => {
      render(<MembersSettings {...defaultProps} canManageMembers={false} />);

      expect(screen.queryByTestId('invite-member-button')).not.toBeInTheDocument();
    });

    it('displays correct member statuses', () => {
      render(<MembersSettings {...defaultProps} />);

      expect(screen.getAllByText('Active')).toHaveLength(2);
      expect(screen.getByText('Invited')).toBeInTheDocument();
    });

    it('marks current user with "You" label', () => {
      render(<MembersSettings {...defaultProps} />);

      // John Doe should have "You" label since currentUserId is 'member-1'
      expect(screen.getByText('You')).toBeInTheDocument();
    });
  });

  describe('Search and Filtering', () => {
    it('filters members by search query', () => {
      render(<MembersSettings {...defaultProps} />);

      const searchInput = screen.getByTestId('search-members-input');
      fireEvent.change(searchInput, { target: { value: 'John' } });

      // The search should find John Doe and Bob Johnson (Bob Johnson contains 'John')
      expect(screen.getByTestId('members-count')).toHaveTextContent('2 of 3 members');
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });

    it('shows filters panel when filters button is clicked', () => {
      render(<MembersSettings {...defaultProps} />);

      fireEvent.click(screen.getByTestId('filters-button'));

      expect(screen.getByTestId('filters-panel')).toBeInTheDocument();
      expect(screen.getByTestId('role-filter-select')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter-select')).toBeInTheDocument();
    });

    it('filters members by role', () => {
      render(<MembersSettings {...defaultProps} />);

      fireEvent.click(screen.getByTestId('filters-button'));

      const roleFilter = screen.getByTestId('role-filter-select');
      fireEvent.change(roleFilter, { target: { value: 'admin' } });

      expect(screen.getByTestId('members-count')).toHaveTextContent('1 of 3 members');
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('filters members by status', () => {
      render(<MembersSettings {...defaultProps} />);

      fireEvent.click(screen.getByTestId('filters-button'));

      const statusFilter = screen.getByTestId('status-filter-select');
      fireEvent.change(statusFilter, { target: { value: 'invited' } });

      expect(screen.getByTestId('members-count')).toHaveTextContent('1 of 3 members');
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('clears all filters when clear button is clicked', () => {
      render(<MembersSettings {...defaultProps} />);

      // Apply filters
      const searchInput = screen.getByTestId('search-members-input');
      fireEvent.change(searchInput, { target: { value: 'John' } });

      fireEvent.click(screen.getByTestId('filters-button'));
      const roleFilter = screen.getByTestId('role-filter-select');
      fireEvent.change(roleFilter, { target: { value: 'admin' } });

      // Clear filters
      fireEvent.click(screen.getByTestId('clear-filters-button'));

      expect(screen.getByTestId('members-count')).toHaveTextContent('3 of 3 members');
      expect((searchInput as HTMLInputElement).value).toBe('');
      expect((roleFilter as HTMLSelectElement).value).toBe('all');
    });
  });

  describe('Sorting', () => {
    it('sorts members by name in ascending order by default', () => {
      render(<MembersSettings {...defaultProps} />);

      const memberRows = screen.getAllByTestId(/^member-row-/);
      expect(memberRows[0]).toHaveTextContent('Bob Johnson');
      expect(memberRows[1]).toHaveTextContent('Jane Smith');
      expect(memberRows[2]).toHaveTextContent('John Doe');
    });

    it('toggles sort order when sort order button is clicked', () => {
      render(<MembersSettings {...defaultProps} />);

      fireEvent.click(screen.getByTestId('filters-button'));

      const sortOrderButton = screen.getByTestId('sort-order-button');
      expect(sortOrderButton).toHaveTextContent('Asc');

      fireEvent.click(sortOrderButton);
      expect(sortOrderButton).toHaveTextContent('Desc');

      // Names should now be in descending order
      const memberRows = screen.getAllByTestId(/^member-row-/);
      expect(memberRows[0]).toHaveTextContent('John Doe');
      expect(memberRows[1]).toHaveTextContent('Jane Smith');
      expect(memberRows[2]).toHaveTextContent('Bob Johnson');
    });
  });

  describe('Invite Member', () => {
    it('opens invite modal when invite button is clicked', () => {
      render(<MembersSettings {...defaultProps} />);

      fireEvent.click(screen.getByTestId('invite-member-button'));

      expect(screen.getByTestId('invite-member-modal')).toBeInTheDocument();
      expect(screen.getByTestId('invite-email-input')).toBeInTheDocument();
      expect(screen.getByTestId('invite-role-select')).toBeInTheDocument();
    });

    it('validates email input', () => {
      render(<MembersSettings {...defaultProps} />);

      fireEvent.click(screen.getByTestId('invite-member-button'));

      const emailInput = screen.getByTestId('invite-email-input');
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      expect(screen.getByTestId('email-error')).toHaveTextContent(
        'Please provide a valid email address'
      );
    });

    it('sends invitation successfully', async () => {
      const mockInviteMember = vi.fn().mockResolvedValue({});
      const mockGetMembers = vi.fn().mockResolvedValue([...mockMembers]);
      (
        organizationApi.inviteMember as MockedFunction<typeof organizationApi.inviteMember>
      ).mockImplementation(mockInviteMember);
      (
        organizationApi.getMembers as MockedFunction<typeof organizationApi.getMembers>
      ).mockImplementation(mockGetMembers);

      const { toast } = await import('@/components/ui');
      const onMembersUpdate = vi.fn();

      render(<MembersSettings {...defaultProps} onMembersUpdate={onMembersUpdate} />);

      fireEvent.click(screen.getByTestId('invite-member-button'));

      const emailInput = screen.getByTestId('invite-email-input');
      const roleSelect = screen.getByTestId('invite-role-select');

      fireEvent.change(emailInput, { target: { value: 'newmember@example.com' } });
      fireEvent.change(roleSelect, { target: { value: 'admin' } });

      fireEvent.click(screen.getByTestId('send-invitation-button'));

      await waitFor(() => {
        expect(mockInviteMember).toHaveBeenCalledWith('newmember@example.com', 'admin');
        expect(toast.success).toHaveBeenCalledWith('Invitation sent to newmember@example.com');
        expect(onMembersUpdate).toHaveBeenCalled();
      });
    });

    it('handles invitation error', async () => {
      const mockInviteMember = vi.fn().mockRejectedValue({
        response: { data: { message: 'User already exists' } },
      });
      (
        organizationApi.inviteMember as MockedFunction<typeof organizationApi.inviteMember>
      ).mockImplementation(mockInviteMember);

      const { toast } = await import('@/components/ui');

      render(<MembersSettings {...defaultProps} />);

      fireEvent.click(screen.getByTestId('invite-member-button'));

      const emailInput = screen.getByTestId('invite-email-input');
      fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });

      fireEvent.click(screen.getByTestId('send-invitation-button'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('User already exists');
      });
    });
  });

  describe('Role Management', () => {
    it('updates member role successfully', async () => {
      const mockUpdateMemberRole = vi.fn().mockResolvedValue({});
      (
        organizationApi.updateMemberRole as MockedFunction<typeof organizationApi.updateMemberRole>
      ).mockImplementation(mockUpdateMemberRole);

      const { toast } = await import('@/components/ui');
      const onMembersUpdate = vi.fn();

      render(<MembersSettings {...defaultProps} onMembersUpdate={onMembersUpdate} />);

      const roleSelect = screen.getByTestId('role-select-member-2');
      fireEvent.change(roleSelect, { target: { value: 'member' } });

      await waitFor(() => {
        expect(mockUpdateMemberRole).toHaveBeenCalledWith('member-2', 'member');
        expect(toast.success).toHaveBeenCalledWith('Member role updated');
        expect(onMembersUpdate).toHaveBeenCalled();
      });
    });

    it('disables role select for current user', () => {
      render(<MembersSettings {...defaultProps} />);

      const ownerRoleSelect = screen.getByTestId('role-select-member-1');
      expect(ownerRoleSelect).toBeDisabled();
    });

    it('disables role select for owner role', () => {
      render(<MembersSettings {...defaultProps} />);

      const ownerRoleSelect = screen.getByTestId('role-select-member-1');
      expect(ownerRoleSelect).toBeDisabled();
    });
  });

  describe('Member Removal', () => {
    it('shows confirmation modal when remove button is clicked', () => {
      render(<MembersSettings {...defaultProps} />);

      const removeButton = screen.getByTestId('remove-member-member-2');
      fireEvent.click(removeButton);

      expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
    });

    it('removes member successfully', async () => {
      const mockRemoveMember = vi.fn().mockResolvedValue({});
      (
        organizationApi.removeMember as MockedFunction<typeof organizationApi.removeMember>
      ).mockImplementation(mockRemoveMember);

      const { toast } = await import('@/components/ui');
      const onMembersUpdate = vi.fn();

      render(<MembersSettings {...defaultProps} onMembersUpdate={onMembersUpdate} />);

      const removeButton = screen.getByTestId('remove-member-member-2');
      fireEvent.click(removeButton);

      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockRemoveMember).toHaveBeenCalledWith('member-2');
        expect(toast.success).toHaveBeenCalledWith('Member removed');
        expect(onMembersUpdate).toHaveBeenCalled();
      });
    });

    it('does not show remove button for current user', () => {
      render(<MembersSettings {...defaultProps} />);

      expect(screen.queryByTestId('remove-member-member-1')).not.toBeInTheDocument();
    });

    it('does not show remove button for owner', () => {
      render(<MembersSettings {...defaultProps} />);

      expect(screen.queryByTestId('remove-member-member-1')).not.toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    const manyMembers = Array.from({ length: 25 }, (_, i) => ({
      id: `member-${i + 1}`,
      name: `Member ${i + 1}`,
      email: `member${i + 1}@example.com`,
      role: 'member' as const,
      status: 'active' as const,
      joinedAt: '2023-01-01T00:00:00Z',
    }));

    it('shows pagination when there are more than 10 members', () => {
      render(<MembersSettings {...defaultProps} members={manyMembers} />);

      expect(screen.getByTestId('pagination')).toBeInTheDocument();
      expect(screen.getByTestId('previous-page-button')).toBeInTheDocument();
      expect(screen.getByTestId('next-page-button')).toBeInTheDocument();
    });

    it('navigates to next page', () => {
      render(<MembersSettings {...defaultProps} members={manyMembers} />);

      const nextButton = screen.getByTestId('next-page-button');
      fireEvent.click(nextButton);

      expect(screen.getByTestId('page-button-2')).toHaveClass('bg-primary text-primary-foreground');
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no members match filters', () => {
      render(<MembersSettings {...defaultProps} />);

      const searchInput = screen.getByTestId('search-members-input');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No members found')).toBeInTheDocument();
    });

    it('shows empty state for no members at all', () => {
      render(<MembersSettings {...defaultProps} members={[]} />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No team members yet')).toBeInTheDocument();
    });
  });
});
