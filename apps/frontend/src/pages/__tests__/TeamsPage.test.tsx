import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import React from 'react';

import { TeamsPage } from '@/pages/TeamsPage';
import { useTeams } from '@/contexts';
import { teamsApi } from '@/lib/api';
import type { Team } from '@/types';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  teamsApi: {
    getTeams: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
  },
  integrationsApi: {
    getSlackIntegrationsForTeamCreation: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

// Mock the useTeams hook
vi.mock('@/contexts', async () => {
  const actual = await vi.importActual('@/contexts');
  return {
    ...actual,
    useTeams: vi.fn(),
  };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ search: '', pathname: '/teams' }),
  };
});

describe('TeamsPage', () => {
  const mockTeams: Team[] = [
    {
      id: 'team-1',
      name: 'Frontend Team',
      description: 'Frontend development team',
      members: [
        {
          id: 'user-1',
          name: 'John Doe',
          email: 'john@example.com',
          role: 'admin',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
        {
          id: 'user-2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          role: 'user',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
      ],
      channel: {
        id: 'channel-1',
        name: 'frontend',
      },
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      isActive: true,
    },
    {
      id: 'team-2',
      name: 'Backend Team',
      description: 'Backend development team',
      members: [
        {
          id: 'user-3',
          name: 'Bob Johnson',
          email: 'bob@example.com',
          role: 'user',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
      ],
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      isActive: true,
    },
  ];

  const mockUseTeams = {
    teams: mockTeams,
    selectedTeam: null,
    isLoading: false,
    isRefreshing: false,
    isCreating: false,
    lastFetchedAt: null,
    error: null,
    fetchTeams: vi.fn(),
    refreshTeams: vi.fn(),
    createTeam: vi.fn(),
    getTeamById: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
    selectTeam: vi.fn(),
    getTeamByIdFromCache: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTeams).mockReturnValue(mockUseTeams);
  });

  const renderWithRouter = (initialEntries = ['/teams']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <TeamsPage />
      </MemoryRouter>
    );
  };

  it('renders page header and navigation', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Your Teams')).toBeInTheDocument();
      expect(
        screen.getByText('Manage your teams and collaborate on async standups.')
      ).toBeInTheDocument();
      expect(screen.getByTestId('join-team-button')).toBeInTheDocument();
      expect(screen.getByTestId('create-team-button')).toBeInTheDocument();
    });
  });

  it('displays statistics dashboard when teams exist', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Total Teams')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 teams

      expect(screen.getByText('Total Members')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // 3 members total

      expect(screen.getByText('With Slack')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // 1 team with Slack

      expect(screen.getByText('Avg per Team')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Average 2 members per team
    });
  });

  it('displays teams in table format', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Team')).toBeInTheDocument();
      expect(screen.getByText('Members')).toBeInTheDocument();
      expect(screen.getByText('Integration')).toBeInTheDocument();
      expect(screen.getByText('Activity')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    // Check team data
    expect(screen.getByText('Frontend Team')).toBeInTheDocument();
    expect(screen.getByText('Backend Team')).toBeInTheDocument();
    expect(screen.getByText('Frontend development team')).toBeInTheDocument();
    expect(screen.getByText('#frontend')).toBeInTheDocument();
  });

  it('navigates to team detail page when team row is clicked', async () => {
    renderWithRouter();

    await waitFor(() => {
      const teamRow = screen.getByText('Frontend Team').closest('.cursor-pointer');
      expect(teamRow).toBeInTheDocument();
      fireEvent.click(teamRow!);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/teams/team-1');
  });

  it('shows View button that navigates to team detail page', async () => {
    renderWithRouter();

    await waitFor(() => {
      const viewButton = screen.getByTestId('view-team-team-1');
      fireEvent.click(viewButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/teams/team-1');
  });

  it('shows dropdown menu with actions when three dots are clicked', async () => {
    renderWithRouter();

    await waitFor(() => {
      const actionsButton = screen.getByTestId('team-actions-team-1');
      fireEvent.click(actionsButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Team Settings')).toBeInTheDocument();
      expect(screen.getByText('View Standups')).toBeInTheDocument();
      expect(screen.getByText('Create Standup')).toBeInTheDocument();
    });
  });

  it('opens team settings modal when Team Settings is clicked', async () => {
    renderWithRouter();

    await waitFor(() => {
      const actionsButton = screen.getByTestId('team-actions-team-1');
      fireEvent.click(actionsButton);
    });

    await waitFor(() => {
      const settingsOption = screen.getByText('Team Settings');
      fireEvent.click(settingsOption);
    });

    // Should open team settings modal
    await waitFor(() => {
      expect(screen.getByText('Configure Frontend Team')).toBeInTheDocument();
    });
  });

  it('navigates to team detail page when View Standups is clicked', async () => {
    renderWithRouter();

    await waitFor(() => {
      const actionsButton = screen.getByTestId('team-actions-team-1');
      fireEvent.click(actionsButton);
    });

    await waitFor(() => {
      const viewStandupsOption = screen.getByText('View Standups');
      fireEvent.click(viewStandupsOption);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/teams/team-1');
  });

  it('navigates to create standup page when Create Standup is clicked', async () => {
    renderWithRouter();

    await waitFor(() => {
      const actionsButton = screen.getByTestId('team-actions-team-1');
      fireEvent.click(actionsButton);
    });

    await waitFor(() => {
      const createStandupOption = screen.getByText('Create Standup');
      fireEvent.click(createStandupOption);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/teams/team-1/standups/create');
  });

  it('displays member avatars and count', async () => {
    renderWithRouter();

    await waitFor(() => {
      // Check member count display
      expect(screen.getByText('2')).toBeInTheDocument(); // Frontend team has 2 members
      expect(screen.getByText('1')).toBeInTheDocument(); // Backend team has 1 member

      // Check avatars are displayed (first letter of names)
      expect(screen.getAllByText('J')).toHaveLength(2); // John and Jane's avatars
      expect(screen.getByText('B')).toBeInTheDocument(); // Bob's avatar
    });
  });

  it('shows connected/not connected status for Slack integration', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('#frontend')).toBeInTheDocument(); // Connected team
      expect(screen.getByText('Not connected')).toBeInTheDocument(); // Backend team not connected
    });
  });

  it('shows join team functionality', async () => {
    renderWithRouter();

    const joinButton = screen.getByTestId('join-team-button');
    fireEvent.click(joinButton);

    expect(toast.info).toHaveBeenCalledWith('Join team functionality - Coming soon!');
  });

  it('opens create team modal when create button is clicked', async () => {
    renderWithRouter();

    const createButton = screen.getByTestId('create-team-button');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Set up a new team for async standups')).toBeInTheDocument();
    });
  });

  it('shows loading state when teams are loading', async () => {
    vi.mocked(useTeams).mockReturnValue({
      ...mockUseTeams,
      isLoading: true,
    });

    renderWithRouter();

    expect(screen.getByText('Loading teams...')).toBeInTheDocument();
  });

  it('shows empty state when no teams exist', async () => {
    vi.mocked(useTeams).mockReturnValue({
      ...mockUseTeams,
      teams: [],
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('No Teams Yet')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Get started by creating your first team or joining an existing one to begin collaborating on async standups.'
        )
      ).toBeInTheDocument();
      expect(screen.getByTestId('empty-join-team-button')).toBeInTheDocument();
      expect(screen.getByTestId('empty-create-team-button')).toBeInTheDocument();
    });
  });

  it('does not display statistics dashboard when no teams exist', async () => {
    vi.mocked(useTeams).mockReturnValue({
      ...mockUseTeams,
      teams: [],
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.queryByText('Total Teams')).not.toBeInTheDocument();
      expect(screen.queryByText('Total Members')).not.toBeInTheDocument();
    });
  });

  it('handles team settings update success', async () => {
    vi.mocked(teamsApi.updateTeam).mockResolvedValue(mockTeams[0]);

    renderWithRouter();

    await waitFor(() => {
      const actionsButton = screen.getByTestId('team-actions-team-1');
      fireEvent.click(actionsButton);
    });

    await waitFor(() => {
      const settingsOption = screen.getByText('Team Settings');
      fireEvent.click(settingsOption);
    });

    // Update team name in settings modal
    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Frontend Team');
      fireEvent.change(nameInput, { target: { value: 'Updated Frontend Team' } });
    });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUseTeams.refreshTeams).toHaveBeenCalled();
    });
  });

  it('auto-opens create modal when URL has create parameter', async () => {
    renderWithRouter(['/teams?create=1']);

    await waitFor(() => {
      expect(screen.getByText('Set up a new team for async standups')).toBeInTheDocument();
    });
  });

  it('calculates statistics correctly with different team compositions', async () => {
    const teamsWithDifferentComposition = [
      {
        ...mockTeams[0],
        members: [
          {
            id: 'user-1',
            name: 'User 1',
            email: 'user1@example.com',
            role: 'user' as const,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'user-2',
            name: 'User 2',
            email: 'user2@example.com',
            role: 'user' as const,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'user-3',
            name: 'User 3',
            email: 'user3@example.com',
            role: 'user' as const,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        channel: undefined, // No Slack integration
      },
      {
        ...mockTeams[1],
        members: [
          {
            id: 'user-4',
            name: 'User 4',
            email: 'user4@example.com',
            role: 'user' as const,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'user-5',
            name: 'User 5',
            email: 'user5@example.com',
            role: 'user' as const,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'user-6',
            name: 'User 6',
            email: 'user6@example.com',
            role: 'user' as const,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'user-7',
            name: 'User 7',
            email: 'user7@example.com',
            role: 'user' as const,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        channel: {
          id: 'channel-2',
          name: 'backend',
          platform: 'Slack',
        },
      },
    ];

    vi.mocked(useTeams).mockReturnValue({
      ...mockUseTeams,
      teams: teamsWithDifferentComposition,
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 teams
      expect(screen.getByText('7')).toBeInTheDocument(); // 7 members total (3+4)
      expect(screen.getByText('1')).toBeInTheDocument(); // 1 team with Slack
      expect(screen.getByText('4')).toBeInTheDocument(); // Average 4 members per team (rounded)
    });
  });

  it('handles overflow with many team members', async () => {
    const teamWithManyMembers = {
      ...mockTeams[0],
      members: [
        {
          id: 'user-1',
          name: 'User 1',
          email: 'user1@example.com',
          role: 'user' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'user-2',
          name: 'User 2',
          email: 'user2@example.com',
          role: 'user' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'user-3',
          name: 'User 3',
          email: 'user3@example.com',
          role: 'user' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'user-4',
          name: 'User 4',
          email: 'user4@example.com',
          role: 'user' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'user-5',
          name: 'User 5',
          email: 'user5@example.com',
          role: 'user' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
    };

    vi.mocked(useTeams).mockReturnValue({
      ...mockUseTeams,
      teams: [teamWithManyMembers],
    });

    renderWithRouter();

    await waitFor(() => {
      // Should show only first 3 avatars + count
      expect(screen.getByText('+2')).toBeInTheDocument(); // +2 for remaining members
      expect(screen.getByText('5')).toBeInTheDocument(); // Total member count
    });
  });
});
