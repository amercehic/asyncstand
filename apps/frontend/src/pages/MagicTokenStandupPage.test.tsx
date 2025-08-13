import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MagicTokenStandupPage } from '@/pages/MagicTokenStandupPage';
import { magicTokenApiClient } from '@/lib/api-client/magic-token';
import { toast } from '@/components/ui';

// Mock the API client
vi.mock('@/lib/api-client/magic-token', () => ({
  magicTokenApiClient: {
    validateTokenAndGetInfo: vi.fn(),
    submitWithMagicToken: vi.fn(),
  },
}));

// Mock toast notifications
vi.mock('@/components/ui', async () => {
  const actual = await vi.importActual('@/components/ui');
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

// Mock useSearchParams - Create new instance for each test
let mockSearchParams: URLSearchParams;

const createMockSearchParams = () => {
  mockSearchParams = new URLSearchParams();
  return mockSearchParams;
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams || createMockSearchParams()],
  };
});

describe('MagicTokenStandupPage', () => {
  const mockStandupInfo = {
    instanceId: 'instance-123',
    teamName: 'Engineering Team',
    questions: ['What did you work on yesterday?', 'What will you work on today?', 'Any blockers?'],
    targetDate: '2024-01-15T10:00:00Z',
    memberName: 'John Doe',
    timeRemaining: '2h 30m',
    hasExistingResponses: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('token', 'test-magic-token');
  });

  it('should render loading state initially', () => {
    render(
      <MemoryRouter>
        <MagicTokenStandupPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading standup...')).toBeInTheDocument();
  });

  it('should validate token and display standup form', async () => {
    vi.mocked(magicTokenApiClient.validateTokenAndGetInfo).mockResolvedValue(mockStandupInfo);

    render(
      <MemoryRouter>
        <MagicTokenStandupPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    expect(screen.getByText('Engineering Team')).toBeInTheDocument();
    expect(screen.getByText('Submitted as: John Doe')).toBeInTheDocument();
    expect(screen.getByText('2h 30m remaining')).toBeInTheDocument();

    // Check all questions are rendered
    expect(screen.getByText('What did you work on yesterday?')).toBeInTheDocument();
    expect(screen.getByText('What will you work on today?')).toBeInTheDocument();
    expect(screen.getByText('Any blockers?')).toBeInTheDocument();

    // Check form inputs are rendered
    expect(screen.getAllByPlaceholderText('Type your response here...')).toHaveLength(3);
  });

  it('should handle expired token error', async () => {
    const error = {
      response: { status: 401 },
    };
    vi.mocked(magicTokenApiClient.validateTokenAndGetInfo).mockRejectedValue(error);

    render(
      <MemoryRouter>
        <MagicTokenStandupPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to Load Standup')).toBeInTheDocument();
    });

    expect(screen.getByText('Magic token has expired')).toBeInTheDocument();
  });

  it('should handle missing token', async () => {
    mockSearchParams.delete('token');

    render(
      <MemoryRouter>
        <MagicTokenStandupPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to Load Standup')).toBeInTheDocument();
    });

    expect(screen.getByText('Magic token is missing from the URL')).toBeInTheDocument();
  });

  it('should validate all questions are answered before submission', async () => {
    vi.mocked(magicTokenApiClient.validateTokenAndGetInfo).mockResolvedValue(mockStandupInfo);

    render(
      <MemoryRouter>
        <MagicTokenStandupPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    // Get all textareas
    const textareas = screen.getAllByPlaceholderText('Type your response here...');
    expect(textareas).toHaveLength(3);

    // Leave first textarea empty, fill others with whitespace
    fireEvent.change(textareas[1], { target: { value: '   ' } }); // Just spaces
    fireEvent.change(textareas[2], { target: { value: '\n\t' } }); // Just whitespace

    // Try to submit
    const submitButton = screen.getByTestId('submit-response-button');
    fireEvent.click(submitButton);

    // The validation should trigger
    expect(toast.error).toHaveBeenCalledWith('Please answer all questions before submitting');
    expect(magicTokenApiClient.submitWithMagicToken).not.toHaveBeenCalled();
  });

  it('should submit responses successfully', async () => {
    vi.mocked(magicTokenApiClient.validateTokenAndGetInfo).mockResolvedValue(mockStandupInfo);
    vi.mocked(magicTokenApiClient.submitWithMagicToken).mockResolvedValue({
      success: true,
      message: 'Responses submitted successfully',
      answersSubmitted: 3,
    });

    render(
      <MemoryRouter>
        <MagicTokenStandupPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    // Fill in all answers
    const textareas = screen.getAllByPlaceholderText('Type your response here...');
    fireEvent.change(textareas[0], { target: { value: 'Worked on API endpoints' } });
    fireEvent.change(textareas[1], { target: { value: 'Will work on frontend' } });
    fireEvent.change(textareas[2], { target: { value: 'No blockers' } });

    // Submit the form
    const submitButton = screen.getByTestId('submit-response-button');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(magicTokenApiClient.submitWithMagicToken).toHaveBeenCalledWith('test-magic-token', [
        { questionIndex: 0, answer: 'Worked on API endpoints' },
        { questionIndex: 1, answer: 'Will work on frontend' },
        { questionIndex: 2, answer: 'No blockers' },
      ]);
    });

    expect(toast.success).toHaveBeenCalledWith('Response submitted successfully!');

    // Check success state is displayed
    await waitFor(() => {
      expect(screen.getByText('Response Submitted!')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Thank you for submitting your standup response for Engineering Team.')
    ).toBeInTheDocument();
  });

  it('should handle submission errors', async () => {
    vi.mocked(magicTokenApiClient.validateTokenAndGetInfo).mockResolvedValue(mockStandupInfo);
    const error = {
      response: {
        status: 409,
        data: { message: 'You have already submitted' },
      },
    };
    vi.mocked(magicTokenApiClient.submitWithMagicToken).mockRejectedValue(error);

    render(
      <MemoryRouter>
        <MagicTokenStandupPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
    });

    // Fill in answers
    const textareas = screen.getAllByPlaceholderText('Type your response here...');
    textareas.forEach((textarea, index) => {
      fireEvent.change(textarea, { target: { value: `Answer ${index + 1}` } });
    });

    // Submit the form
    const submitButton = screen.getByTestId('submit-response-button');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'You have already submitted a response for this standup.'
      );
    });
  });

  it('should display security notice', async () => {
    vi.mocked(magicTokenApiClient.validateTokenAndGetInfo).mockResolvedValue(mockStandupInfo);

    render(
      <MemoryRouter>
        <MagicTokenStandupPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('🔒 Secure Submission')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'This is a secure, one-time submission link. Do not share this URL with others.'
      )
    ).toBeInTheDocument();
  });

  it('should display instructions', async () => {
    vi.mocked(magicTokenApiClient.validateTokenAndGetInfo).mockResolvedValue(mockStandupInfo);

    render(
      <MemoryRouter>
        <MagicTokenStandupPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Instructions')).toBeInTheDocument();
    });

    expect(screen.getByText('• Answer all questions honestly and completely')).toBeInTheDocument();
    expect(screen.getByText('• Be specific about your work and any blockers')).toBeInTheDocument();
  });
});
