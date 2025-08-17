import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { toast } from '@/components/ui';
import React from 'react';

import { StandupEditModal } from '@/components/StandupEditModal';
import { teamsApi, standupsApi } from '@/lib/api';
import type { StandupConfig } from '@/types';
import { StandupDeliveryType } from '@/types/backend';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  teamsApi: {
    getAvailableChannels: vi.fn(),
  },
  standupsApi: {
    updateStandup: vi.fn(),
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

describe('StandupEditModal', () => {
  const mockStandup: StandupConfig = {
    id: 'standup-1',
    teamId: 'team-1',
    name: 'Daily Standup',
    deliveryType: StandupDeliveryType.channel,
    questions: ['What did you work on yesterday?', 'What will you work on today?', 'Any blockers?'],
    schedule: {
      time: '09:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      timezone: 'UTC',
    },
    targetChannelId: 'channel-1',
    isActive: true,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
  };

  const mockChannels = [
    { id: 'channel-1', name: 'general', isAssigned: false },
    { id: 'channel-2', name: 'dev-team', isAssigned: false },
    { id: 'channel-3', name: 'assigned-channel', isAssigned: true },
  ];

  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    standup: mockStandup,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(teamsApi.getAvailableChannels).mockResolvedValue({ channels: mockChannels });
  });

  it('renders modal when open', async () => {
    render(<StandupEditModal {...mockProps} />);

    expect(screen.getByText('Edit Standup')).toBeInTheDocument();
    expect(screen.getByText('Update standup configuration')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Daily Standup')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByDisplayValue('What did you work on yesterday?')).toBeInTheDocument();
    });
  });

  it('does not render when closed', () => {
    render(<StandupEditModal {...mockProps} isOpen={false} />);

    expect(screen.queryByText('Edit Standup')).not.toBeInTheDocument();
  });

  it('displays all standup questions', async () => {
    render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('What did you work on yesterday?')).toBeInTheDocument();
      expect(screen.getByDisplayValue('What will you work on today?')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Any blockers?')).toBeInTheDocument();
    });
  });

  it('displays correct time and timezone', async () => {
    render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('09:00')).toBeInTheDocument();
      expect(screen.getByDisplayValue('UTC')).toBeInTheDocument();
    });
  });

  it('displays correct selected days', async () => {
    render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      // Check that weekday buttons are selected
      const mondayButton = screen.getByText('Mon');
      const tuesdayButton = screen.getByText('Tue');
      const saturdayButton = screen.getByText('Sat');

      expect(mondayButton).toHaveClass('border-primary', 'bg-primary');
      expect(tuesdayButton).toHaveClass('border-primary', 'bg-primary');
      expect(saturdayButton).toHaveClass('border-border', 'bg-background'); // Not selected
    });
  });

  it('updates standup name when typed', () => {
    render(<StandupEditModal {...mockProps} />);

    const nameInput = screen.getByDisplayValue('Daily Standup');
    fireEvent.change(nameInput, { target: { value: 'Updated Standup' } });

    expect(screen.getByDisplayValue('Updated Standup')).toBeInTheDocument();
  });

  it('updates question content when typed', async () => {
    render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      const questionInput = screen.getByDisplayValue('What did you work on yesterday?');
      fireEvent.change(questionInput, { target: { value: 'What did you accomplish yesterday?' } });

      expect(screen.getByDisplayValue('What did you accomplish yesterday?')).toBeInTheDocument();
    });
  });

  it('adds new question when Add Question button is clicked', async () => {
    render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Enter your question...')).toHaveLength(3);
    });

    const addButton = screen.getByText('Add Question');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Enter your question...')).toHaveLength(4);
    });
  });

  it('removes question when delete button is clicked', async () => {
    render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Enter your question...')).toHaveLength(3);
    });

    // Click the first delete button (should be available since we have more than 1 question)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Enter your question...')).toHaveLength(2);
    });
  });

  it('prevents removing the last question', async () => {
    const standupWithOneQuestion = {
      ...mockStandup,
      questions: ['What are you working on?'],
    };

    render(<StandupEditModal {...mockProps} standup={standupWithOneQuestion} />);

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Enter your question...')).toHaveLength(1);
    });

    // There should be no delete button when only one question exists
    const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
    expect(deleteButtons).toHaveLength(0);
  });

  it('updates time when changed', async () => {
    render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      const timeInput = screen.getByDisplayValue('09:00');
      fireEvent.change(timeInput, { target: { value: '14:30' } });

      expect(screen.getByDisplayValue('14:30')).toBeInTheDocument();
    });
  });

  it('updates timezone when changed', async () => {
    render(<StandupEditModal {...mockProps} />);

    // Wait for the select element to be available by finding it within the timezone section
    await waitFor(() => {
      expect(screen.getByText('Timezone')).toBeInTheDocument();
    });

    // Find the timezone select by looking for a select element that has UTC as its value
    const timezoneSelect = screen
      .getAllByRole('combobox')
      .find(element => (element as HTMLSelectElement).value === 'UTC') as HTMLSelectElement;

    expect(timezoneSelect).toBeInTheDocument();
    expect(timezoneSelect.value).toBe('UTC');

    fireEvent.change(timezoneSelect, { target: { value: 'America/New_York' } });

    await waitFor(() => {
      expect(timezoneSelect.value).toBe('America/New_York');
    });
  });

  it('toggles individual days when clicked', async () => {
    render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      const saturdayButton = screen.getByText('Sat');
      expect(saturdayButton).toHaveClass('border-border', 'bg-background');

      fireEvent.click(saturdayButton);

      expect(saturdayButton).toHaveClass('border-primary', 'bg-primary');
    });
  });

  it('selects all weekdays when Weekdays button is clicked', async () => {
    render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      const weekdaysButton = screen.getByText('Weekdays');
      fireEvent.click(weekdaysButton);

      const mondayButton = screen.getByText('Mon');
      const fridayButton = screen.getByText('Fri');
      const saturdayButton = screen.getByText('Sat');

      expect(mondayButton).toHaveClass('border-primary', 'bg-primary');
      expect(fridayButton).toHaveClass('border-primary', 'bg-primary');
      expect(saturdayButton).toHaveClass('border-border', 'bg-background'); // Weekend, not selected
    });
  });

  it('selects all days when All Days button is clicked', async () => {
    render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      const allDaysButton = screen.getByText('All Days');
      fireEvent.click(allDaysButton);

      const mondayButton = screen.getByText('Mon');
      const saturdayButton = screen.getByText('Sat');
      const sundayButton = screen.getByText('Sun');

      expect(mondayButton).toHaveClass('border-primary', 'bg-primary');
      expect(saturdayButton).toHaveClass('border-primary', 'bg-primary');
      expect(sundayButton).toHaveClass('border-primary', 'bg-primary');
    });
  });

  it('submits form with valid data', async () => {
    vi.mocked(standupsApi.updateStandup).mockResolvedValue(mockStandup);

    render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Daily Standup')).toBeInTheDocument();
    });

    // Make changes
    const nameInput = screen.getByDisplayValue('Daily Standup');
    fireEvent.change(nameInput, { target: { value: 'Updated Daily Standup' } });

    // Submit form
    const updateButton = screen.getByText('Update Standup');
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(standupsApi.updateStandup).toHaveBeenCalledWith(
        'standup-1',
        expect.objectContaining({
          name: 'Updated Daily Standup',
          questions: mockStandup.questions,
          schedule: expect.objectContaining({
            time: '09:00',
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            timezone: 'UTC',
          }),
          targetChannelId: 'channel-1',
        })
      );
    });

    expect(toast.success).toHaveBeenCalledWith('Standup updated successfully!');
    expect(mockProps.onSuccess).toHaveBeenCalled();
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('validates that at least one day is selected', async () => {
    render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Daily Standup')).toBeInTheDocument();
    });

    // First make a change to enable the button
    const nameInput = screen.getByDisplayValue('Daily Standup');
    fireEvent.change(nameInput, { target: { value: 'Updated Standup' } });

    // Now unselect all days by clicking on each selected day
    const mondayButton = screen.getByText('Mon');
    const tuesdayButton = screen.getByText('Tue');
    const wednesdayButton = screen.getByText('Wed');
    const thursdayButton = screen.getByText('Thu');
    const fridayButton = screen.getByText('Fri');

    fireEvent.click(mondayButton);
    fireEvent.click(tuesdayButton);
    fireEvent.click(wednesdayButton);
    fireEvent.click(thursdayButton);
    fireEvent.click(fridayButton);

    // Now try to submit with no days selected
    const updateButton = screen.getByText('Update Standup');
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please select at least one day');
    });
    expect(standupsApi.updateStandup).not.toHaveBeenCalled();
  });

  it('handles API errors during form submission', async () => {
    const error = new Error('API Error');
    vi.mocked(standupsApi.updateStandup).mockRejectedValue(error);

    render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Daily Standup')).toBeInTheDocument();
    });

    // Make a change to enable the button
    const nameInput = screen.getByDisplayValue('Daily Standup');
    fireEvent.change(nameInput, { target: { value: 'Updated Standup' } });

    // Now click the enabled update button
    const updateButton = screen.getByText('Update Standup');
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update standup');
    });

    expect(mockProps.onSuccess).not.toHaveBeenCalled();
    expect(mockProps.onClose).not.toHaveBeenCalled();
  });

  it('closes modal when cancel button is clicked', () => {
    render(<StandupEditModal {...mockProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('shows loading state during form submission', async () => {
    // Mock a slow API call
    vi.mocked(standupsApi.updateStandup).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockStandup), 1000))
    );

    render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Daily Standup')).toBeInTheDocument();
    });

    // Make a change to enable the button
    const nameInput = screen.getByDisplayValue('Daily Standup');
    fireEvent.change(nameInput, { target: { value: 'Updated Standup' } });

    // Now click the enabled update button
    const updateButton = screen.getByText('Update Standup');
    fireEvent.click(updateButton);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });
    const submitButton = screen.getByText('Updating...');
    expect(submitButton).toBeDisabled();
  });

  it('handles ESC key to close modal', () => {
    render(<StandupEditModal {...mockProps} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('resets form when standup prop changes', async () => {
    const { rerender } = render(<StandupEditModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Daily Standup')).toBeInTheDocument();
    });

    // Make changes to form
    const nameInput = screen.getByDisplayValue('Daily Standup');
    fireEvent.change(nameInput, { target: { value: 'Modified Name' } });
    expect(screen.getByDisplayValue('Modified Name')).toBeInTheDocument();

    // Update with new standup
    const newStandup = { ...mockStandup, name: 'New Standup Name' };
    rerender(<StandupEditModal {...mockProps} standup={newStandup} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('New Standup Name')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Modified Name')).not.toBeInTheDocument();
    });
  });

  it('prevents body scroll when modal is open', () => {
    const originalOverflow = document.body.style.overflow;

    const { unmount } = render(<StandupEditModal {...mockProps} />);

    expect(document.body.style.overflow).toBe('hidden');

    // Cleanup should restore original overflow
    unmount();

    expect(document.body.style.overflow).toBe(originalOverflow);
  });
});
