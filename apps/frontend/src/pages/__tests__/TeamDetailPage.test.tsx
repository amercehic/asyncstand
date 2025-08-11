import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import React from 'react';

import { TeamDetailPage } from '@/pages/TeamDetailPage';
import { teamsApi, standupsApi } from '@/lib/api';
import type { Team, StandupConfig, StandupInstance } from '@/types';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  teamsApi: {
    getTeam: vi.fn(),
  },
  standupsApi: {
    getTeamStandups: vi.fn(),
    getStandupInstances: vi.fn(),
    updateStandup: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
  Toaster: () => null,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ teamId: 'team-1' }),
  };
});

describe('TeamDetailPage', () => {
  const mockTeam: Team = {
    id: 'team-1',
    name: 'Frontend Team',
    description: 'A team focused on frontend development',
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
      {
        id: 'user-3',
        name: 'Bob Johnson',
        email: 'bob@example.com',
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
  };

  const mockStandups: StandupConfig[] = [
    {
      id: 'standup-1',
      teamId: 'team-1',
      name: 'Daily Standup',
      questions: ['What did you work on yesterday?', 'What will you work on today?'],
      schedule: {
        time: '09:00',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        timezone: 'UTC',
      },
      isActive: true,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    },
    {
      id: 'standup-2',
      teamId: 'team-1',
      name: 'Weekly Retro',
      questions: ['What went well?', 'What could be improved?'],
      schedule: {
        time: '15:00',
        days: ['friday'],
        timezone: 'UTC',
      },
      isActive: false,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    },
  ];

  const mockInstances: StandupInstance[] = [
    {
      id: 'instance-1',
      configId: 'standup-1',
      date: '2023-10-15',
      status: 'completed',
      participants: ['user-1', 'user-2'],
      responses: [
        {
          id: 'response-1',
          instanceId: 'instance-1',
          userId: 'user-1',
          answers: {},
          submittedAt: '2023-10-15T10:00:00.000Z',
        },
      ],
      createdAt: '2023-10-15T09:00:00.000Z',
      updatedAt: '2023-10-15T10:00:00.000Z',
    },
    {
      id: 'instance-2',
      configId: 'standup-1',
      date: '2023-10-14',
      status: 'active',
      participants: ['user-1'],
      responses: [],
      createdAt: '2023-10-14T09:00:00.000Z',
      updatedAt: '2023-10-14T09:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(teamsApi.getTeam).mockResolvedValue(mockTeam);
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue(mockStandups);
    vi.mocked(standupsApi.getStandupInstances).mockResolvedValue(mockInstances);
  });

  const renderWithRouter = (teamId = 'team-1') => {
    return render(
      <MemoryRouter initialEntries={[`/teams/${teamId}`]}>
        <TeamDetailPage />
      </MemoryRouter>
    );
  };

  it('shows loading state initially', () => {
    renderWithRouter();

    expect(screen.getByText('Loading team details...')).toBeInTheDocument();
  });

  it('fetches and displays team details', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(teamsApi.getTeam).toHaveBeenCalledWith('team-1');
      expect(standupsApi.getTeamStandups).toHaveBeenCalledWith('team-1');
    });

    expect(screen.getByText('Frontend Team')).toBeInTheDocument();
    expect(screen.getByText('3 members')).toBeInTheDocument();
  });

  it('displays team description when available', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('About')).toBeInTheDocument();
      expect(screen.getByText('A team focused on frontend development')).toBeInTheDocument();
    });
  });

  it('displays integration information when channel exists', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Integration')).toBeInTheDocument();
      expect(screen.getByText('#frontend')).toBeInTheDocument();
      expect(screen.getByText('Slack channel')).toBeInTheDocument();
    });
  });

  it('does not display integration section when no channel', async () => {
    const teamWithoutChannel = { ...mockTeam, channel: undefined };
    vi.mocked(teamsApi.getTeam).mockResolvedValue(teamWithoutChannel);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Frontend Team')).toBeInTheDocument();
    });

    expect(screen.queryByText('Integration')).not.toBeInTheDocument();
  });

  it('displays active standups section', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Active Standups')).toBeInTheDocument();
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      expect(screen.getByText('Weekdays at 09:00')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('shows inactive standups without active badge', async () => {
    const inactiveStandup = { ...mockStandups[1], isActive: false };
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([mockStandups[0], inactiveStandup]);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Weekly Retro')).toBeInTheDocument();
    });

    // Check that inactive standup doesn't have Active badge
    const weeklyRetroCard = screen.getByText('Weekly Retro').closest('.cursor-pointer');
    expect(weeklyRetroCard).not.toHaveTextContent('Active');
  });

  it('navigates to standup details when standup is clicked', async () => {
    renderWithRouter();

    await waitFor(() => {
      const standupCard = screen.getByText('Daily Standup').closest('.cursor-pointer');
      fireEvent.click(standupCard!);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/standups/instance-1');
  });

  it('shows standup dropdown menu actions', async () => {
    renderWithRouter();

    await waitFor(() => {
      const dropdownButtons = screen.getAllByRole('button', { name: /more/i });
      const standupDropdown = dropdownButtons.find(button =>
        button.closest('.cursor-pointer')?.textContent?.includes('Daily Standup')
      );
      fireEvent.click(standupDropdown!);
    });

    await waitFor(() => {
      expect(screen.getByText('View Recent')).toBeInTheDocument();
      expect(screen.getByText('Edit Standup')).toBeInTheDocument();
      expect(screen.getByText('View History')).toBeInTheDocument();
    });
  });

  it('opens standup edit modal when Edit Standup is clicked', async () => {
    renderWithRouter();

    await waitFor(() => {
      const dropdownButtons = screen.getAllByRole('button', { name: /more/i });
      const standupDropdown = dropdownButtons.find(button =>
        button.closest('.cursor-pointer')?.textContent?.includes('Daily Standup')
      );
      fireEvent.click(standupDropdown!);
    });

    await waitFor(() => {
      const editOption = screen.getByText('Edit Standup');
      fireEvent.click(editOption);
    });

    await waitFor(() => {
      expect(screen.getByText('Update standup configuration')).toBeInTheDocument();
    });
  });

  it('shows info toast when View History is clicked', async () => {
    renderWithRouter();

    await waitFor(() => {
      const dropdownButtons = screen.getAllByRole('button', { name: /more/i });
      const standupDropdown = dropdownButtons.find(button =>
        button.closest('.cursor-pointer')?.textContent?.includes('Daily Standup')
      );
      fireEvent.click(standupDropdown!);
    });

    await waitFor(() => {
      const historyOption = screen.getByText('View History');
      fireEvent.click(historyOption);
    });

    expect(toast.info).toHaveBeenCalledWith('View all standup history - Coming soon!');
  });

  it('displays team members in sidebar', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Team Members')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument(); // John's role
    });
  });

  it('displays team statistics', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Team Stats')).toBeInTheDocument();
      expect(screen.getByText('Active Standups')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // 1 active standup
      expect(screen.getByText('This Week')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 recent instances
      expect(screen.getByText('Completion Rate')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });
  });

  it('displays recent activity section', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    // Should display recent instances
    const activityItems = screen.getAllByText(/Daily Standup|Weekly Retro/);
    expect(activityItems.length).toBeGreaterThan(0);
  });

  it('navigates to recent instance when clicked', async () => {
    renderWithRouter();

    await waitFor(() => {
      const recentActivityItems = screen.getAllByText('Daily Standup');
      // Click on the one in Recent Activity section (not the Active Standups one)
      const activityItem = recentActivityItems.find(item =>
        item.closest('.cursor-pointer')?.textContent?.includes('1/2 responses')
      );
      if (activityItem) {
        fireEvent.click(activityItem.closest('.cursor-pointer')!);
      }
    });

    expect(mockNavigate).toHaveBeenCalledWith('/standups/instance-1');
  });

  it('opens team settings modal when Settings button is clicked', async () => {
    renderWithRouter();

    await waitFor(() => {
      const settingsButton = screen.getByTestId('team-settings-button');
      fireEvent.click(settingsButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Configure Frontend Team')).toBeInTheDocument();
    });
  });

  it('navigates to create standup page when New Standup is clicked', async () => {
    renderWithRouter();

    await waitFor(() => {
      const newStandupButton = screen.getByTestId('create-standup-button');
      fireEvent.click(newStandupButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/teams/team-1/standups/create');
  });

  it('shows empty state when no standups exist', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([]);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('No standups configured yet')).toBeInTheDocument();
      expect(screen.getByText('Create First Standup')).toBeInTheDocument();
    });
  });

  it('shows empty state for recent activity when no instances exist', async () => {
    vi.mocked(standupsApi.getStandupInstances).mockResolvedValue([]);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });
  });

  it('handles team not found error', async () => {
    const error = { response: { status: 404 } };
    vi.mocked(teamsApi.getTeam).mockRejectedValue(error);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Team Not Found')).toBeInTheDocument();
      expect(screen.getByText("The team you're looking for doesn't exist.")).toBeInTheDocument();
      expect(screen.getByText('Back to Teams')).toBeInTheDocument();
    });

    expect(toast.error).toHaveBeenCalledWith('Team not found');
  });

  it('handles general API error', async () => {
    const error = new Error('Network error');
    vi.mocked(teamsApi.getTeam).mockRejectedValue(error);

    renderWithRouter();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load team data');
    });
  });

  it('handles standup config not found gracefully', async () => {
    const error = { response: { status: 404, data: { code: 'STANDUP_CONFIG_NOT_FOUND' } } };
    vi.mocked(standupsApi.getTeamStandups).mockRejectedValue(error);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Frontend Team')).toBeInTheDocument();
      expect(screen.getByText('No standups configured yet')).toBeInTheDocument();
    });
  });

  it('refreshes team data after settings update', async () => {
    renderWithRouter();

    await waitFor(() => {
      const settingsButton = screen.getByTestId('team-settings-button');
      fireEvent.click(settingsButton);
    });

    // Simulate settings update
    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Frontend Team');
      fireEvent.change(nameInput, { target: { value: 'Updated Frontend Team' } });
    });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      // Should refresh team data
      expect(teamsApi.getTeam).toHaveBeenCalledTimes(2); // Initial load + refresh
    });
  });

  it('refreshes standup data after standup edit', async () => {
    renderWithRouter();

    await waitFor(() => {
      const dropdownButtons = screen.getAllByRole('button', { name: /more/i });
      const standupDropdown = dropdownButtons[0];
      fireEvent.click(standupDropdown);
    });

    await waitFor(() => {
      const editOption = screen.getByText('Edit Standup');
      fireEvent.click(editOption);
    });

    // Simulate standup update
    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Daily Standup');
      fireEvent.change(nameInput, { target: { value: 'Updated Daily Standup' } });
    });

    const updateButton = screen.getByText('Update Standup');
    fireEvent.click(updateButton);

    await waitFor(() => {
      // Should refresh standup data
      expect(standupsApi.getTeamStandups).toHaveBeenCalledTimes(2); // Initial load + refresh
    });
  });

  it('navigates back to teams when back button is clicked', async () => {
    renderWithRouter();

    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: /back/i });
      fireEvent.click(backButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/teams');
  });

  it('shows toast when trying to invite members', async () => {
    renderWithRouter();

    await waitFor(() => {
      const inviteButton = screen.getByRole('button', { name: /invite/i });
      fireEvent.click(inviteButton);
    });

    expect(toast.info).toHaveBeenCalledWith('Invite members - Coming soon!');
  });

  it('displays correct day formatting for different schedules', async () => {
    const standupWithSpecificDays = {
      ...mockStandups[0],
      schedule: {
        time: '14:00',
        days: ['monday', 'wednesday', 'friday'] as (
          | 'monday'
          | 'tuesday'
          | 'wednesday'
          | 'thursday'
          | 'friday'
          | 'saturday'
          | 'sunday'
        )[],
        timezone: 'UTC',
      },
    };

    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([standupWithSpecificDays]);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Monday, Wednesday, Friday at 14:00')).toBeInTheDocument();
    });
  });

  it('handles no team ID in params', async () => {
    const { useParams } = await import('react-router-dom');
    vi.mocked(useParams).mockReturnValue({ teamId: undefined });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Team Not Found')).toBeInTheDocument();
    });
  });
});
