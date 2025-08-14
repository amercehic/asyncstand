import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { toast } from '@/components/ui';
import React from 'react';

import { TeamMemberAssignmentModal } from '@/components/TeamMemberAssignmentModal';
import { teamsApi } from '@/lib/api';
import type { Team } from '@/types';
import type { AvailableMemberDetails } from '@/types/backend';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  teamsApi: {
    getAvailableMembers: vi.fn(),
    assignPlatformMembers: vi.fn(),
    removePlatformMembers: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    custom: vi.fn(),
  },
  Toaster: () => null,
}));

vi.mock('@/components/ui/modern-toast', () => ({
  modernToast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// This component doesn't use react-router-dom but tests will inherit the mock from test utils
// so we don't need to mock it here

describe('TeamMemberAssignmentModal', () => {
  const mockTeam: Team = {
    id: 'team-1',
    name: 'Engineering Team',
    description: 'Our awesome engineering team',
    members: [
      {
        id: 'member-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
    ],
    channel: {
      id: 'channel-1',
      name: 'engineering',
    },
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
    isActive: true,
  };

  const mockAvailableMembers: AvailableMemberDetails[] = [
    {
      id: 'workspace-1',
      name: 'John Doe',
      platformUserId: 'U12345',
      inTeamCount: 1,
    },
    {
      id: 'workspace-2',
      name: 'Jane Smith',
      platformUserId: 'U67890',
      inTeamCount: 0,
    },
    {
      id: 'workspace-3',
      name: 'Bob Wilson',
      platformUserId: 'U54321',
      inTeamCount: 2,
    },
  ];

  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    team: mockTeam,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open', () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({ members: [] });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    expect(screen.getByText('Manage Team Members')).toBeInTheDocument();
    expect(screen.getByText('Assign workspace members to Engineering Team')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<TeamMemberAssignmentModal {...mockProps} isOpen={false} />);

    expect(screen.queryByText('Manage Team Members')).not.toBeInTheDocument();
  });

  it('loads and displays available members', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({
      members: mockAvailableMembers,
    });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
    });

    expect(teamsApi.getAvailableMembers).toHaveBeenCalled();
  });

  it('shows loading state while fetching members', () => {
    vi.mocked(teamsApi.getAvailableMembers).mockImplementation(() => new Promise(() => {}));

    render(<TeamMemberAssignmentModal {...mockProps} />);

    expect(screen.getByText('Loading workspace members...')).toBeInTheDocument();
  });

  it('displays member assignment status correctly', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({
      members: mockAvailableMembers,
    });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      // John Doe is already in the team (matched by name)
      expect(screen.getByText('✓ In Team')).toBeInTheDocument();

      // Jane Smith and Bob Wilson are available
      expect(screen.getAllByText('Available')).toHaveLength(2);
    });
  });

  it('shows team count badges for members in multiple teams', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({
      members: mockAvailableMembers,
    });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      // John Doe has 1 team (this team)
      expect(screen.getByText('1 team')).toBeInTheDocument();

      // Bob Wilson has 2 teams
      expect(screen.getByText('2 teams')).toBeInTheDocument();
    });
  });

  it('filters members by search query', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({
      members: mockAvailableMembers,
    });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search workspace members...');
    fireEvent.change(searchInput, { target: { value: 'Jane' } });

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument();
    });
  });

  it('filters members by assignment status', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({
      members: mockAvailableMembers,
    });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('(3 members)')).toBeInTheDocument();
    });

    // Filter to show only available members
    const filterSelect = screen.getByDisplayValue('All Members');
    fireEvent.change(filterSelect, { target: { value: 'available' } });

    await waitFor(() => {
      expect(screen.getByText('(2 members)')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    // Filter to show only assigned members
    fireEvent.change(filterSelect, { target: { value: 'assigned' } });

    await waitFor(() => {
      expect(screen.getByText('(1 member)')).toBeInTheDocument(); // Should be singular "member", not "members"
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument();
    });
  });

  it('handles member selection', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({
      members: mockAvailableMembers,
    });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Click on Jane Smith to select her
    fireEvent.click(screen.getByText('Jane Smith'));

    await waitFor(() => {
      expect(screen.getByText('1 member selected')).toBeInTheDocument();
      expect(screen.getByText('1 to add')).toBeInTheDocument();
    });
  });

  it('handles select all functionality', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({
      members: mockAvailableMembers,
    });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Select All')).toBeInTheDocument();
    });

    // Click select all
    fireEvent.click(screen.getByText('Select All'));

    await waitFor(() => {
      expect(screen.getByText('3 members selected')).toBeInTheDocument();
      expect(screen.getByText('Deselect All')).toBeInTheDocument();
    });

    // Click deselect all
    fireEvent.click(screen.getByText('Deselect All'));

    await waitFor(() => {
      expect(screen.queryByText('members selected')).not.toBeInTheDocument();
      expect(screen.getByText('Select All')).toBeInTheDocument();
    });
  });

  it('assigns new members successfully', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({
      members: mockAvailableMembers,
    });
    vi.mocked(teamsApi.assignPlatformMembers).mockResolvedValue(undefined);

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Select Jane Smith (available member)
    fireEvent.click(screen.getByText('Jane Smith'));

    await waitFor(() => {
      expect(screen.getByText('1 to add')).toBeInTheDocument();
    });

    // Click Apply Changes
    fireEvent.click(screen.getByText('Apply Changes'));

    await waitFor(() => {
      expect(teamsApi.assignPlatformMembers).toHaveBeenCalledWith('team-1', ['U67890']);
      expect(mockProps.onSuccess).toHaveBeenCalled();
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  it('removes members successfully', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({
      members: mockAvailableMembers,
    });
    vi.mocked(teamsApi.removePlatformMembers).mockResolvedValue(undefined);

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Select John Doe (assigned member)
    fireEvent.click(screen.getByText('John Doe'));

    await waitFor(() => {
      expect(screen.getByText('1 to remove')).toBeInTheDocument();
    });

    // Click Apply Changes
    fireEvent.click(screen.getByText('Apply Changes'));

    await waitFor(() => {
      expect(teamsApi.removePlatformMembers).toHaveBeenCalledWith('team-1', ['member-1']);
      expect(mockProps.onSuccess).toHaveBeenCalled();
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  it('shows bulk operation confirmation for large changes', async () => {
    const manyMembers: AvailableMemberDetails[] = Array.from({ length: 10 }, (_, i) => ({
      id: `workspace-${i}`,
      name: `User ${i}`,
      platformUserId: `U${i.toString().padStart(5, '0')}`,
      inTeamCount: 0,
    }));

    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({
      members: manyMembers,
    });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Select All')).toBeInTheDocument();
    });

    // Select all members (10 members > 5 threshold)
    fireEvent.click(screen.getByText('Select All'));

    await waitFor(() => {
      expect(screen.getByText('10 members selected')).toBeInTheDocument();
    });

    // Click Apply Changes - should show confirmation dialog
    fireEvent.click(screen.getByText('Apply Changes'));

    await waitFor(() => {
      expect(screen.getByText('Confirm Bulk Operation')).toBeInTheDocument();
      expect(screen.getByText("You're about to affect 10 members")).toBeInTheDocument();
    });
  });

  it('shows no changes message when no members selected', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({
      members: mockAvailableMembers,
    });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Apply Changes')).toBeInTheDocument();
    });

    // The Apply Changes button should be disabled when no members are selected
    const applyButton = screen.getByText('Apply Changes');
    expect(applyButton.closest('button')).toBeDisabled();

    // For this test, we'll need to select a member first, then deselect to test the no changes case
    // Let's select John Doe (assigned) and then deselect him to test no changes
    fireEvent.click(screen.getByText('John Doe'));

    await waitFor(() => {
      expect(screen.getByText('1 to remove')).toBeInTheDocument();
    });

    // Deselect John Doe
    fireEvent.click(screen.getByText('John Doe'));

    await waitFor(() => {
      expect(screen.queryByText('1 to remove')).not.toBeInTheDocument();
      const button = screen.getByText('Apply Changes').closest('button');
      expect(button).toBeDisabled();
    });
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockRejectedValue(new Error('API Error'));

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load workspace members', {
        id: 'load-members-team-1',
      });
    });
  });

  it('shows empty state when no members found', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({ members: [] });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('No members found')).toBeInTheDocument();
      expect(screen.getByText('No workspace members available')).toBeInTheDocument();
    });
  });

  it('shows empty state when search has no results', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({
      members: mockAvailableMembers,
    });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Search for non-existent member
    const searchInput = screen.getByPlaceholderText('Search workspace members...');
    fireEvent.change(searchInput, { target: { value: 'NonExistentUser' } });

    await waitFor(() => {
      expect(screen.getByText('No members found')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your search or filter criteria')).toBeInTheDocument();
    });
  });

  it('closes modal when close button is clicked', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({ members: [] });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    const closeButton = screen.getByRole('button', { name: '' }); // X button
    fireEvent.click(closeButton);

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('closes modal when cancel button is clicked', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({ members: [] });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('prevents body scroll when modal is open', () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({ members: [] });

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    render(<TeamMemberAssignmentModal {...mockProps} />);

    expect(document.body.style.overflow).toBe('hidden');

    // Clean up
    document.body.style.overflow = originalOverflow;
    document.body.style.paddingRight = originalPaddingRight;
  });

  it('handles ESC key to close modal', async () => {
    vi.mocked(teamsApi.getAvailableMembers).mockResolvedValue({ members: [] });

    render(<TeamMemberAssignmentModal {...mockProps} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockProps.onClose).toHaveBeenCalled();
  });
});
