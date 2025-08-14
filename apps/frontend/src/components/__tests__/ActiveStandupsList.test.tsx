import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { toast } from '@/components/ui';
import React from 'react';

import { ActiveStandupsList } from '@/components/ActiveStandupsList';
import { standupsApi } from '@/lib/api';
import type { StandupConfig } from '@/types';
import { StandupDeliveryType } from '@/types/backend';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  standupsApi: {
    getTeamStandups: vi.fn(),
    deleteStandup: vi.fn(),
    triggerStandupForToday: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
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

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ActiveStandupsList', () => {
  const mockStandups: StandupConfig[] = [
    {
      id: 'standup-1',
      teamId: 'team-1',
      name: 'Daily Standup',
      deliveryType: StandupDeliveryType.channel,
      questions: [
        'What did you work on yesterday?',
        'What will you work on today?',
        'Any blockers?',
      ],
      schedule: {
        time: '09:00',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        timezone: 'UTC',
      },
      slackChannelId: 'channel-1',
      isActive: true,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-02T00:00:00.000Z',
    },
    {
      id: 'standup-2',
      teamId: 'team-1',
      name: 'Weekly Review',
      deliveryType: StandupDeliveryType.channel,
      questions: ['What were your key accomplishments this week?'],
      schedule: {
        time: '15:00',
        days: ['friday'],
        timezone: 'UTC',
      },
      slackChannelId: 'channel-2',
      isActive: false,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(standupsApi.getTeamStandups).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<ActiveStandupsList teamId="team-1" />);

    // Should show loading skeletons without header
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(1);
    expect(screen.queryByText('Active Standups')).not.toBeInTheDocument();
  });

  it('renders standups list with header when data is loaded', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue(mockStandups);

    render(<ActiveStandupsList teamId="team-1" />);

    await waitFor(() => {
      expect(screen.getByText('Active Standups')).toBeInTheDocument();
      expect(screen.getByText('2 standups configured')).toBeInTheDocument();
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      expect(screen.getByText('Weekly Review')).toBeInTheDocument();
    });

    expect(standupsApi.getTeamStandups).toHaveBeenCalledWith('team-1');
  });

  it('renders without header when showHeader is false', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue(mockStandups);

    render(<ActiveStandupsList teamId="team-1" showHeader={false} />);

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    expect(screen.queryByText('Active Standups')).not.toBeInTheDocument();
  });

  it('renders without create button when showCreateButton is false', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue(mockStandups);

    render(<ActiveStandupsList teamId="team-1" showCreateButton={false} />);

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    expect(screen.queryByText('New Standup')).not.toBeInTheDocument();
  });

  it('displays standup details correctly', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue(mockStandups);

    render(<ActiveStandupsList teamId="team-1" />);

    await waitFor(() => {
      // Check active standup details
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      expect(screen.getByText('Weekdays at 09:00')).toBeInTheDocument();
      expect(screen.getByText('3 questions')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Weekdays')).toBeInTheDocument();

      // Check inactive standup details
      expect(screen.getByText('Weekly Review')).toBeInTheDocument();
      expect(screen.getByText('Fridays at 15:00')).toBeInTheDocument();
      expect(screen.getByText('1 questions')).toBeInTheDocument();
      expect(screen.getByText('Paused')).toBeInTheDocument();

      // Both standups should have UTC timezone
      expect(screen.getAllByText('UTC')).toHaveLength(2);
    });
  });

  it('shows empty state when no standups exist', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([]);

    render(<ActiveStandupsList teamId="team-1" />);

    await waitFor(() => {
      expect(screen.getByText('No Active Standups')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Get started by creating your first standup configuration to begin collecting async updates from your team.'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('Create Your First Standup')).toBeInTheDocument();
    });
  });

  it('handles create standup button click', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue(mockStandups);

    render(<ActiveStandupsList teamId="team-1" />);

    await waitFor(() => {
      expect(screen.getByText('New Standup')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Standup'));
    expect(mockNavigate).toHaveBeenCalledWith('/teams/team-1/standups/create');
  });

  it('handles create standup button click from empty state', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([]);

    render(<ActiveStandupsList teamId="team-1" />);

    await waitFor(() => {
      expect(screen.getByText('Create Your First Standup')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create Your First Standup'));
    expect(mockNavigate).toHaveBeenCalledWith('/teams/team-1/standups/create');
  });

  it('displays questions preview correctly', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue(mockStandups);

    render(<ActiveStandupsList teamId="team-1" />);

    await waitFor(() => {
      // Daily standup with 3 questions
      expect(screen.getByText('Questions (3)')).toBeInTheDocument();
      expect(screen.getByText('1. What did you work on yesterday?')).toBeInTheDocument();
      expect(screen.getByText('2. What will you work on today?')).toBeInTheDocument();
      expect(screen.getByText('+1 more questions')).toBeInTheDocument();

      // Weekly review with 1 question
      expect(screen.getByText('Questions (1)')).toBeInTheDocument();
      expect(
        screen.getByText('1. What were your key accomplishments this week?')
      ).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockRejectedValue(new Error('API Error'));

    render(<ActiveStandupsList teamId="team-1" />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load standups');
      expect(screen.getByText('No Active Standups')).toBeInTheDocument();
    });
  });

  it('shows coming soon notifications for unimplemented features', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue(mockStandups);

    render(<ActiveStandupsList teamId="team-1" />);

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    // Find analytics button and click it
    const analyticsButtons = screen.getAllByRole('button');
    const analyticsButton = analyticsButtons.find(button => {
      const svg = button.querySelector('svg');
      return svg?.classList.contains('lucide-bar-chart-3');
    });

    if (analyticsButton) {
      fireEvent.click(analyticsButton);
      expect(toast.info).toHaveBeenCalledWith('Analytics view - Coming soon!');
    }
  });

  it('handles run now button click', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue(mockStandups);
    vi.mocked(standupsApi.triggerStandupForToday).mockResolvedValue({
      message: 'Standup instances created successfully',
      instancesCreated: 2,
    });

    render(<ActiveStandupsList teamId="team-1" />);

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    // Test Run Now button (there are multiple, so get all and click the first one)
    const runNowButtons = screen.getAllByText('Run Now');
    expect(runNowButtons.length).toBeGreaterThan(0);
    fireEvent.click(runNowButtons[0]);

    await waitFor(() => {
      expect(standupsApi.triggerStandupForToday).toHaveBeenCalled();
    });
  });

  it('calls onStandupsChange callback when provided', async () => {
    const mockCallback = vi.fn();
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue(mockStandups);

    render(<ActiveStandupsList teamId="team-1" onStandupsChange={mockCallback} />);

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    // The callback should not be called during initial load
    expect(mockCallback).not.toHaveBeenCalled();
  });

  it('applies custom className', async () => {
    vi.mocked(standupsApi.getTeamStandups).mockResolvedValue([]);

    const { container } = render(<ActiveStandupsList teamId="team-1" className="custom-class" />);

    await waitFor(() => {
      expect(screen.getByText('No Active Standups')).toBeInTheDocument();
    });

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('does not fetch standups when teamId is not provided', () => {
    render(<ActiveStandupsList />);

    expect(standupsApi.getTeamStandups).not.toHaveBeenCalled();
  });
});
