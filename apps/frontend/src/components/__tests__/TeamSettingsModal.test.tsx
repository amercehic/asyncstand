import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { toast } from '@/components/ui';
import React from 'react';

import { TeamSettingsModal } from '@/components/TeamSettingsModal';
import { teamsApi } from '@/lib/api';
import type { Team } from '@/types';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  teamsApi: {
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
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

describe('TeamSettingsModal', () => {
  const mockTeam: Team = {
    id: 'team-1',
    name: 'Test Team',
    description: 'A test team for testing purposes',
    members: [
      {
        id: 'member-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
      {
        id: 'member-2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'member',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
    ],
    channel: {
      id: 'channel-1',
      name: 'general',
    },
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
    isActive: true,
  };

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
    render(<TeamSettingsModal {...mockProps} />);

    expect(screen.getByText('Team Settings')).toBeInTheDocument();
    expect(screen.getByText('Configure Test Team')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Team')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A test team for testing purposes')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<TeamSettingsModal {...mockProps} isOpen={false} />);

    expect(screen.queryByText('Team Settings')).not.toBeInTheDocument();
  });

  it('displays team channel information when available', () => {
    render(<TeamSettingsModal {...mockProps} />);

    expect(screen.getByText('Slack Channel')).toBeInTheDocument();
    expect(screen.getByText('#general')).toBeInTheDocument();
    expect(screen.getByText('Channel assignment cannot be changed from here')).toBeInTheDocument();
  });

  it('does not display channel information when not available', () => {
    const teamWithoutChannel = { ...mockTeam, channel: undefined };
    render(<TeamSettingsModal {...mockProps} team={teamWithoutChannel} />);

    expect(screen.queryByText('Slack Channel')).not.toBeInTheDocument();
    expect(screen.queryByText('#general')).not.toBeInTheDocument();
  });

  it('updates form data when typing in name field', () => {
    render(<TeamSettingsModal {...mockProps} />);

    const nameInput = screen.getByDisplayValue('Test Team');
    fireEvent.change(nameInput, { target: { value: 'Updated Team Name' } });

    expect(screen.getByDisplayValue('Updated Team Name')).toBeInTheDocument();
  });

  it('updates form data when typing in description field', () => {
    render(<TeamSettingsModal {...mockProps} />);

    const descriptionInput = screen.getByDisplayValue('A test team for testing purposes');
    fireEvent.change(descriptionInput, { target: { value: 'Updated description' } });

    expect(screen.getByDisplayValue('Updated description')).toBeInTheDocument();
  });

  it('shows character count for name field', () => {
    render(<TeamSettingsModal {...mockProps} />);

    expect(screen.getByText('9/100 characters')).toBeInTheDocument(); // "Test Team" = 9 chars
  });

  it('disables save button when no changes are made', () => {
    render(<TeamSettingsModal {...mockProps} />);

    const saveButton = screen.getByText('Save Changes');
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when changes are made', async () => {
    render(<TeamSettingsModal {...mockProps} />);

    const nameInput = screen.getByDisplayValue('Test Team');
    fireEvent.change(nameInput, { target: { value: 'Updated Team Name' } });

    await waitFor(() => {
      const saveButton = screen.getByText('Save Changes');
      expect(saveButton).not.toBeDisabled();
    });
  });

  it('validates required fields and shows errors', async () => {
    render(<TeamSettingsModal {...mockProps} />);

    const nameInput = screen.getByDisplayValue('Test Team');
    fireEvent.change(nameInput, { target: { value: '' } }); // Clear required field

    // Try to submit
    const form = nameInput.closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Team name is required')).toBeInTheDocument();
    });
  });

  it('validates name length limits', async () => {
    render(<TeamSettingsModal {...mockProps} />);

    const nameInput = screen.getByDisplayValue('Test Team');

    // Test minimum length
    fireEvent.change(nameInput, { target: { value: 'A' } });
    const form = nameInput.closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Team name must be at least 2 characters')).toBeInTheDocument();
    });

    // Test maximum length
    const longName = 'A'.repeat(101);
    fireEvent.change(nameInput, { target: { value: longName } });
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Team name cannot exceed 100 characters')).toBeInTheDocument();
    });
  });

  it('validates description length limit', async () => {
    render(<TeamSettingsModal {...mockProps} />);

    const descriptionInput = screen.getByDisplayValue('A test team for testing purposes');
    const longDescription = 'A'.repeat(501);
    fireEvent.change(descriptionInput, { target: { value: longDescription } });

    const form = descriptionInput.closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Description cannot exceed 500 characters')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    vi.mocked(teamsApi.updateTeam).mockResolvedValue(mockTeam);

    render(<TeamSettingsModal {...mockProps} />);

    // Make changes to the form
    const nameInput = screen.getByDisplayValue('Test Team');
    fireEvent.change(nameInput, { target: { value: 'Updated Team Name' } });

    const descriptionInput = screen.getByDisplayValue('A test team for testing purposes');
    fireEvent.change(descriptionInput, { target: { value: 'Updated description' } });

    const timezoneSelect = screen.getByDisplayValue('UTC');
    fireEvent.change(timezoneSelect, { target: { value: 'America/New_York' } });

    // Submit the form
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(teamsApi.updateTeam).toHaveBeenCalledWith('team-1', {
        name: 'Updated Team Name',
        description: 'Updated description',
        timezone: 'America/New_York',
      });
    });

    expect(toast.success).toHaveBeenCalledWith('Team settings updated successfully');
    expect(mockProps.onSuccess).toHaveBeenCalled();
  });

  it('handles API errors during form submission', async () => {
    const error = new Error('API Error');
    vi.mocked(teamsApi.updateTeam).mockRejectedValue(error);

    render(<TeamSettingsModal {...mockProps} />);

    // Make changes and submit
    const nameInput = screen.getByDisplayValue('Test Team');
    fireEvent.change(nameInput, { target: { value: 'Updated Team Name' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update team settings');
    });

    expect(mockProps.onSuccess).not.toHaveBeenCalled();
  });

  it('closes modal when cancel button is clicked', () => {
    render(<TeamSettingsModal {...mockProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('shows loading state during form submission', async () => {
    // Mock a slow API call
    vi.mocked(teamsApi.updateTeam).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockTeam), 1000))
    );

    render(<TeamSettingsModal {...mockProps} />);

    // Make changes and submit
    const nameInput = screen.getByDisplayValue('Test Team');
    fireEvent.change(nameInput, { target: { value: 'Updated Team Name' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    // Should show loading state
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
  });

  it('cancels delete confirmation', () => {
    render(<TeamSettingsModal {...mockProps} />);

    // Show delete confirmation
    const deleteButton = screen.getByTestId('show-delete-confirmation');
    fireEvent.click(deleteButton);

    // Cancel deletion
    const cancelButton = screen.getAllByText('Cancel')[1]; // Second cancel button (in delete confirmation)
    fireEvent.click(cancelButton);

    expect(screen.queryByText('This action cannot be undone')).not.toBeInTheDocument();
    expect(screen.getByText('Delete Team')).toBeInTheDocument();
  });

  it('enables delete confirmation button only when team name is correctly typed', async () => {
    render(<TeamSettingsModal {...mockProps} />);

    // Show delete confirmation
    const deleteButton = screen.getByTestId('show-delete-confirmation');
    fireEvent.click(deleteButton);

    const confirmationInput = screen.getByPlaceholderText('Type "Test Team" to confirm');
    const confirmDeleteButton = screen.getByTestId('confirm-delete-team');

    // Initially disabled
    expect(confirmDeleteButton).toBeDisabled();

    // Type wrong name
    fireEvent.change(confirmationInput, { target: { value: 'Wrong Name' } });
    expect(confirmDeleteButton).toBeDisabled();

    // Type correct name
    fireEvent.change(confirmationInput, { target: { value: 'Test Team' } });
    await waitFor(() => {
      expect(confirmDeleteButton).not.toBeDisabled();
    });
  });

  it('deletes team when confirmation is completed', async () => {
    vi.mocked(teamsApi.deleteTeam).mockResolvedValue(undefined);

    render(<TeamSettingsModal {...mockProps} />);

    // Show delete confirmation
    const deleteButton = screen.getByTestId('show-delete-confirmation');
    fireEvent.click(deleteButton);

    // Type team name for confirmation
    const confirmationInput = screen.getByPlaceholderText('Type "Test Team" to confirm');
    fireEvent.change(confirmationInput, { target: { value: 'Test Team' } });

    // Confirm deletion
    const confirmDeleteButton = screen.getByTestId('confirm-delete-team');
    fireEvent.click(confirmDeleteButton);

    await waitFor(() => {
      expect(teamsApi.deleteTeam).toHaveBeenCalledWith('team-1');
    });

    expect(toast.success).toHaveBeenCalledWith('Team deleted successfully!', {
      id: 'delete-team-team-1',
    });
    expect(mockProps.onSuccess).toHaveBeenCalled();
  });

  it('handles delete API errors', async () => {
    const error = new Error('Delete API Error');
    vi.mocked(teamsApi.deleteTeam).mockRejectedValue(error);

    render(<TeamSettingsModal {...mockProps} />);

    // Show delete confirmation and proceed
    const deleteButton = screen.getByText('Delete Team');
    fireEvent.click(deleteButton);

    const confirmationInput = screen.getByPlaceholderText('Type "Test Team" to confirm');
    fireEvent.change(confirmationInput, { target: { value: 'Test Team' } });

    const confirmDeleteButton = screen.getByTestId('confirm-delete-team');
    fireEvent.click(confirmDeleteButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Delete API Error', { id: 'delete-team-team-1' });
    });
  });

  it('handles ESC key to close modal', () => {
    render(<TeamSettingsModal {...mockProps} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('does not close modal with ESC during update operation', () => {
    // Mock a slow API call
    vi.mocked(teamsApi.updateTeam).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockTeam), 1000))
    );

    render(<TeamSettingsModal {...mockProps} />);

    // Start update operation
    const nameInput = screen.getByDisplayValue('Test Team');
    fireEvent.change(nameInput, { target: { value: 'Updated Team Name' } });
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    // Try to close with ESC
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockProps.onClose).not.toHaveBeenCalled();
  });
});
