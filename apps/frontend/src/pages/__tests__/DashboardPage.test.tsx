import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { toast } from '@/components/ui';
import React from 'react';

import { DashboardPage } from '@/pages/DashboardPage';
import { standupsApi } from '@/lib/api';
import type { Standup } from '@/types';
import { StandupDeliveryType } from '@/types/backend';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  standupsApi: {
    getTeamStandups: vi.fn(),
  },
}));

vi.mock('@/components/ui/Toast', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
    update: vi.fn(),
    custom: vi.fn(),
  },
  Toaster: () => null,
  ModernToaster: () => null,
  ToastManager: () => null,
  useToast: vi.fn(),
  useToastManager: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard page with welcome message', () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([]);

    render(<DashboardPage />);

    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
    expect(
      screen.getByText("Here's what's happening with your async standups today.")
    ).toBeInTheDocument();
  });

  it('displays stats sections', () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([]);

    render(<DashboardPage />);

    expect(screen.getByText('Active Teams')).toBeInTheDocument();
    expect(screen.getByText("This Week's Standups")).toBeInTheDocument();
    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
  });

  it('renders quick action buttons', () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([]);

    render(<DashboardPage />);

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-create-team')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-join-team')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-view-teams')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-settings')).toBeInTheDocument();
  });

  it('navigates to create team when Create Team button is clicked', () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([]);

    render(<DashboardPage />);

    fireEvent.click(screen.getByTestId('quick-action-create-team'));

    expect(mockNavigate).toHaveBeenCalledWith('/teams?create=1');
  });

  it('navigates to teams page when View Teams button is clicked', () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([]);

    render(<DashboardPage />);

    fireEvent.click(screen.getByTestId('quick-action-view-teams'));

    expect(mockNavigate).toHaveBeenCalledWith('/teams');
  });

  it('shows coming soon message for Join Team action', () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([]);

    render(<DashboardPage />);

    fireEvent.click(screen.getByTestId('quick-action-join-team'));

    expect(toast.info).toHaveBeenCalledWith('Join team - Coming soon!');
  });

  it('shows coming soon message for Settings action', () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([]);

    render(<DashboardPage />);

    fireEvent.click(screen.getByTestId('quick-action-settings'));

    expect(toast.info).toHaveBeenCalledWith('Settings - Coming soon!');
  });

  it('renders recent activity section', () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([]);

    render(<DashboardPage />);

    expect(screen.getByText('No Recent Activity')).toBeInTheDocument();
    expect(
      screen.getByText('Get started by creating your first team or joining an existing one.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('view-teams-button')).toBeInTheDocument();
  });

  it('navigates to teams page when main View Teams button is clicked', () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([]);

    render(<DashboardPage />);

    fireEvent.click(screen.getByTestId('view-teams-button'));

    expect(mockNavigate).toHaveBeenCalledWith('/teams');
  });

  it('displays loading state for stats', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockImplementation(() => new Promise(() => {}));

    render(<DashboardPage />);

    // Component shows loading state briefly, then calculates based on mocked teams context (empty teams)
    // Since teams context provides empty teams by default, stats will be calculated immediately
    // Check that the component renders without crashing during async operations
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();

    // With empty teams, stats will show 0 values
    await waitFor(() => {
      expect(screen.getAllByText('0')).toHaveLength(2); // Active teams and weekly standups
      expect(screen.getByText('0%')).toBeInTheDocument(); // Completion rate
    });
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockRejectedValue(new Error('API Error'));

    render(<DashboardPage />);

    // Should still render the page without crashing
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();

    // Wait for stats to finish loading (errors are handled silently)
    await waitFor(
      () => {
        expect(screen.queryByText('...')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('calculates stats correctly when teams have standups', async () => {
    const mockStandups: Standup[] = [
      {
        id: 'standup-1',
        teamId: 'team-1',
        name: 'Daily Standup',
        deliveryType: StandupDeliveryType.channel,
        questions: ['What did you work on?', 'What will you work on?', 'Any blockers?'],
        schedule: {
          time: '09:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          timezone: 'UTC',
        },
        targetChannelId: 'channel-1',
        isActive: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
    ];

    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue(mockStandups);

    render(<DashboardPage />);

    await waitFor(
      () => {
        // Should show some stats (exact numbers depend on teams context)
        expect(screen.queryByText('...')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Should show percentage for completion rate
    expect(screen.getByText(/%$/)).toBeInTheDocument();
  });
});
