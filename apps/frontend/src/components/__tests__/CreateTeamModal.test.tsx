import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { toast } from 'sonner';

import { CreateTeamModal } from '@/components/CreateTeamModal';
import { teamsApi, integrationsApi } from '@/lib/api';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  teamsApi: {
    createTeam: vi.fn(),
    getAvailableChannels: vi.fn(),
  },
  integrationsApi: {
    getSlackIntegrations: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

vi.mock('@/utils', () => ({
  normalizeApiError: vi.fn(() => ({ message: 'Test error message' })),
}));

describe('CreateTeamModal', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  const mockChannels = [
    { id: 'channel1', name: 'general', isAssigned: false },
    { id: 'channel2', name: 'dev-team', isAssigned: false },
    { id: 'channel3', name: 'assigned-channel', isAssigned: true },
  ];

  const mockIntegrations = [
    { id: 'integration1', teamName: 'Test Workspace', isActive: true, platform: 'Slack' },
    { id: 'integration2', teamName: 'Another Workspace', isActive: true, platform: 'Discord' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(teamsApi.getAvailableChannels).mockResolvedValue({ channels: mockChannels });
    vi.mocked(integrationsApi.getSlackIntegrations).mockResolvedValue(mockIntegrations);
  });

  it('renders modal when open', async () => {
    render(<CreateTeamModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Set up a new team for async standups')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Create Team')).toHaveLength(2); // Header and button
    expect(screen.getByTestId('team-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('team-description-input')).toBeInTheDocument();
    expect(screen.getByTestId('integration-select')).toBeInTheDocument();
    expect(screen.getByTestId('channel-select')).toBeInTheDocument();
    expect(screen.getByTestId('timezone-select')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<CreateTeamModal {...mockProps} isOpen={false} />);
    expect(screen.queryByText('Create Team')).not.toBeInTheDocument();
  });

  it('loads and displays available integrations and channels', async () => {
    render(<CreateTeamModal {...mockProps} />);

    await waitFor(() => {
      expect(teamsApi.getAvailableChannels).toHaveBeenCalled();
      expect(integrationsApi.getSlackIntegrations).toHaveBeenCalled();
    });

    const integrationSelect = screen.getByTestId('integration-select');
    expect(integrationSelect).toHaveTextContent('Slack: Test Workspace');
    expect(integrationSelect).toHaveTextContent('Discord: Another Workspace');

    // Select an integration to enable channel selection
    fireEvent.change(integrationSelect, { target: { value: 'integration1' } });

    const channelSelect = screen.getByTestId('channel-select');
    await waitFor(() => {
      expect(channelSelect).toHaveTextContent('#general');
      expect(channelSelect).toHaveTextContent('#dev-team');
      // Should not show assigned channels
      expect(channelSelect).not.toHaveTextContent('#assigned-channel');
    });
  });

  it('has basic form validation structure and disables submit when invalid', async () => {
    render(<CreateTeamModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('team-name-input')).toBeInTheDocument();
    });

    // Check that required fields have the required attribute
    expect(screen.getByTestId('team-name-input')).toHaveAttribute('required');
    expect(screen.getByTestId('integration-select')).toHaveAttribute('required');
    expect(screen.getByTestId('channel-select')).toHaveAttribute('required');
    expect(screen.getByTestId('timezone-select')).toHaveAttribute('required');

    // Check that submit button is disabled when form is invalid
    const submitButton = screen.getByTestId('create-team-submit-button');
    expect(submitButton).toBeDisabled();

    // Fill in all required fields to enable the button
    fireEvent.change(screen.getByTestId('team-name-input'), {
      target: { value: 'Test Team' },
    });
    fireEvent.change(screen.getByTestId('integration-select'), {
      target: { value: 'integration1' },
    });
    fireEvent.change(screen.getByTestId('channel-select'), {
      target: { value: 'channel1' },
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('submits form with valid data', async () => {
    vi.mocked(teamsApi.createTeam).mockResolvedValue({ id: 'new-team-id' });

    render(<CreateTeamModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('team-name-input')).toBeInTheDocument();
    });

    // Fill in the form
    fireEvent.change(screen.getByTestId('team-name-input'), {
      target: { value: 'Test Team' },
    });
    fireEvent.change(screen.getByTestId('team-description-input'), {
      target: { value: 'Test Description' },
    });
    fireEvent.change(screen.getByTestId('integration-select'), {
      target: { value: 'integration1' },
    });
    fireEvent.change(screen.getByTestId('channel-select'), {
      target: { value: 'channel1' },
    });
    fireEvent.change(screen.getByTestId('timezone-select'), {
      target: { value: 'America/New_York' },
    });

    // Submit the form
    fireEvent.click(screen.getByTestId('create-team-submit-button'));

    await waitFor(() => {
      expect(teamsApi.createTeam).toHaveBeenCalledWith({
        name: 'Test Team',
        integrationId: 'integration1',
        channelId: 'channel1',
        timezone: 'America/New_York',
        description: 'Test Description',
      });
    });

    expect(toast.loading).toHaveBeenCalledWith('Creating team...', { id: 'create-team' });
    expect(toast.success).toHaveBeenCalledWith('Team created successfully!', { id: 'create-team' });
    expect(mockProps.onSuccess).toHaveBeenCalled();
  });

  it('closes modal when close button is clicked', async () => {
    render(<CreateTeamModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('close-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('close-modal'));
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('closes modal when cancel button is clicked', async () => {
    render(<CreateTeamModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('cancel-button'));
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('handles API errors during form submission', async () => {
    const error = new Error('API Error');
    vi.mocked(teamsApi.createTeam).mockRejectedValue(error);

    render(<CreateTeamModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('team-name-input')).toBeInTheDocument();
    });

    // Fill in required fields
    fireEvent.change(screen.getByTestId('team-name-input'), {
      target: { value: 'Test Team' },
    });
    fireEvent.change(screen.getByTestId('integration-select'), {
      target: { value: 'integration1' },
    });
    fireEvent.change(screen.getByTestId('channel-select'), {
      target: { value: 'channel1' },
    });

    fireEvent.click(screen.getByTestId('create-team-submit-button'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Test error message', { id: 'create-team' });
    });

    expect(mockProps.onSuccess).not.toHaveBeenCalled();
  });
});
