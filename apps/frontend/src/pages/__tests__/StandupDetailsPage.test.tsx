import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

import { StandupDetailsPage } from '@/pages/StandupDetailsPage';
import { standupsApi } from '@/lib/api';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  standupsApi: {
    getInstance: vi.fn(),
    getInstanceResponses: vi.fn(),
  },
}));

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ standupId: 'standup-1' }),
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  Toaster: () => null,
}));

describe('StandupDetailsPage', () => {
  const mockStandupInstance = {
    id: 'standup-1',
    configId: 'config-1',
    date: '2023-10-15',
    status: 'active' as const,
    participants: ['user-1', 'user-2', 'user-3'],
    responses: [
      {
        id: 'response-1',
        instanceId: 'standup-1',
        userId: 'user-1',
        answers: {
          'What did you work on yesterday?': 'Worked on user authentication',
          'What will you work on today?': 'Will implement password reset',
          'Any blockers?': 'None',
        },
        submittedAt: '2023-10-15T10:30:00.000Z',
      },
    ],
    createdAt: '2023-10-15T09:00:00.000Z',
    updatedAt: '2023-10-15T10:30:00.000Z',
  };

  const mockResponses = [
    {
      id: 'response-1',
      instanceId: 'standup-1',
      userId: 'user-1',
      answers: {
        'What did you work on yesterday?': 'Worked on user authentication',
        'What will you work on today?': 'Will implement password reset',
        'Any blockers?': 'None',
      },
      submittedAt: '2023-10-15T10:30:00.000Z',
    },
    {
      id: 'response-2',
      instanceId: 'standup-1',
      userId: 'user-2',
      answers: {
        'What did you work on yesterday?': 'Reviewed pull requests',
        'What will you work on today?': 'Work on new feature',
        'Any blockers?': 'Waiting for design approval',
      },
      submittedAt: '2023-10-15T11:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(standupsApi.getInstance).mockResolvedValue(mockStandupInstance);
    vi.mocked(standupsApi.getInstanceResponses).mockResolvedValue(mockResponses);
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(
      <MemoryRouter initialEntries={['/standups/standup-1']}>{component}</MemoryRouter>
    );
  };

  it('shows loading state initially', () => {
    renderWithRouter(<StandupDetailsPage />);

    expect(screen.getByText('Loading standup details...')).toBeInTheDocument();
  });

  it('fetches and displays standup details', async () => {
    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(standupsApi.getInstance).toHaveBeenCalledWith('standup-1');
      expect(standupsApi.getInstanceResponses).toHaveBeenCalledWith('standup-1');
    });

    expect(screen.getByText('Standup Details')).toBeInTheDocument();
    expect(screen.getByText('October 15, 2023')).toBeInTheDocument();
  });

  it('displays overview tab by default', async () => {
    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Standup Details')).toBeInTheDocument();
    });

    expect(screen.getByText('Overview')).toHaveClass('border-primary', 'text-primary');
    expect(screen.getByText('Responses')).not.toHaveClass('border-primary', 'text-primary');
  });

  it('displays stats cards in overview tab', async () => {
    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Participants')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // 3 participants

      expect(screen.getByText('Responses Received')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 responses

      expect(screen.getByText('Response Rate')).toBeInTheDocument();
      expect(screen.getByText('67%')).toBeInTheDocument(); // 2/3 = 67%

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('displays participant list in overview tab', async () => {
    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Participants')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    // Check that avatars are displayed
    expect(screen.getByText('J')).toBeInTheDocument(); // John's avatar
    expect(screen.getByText('B')).toBeInTheDocument(); // Bob's avatar
  });

  it('shows response status for each participant', async () => {
    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Participants')).toBeInTheDocument();
    });

    // John and Jane have responded (based on mockResponses)
    const respondedBadges = screen.getAllByText('Responded');
    expect(respondedBadges).toHaveLength(2);

    // Bob hasn't responded
    const pendingBadges = screen.getAllByText('Pending');
    expect(pendingBadges).toHaveLength(1);
  });

  it('switches to responses tab when clicked', async () => {
    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Standup Details')).toBeInTheDocument();
    });

    const responsesTab = screen.getByText('Responses');
    fireEvent.click(responsesTab);

    expect(screen.getByText('Responses')).toHaveClass('border-primary', 'text-primary');
    expect(screen.getByText('Overview')).not.toHaveClass('border-primary', 'text-primary');
  });

  it('displays responses in responses tab', async () => {
    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Standup Details')).toBeInTheDocument();
    });

    // Switch to responses tab
    const responsesTab = screen.getByText('Responses');
    fireEvent.click(responsesTab);

    await waitFor(() => {
      // Check John's response
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Worked on user authentication')).toBeInTheDocument();
      expect(screen.getByText('Will implement password reset')).toBeInTheDocument();
      expect(screen.getByText('None')).toBeInTheDocument();

      // Check Jane's response
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Reviewed pull requests')).toBeInTheDocument();
      expect(screen.getByText('Work on new feature')).toBeInTheDocument();
      expect(screen.getByText('Waiting for design approval')).toBeInTheDocument();
    });
  });

  it('displays response submission times', async () => {
    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Standup Details')).toBeInTheDocument();
    });

    // Switch to responses tab
    const responsesTab = screen.getByText('Responses');
    fireEvent.click(responsesTab);

    await waitFor(() => {
      expect(screen.getByText('10:30')).toBeInTheDocument(); // John's submission time
      expect(screen.getByText('11:00')).toBeInTheDocument(); // Jane's submission time
    });
  });

  it('shows back button that navigates correctly', async () => {
    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Standup Details')).toBeInTheDocument();
    });

    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('handles loading state correctly', async () => {
    // Mock slow API responses
    vi.mocked(standupsApi.getInstance).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockStandupInstance), 1000))
    );
    vi.mocked(standupsApi.getInstanceResponses).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockResponses), 1000))
    );

    renderWithRouter(<StandupDetailsPage />);

    expect(screen.getByText('Loading standup details...')).toBeInTheDocument();
    expect(screen.queryByText('Standup Details')).not.toBeInTheDocument();
  });

  it('handles API error for standup instance', async () => {
    const error = new Error('Failed to fetch standup');
    vi.mocked(standupsApi.getInstance).mockRejectedValue(error);

    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Standup not found')).toBeInTheDocument();
      expect(
        screen.getByText("The standup you're looking for doesn't exist or has been deleted.")
      ).toBeInTheDocument();
    });

    // Should show back button in error state
    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toBeInTheDocument();
  });

  it('handles API error for responses gracefully', async () => {
    vi.mocked(standupsApi.getInstanceResponses).mockRejectedValue(
      new Error('Failed to fetch responses')
    );

    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Standup Details')).toBeInTheDocument();
    });

    // Should still show the standup details but without responses
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Responses')).toBeInTheDocument();
  });

  it('displays correct status styling for different statuses', async () => {
    const completedStandup = {
      ...mockStandupInstance,
      status: 'completed' as const,
    };

    vi.mocked(standupsApi.getInstance).mockResolvedValue(completedStandup);

    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toHaveClass('text-green-800', 'bg-green-100');
    });
  });

  it('handles standup with no participants', async () => {
    const standupWithNoParticipants = {
      ...mockStandupInstance,
      participants: [],
      responses: [],
    };

    vi.mocked(standupsApi.getInstance).mockResolvedValue(standupWithNoParticipants);
    vi.mocked(standupsApi.getInstanceResponses).mockResolvedValue([]);

    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument(); // 0 participants
      expect(screen.getByText('No participants yet')).toBeInTheDocument();
    });
  });

  it('handles standup with no responses', async () => {
    const standupWithNoResponses = {
      ...mockStandupInstance,
      responses: [],
    };

    vi.mocked(standupsApi.getInstance).mockResolvedValue(standupWithNoResponses);
    vi.mocked(standupsApi.getInstanceResponses).mockResolvedValue([]);

    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Standup Details')).toBeInTheDocument();
    });

    // Switch to responses tab
    const responsesTab = screen.getByText('Responses');
    fireEvent.click(responsesTab);

    await waitFor(() => {
      expect(screen.getByText('No responses yet')).toBeInTheDocument();
      expect(
        screen.getByText("Participants haven't submitted their responses yet.")
      ).toBeInTheDocument();
    });
  });

  it('displays correct response rate calculation', async () => {
    const standupWithDifferentRates = {
      ...mockStandupInstance,
      participants: ['user-1', 'user-2', 'user-3', 'user-4'],
    };

    const oneResponse = [mockResponses[0]];

    vi.mocked(standupsApi.getInstance).mockResolvedValue(standupWithDifferentRates);
    vi.mocked(standupsApi.getInstanceResponses).mockResolvedValue(oneResponse);

    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('25%')).toBeInTheDocument(); // 1/4 = 25%
    });
  });

  it('formats date correctly', async () => {
    const standupWithDifferentDate = {
      ...mockStandupInstance,
      date: '2023-12-25',
    };

    vi.mocked(standupsApi.getInstance).mockResolvedValue(standupWithDifferentDate);

    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('December 25, 2023')).toBeInTheDocument();
    });
  });

  it('handles missing standup ID in URL params', async () => {
    // Mock useParams to return undefined
    const { useParams } = await import('react-router-dom');
    vi.mocked(useParams).mockReturnValue({ standupId: undefined });

    renderWithRouter(<StandupDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Standup not found')).toBeInTheDocument();
    });
  });
});
