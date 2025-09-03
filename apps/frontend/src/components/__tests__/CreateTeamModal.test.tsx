import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@/test/utils';
import { toast } from '@/components/ui';
import React from 'react';

import { CreateTeamModal } from '@/components/CreateTeamModal';
// import { TeamsProvider } from '@/contexts/TeamsContext';
// import { AuthProvider } from '@/contexts/AuthContext';
import { teamsApi, integrationsApi } from '@/lib/api';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  teamsApi: {
    createTeam: vi.fn(),
    getTeams: vi.fn(),
    getTeam: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
  },
  integrationsApi: {
    getSlackIntegrations: vi.fn(),
    getSlackIntegrationsForTeamCreation: vi.fn(),
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

vi.mock('@/utils', () => ({
  normalizeApiError: vi.fn(() => ({ message: 'Test error message' })),
}));

// Mock auth context to provide a user with orgId
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin' as const,
  orgId: 'test-org-id',
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
};

vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

// Test wrapper component
// const TestWrapper = ({ children }: { children: React.ReactNode }) => (
//   <AuthProvider>
//     <TeamsProvider>{children}</TeamsProvider>
//   </AuthProvider>
// );

// Custom render function with providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui);
};

describe('CreateTeamModal', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  const mockIntegrations = [
    { id: 'integration1', teamName: 'Test Workspace', isActive: true, platform: 'Slack' },
    { id: 'integration2', teamName: 'Another Workspace', isActive: true, platform: 'Discord' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(integrationsApi.getSlackIntegrations).mockResolvedValue([]);
    vi.mocked(integrationsApi.getSlackIntegrationsForTeamCreation).mockResolvedValue(
      mockIntegrations
    );
    vi.mocked(teamsApi.getTeams).mockResolvedValue([]);
  });

  it('renders modal when open', async () => {
    renderWithProviders(<CreateTeamModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Set up a new team for async standups')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Create Team')).toHaveLength(2); // Header and button
    expect(screen.getByTestId('team-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('team-description-input')).toBeInTheDocument();
    expect(screen.getByTestId('integration-select')).toBeInTheDocument();
  });

  it('does not render when closed', async () => {
    await act(async () => {
      renderWithProviders(<CreateTeamModal {...mockProps} isOpen={false} />);
    });
    expect(screen.queryByText('Create Team')).not.toBeInTheDocument();
  });

  it('loads and displays available integrations', async () => {
    renderWithProviders(<CreateTeamModal {...mockProps} />);

    await waitFor(() => {
      expect(integrationsApi.getSlackIntegrationsForTeamCreation).toHaveBeenCalled();
    });

    // Wait for the integrations to actually appear in the UI
    await waitFor(() => {
      expect(screen.getByText('Slack: Test Workspace')).toBeInTheDocument();
    });

    const integrationSelect = screen.getByTestId('integration-select');
    expect(integrationSelect).toHaveTextContent('Slack: Test Workspace');
    expect(integrationSelect).toHaveTextContent('Discord: Another Workspace');

    // Select an integration
    fireEvent.change(integrationSelect, { target: { value: 'integration1' } });
  });

  it('has basic form validation structure and disables submit when invalid', async () => {
    renderWithProviders(<CreateTeamModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('team-name-input')).toBeInTheDocument();
    });

    // Check that required fields have the required attribute
    expect(screen.getByTestId('team-name-input')).toHaveAttribute('required');
    expect(screen.getByTestId('integration-select')).toHaveAttribute('required');
    // Timezone select should be visible
    expect(screen.getByTestId('timezone-select')).toBeInTheDocument();

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

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('submits form with valid data', async () => {
    const mockTeam = {
      id: 'new-team-id',
      name: 'Test Team',
      members: [],
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    };
    vi.mocked(teamsApi.createTeam).mockResolvedValue(mockTeam);

    renderWithProviders(<CreateTeamModal {...mockProps} />);

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

    // Submit the form
    fireEvent.click(screen.getByTestId('create-team-submit-button'));

    await waitFor(() => {
      expect(teamsApi.createTeam).toHaveBeenCalledWith({
        name: 'Test Team',
        integrationId: 'integration1',
        description: 'Test Description',
        timezone: 'America/New_York',
      });
    });

    expect(toast.loading).toHaveBeenCalledWith('Creating team...');
    expect(toast.dismiss).toHaveBeenCalled();
    expect(mockProps.onSuccess).toHaveBeenCalledWith('Test Team', mockTeam);
  });

  it('closes modal when close button is clicked', async () => {
    renderWithProviders(<CreateTeamModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('close-modal')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('close-modal'));
    });
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('closes modal when cancel button is clicked', async () => {
    renderWithProviders(<CreateTeamModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('cancel-button'));
    });
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('handles API errors during form submission', async () => {
    const error = new Error('API Error');
    vi.mocked(teamsApi.createTeam).mockRejectedValue(error);

    renderWithProviders(<CreateTeamModal {...mockProps} />);

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

    fireEvent.click(screen.getByTestId('create-team-submit-button'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Test error message');
    });

    expect(mockProps.onSuccess).not.toHaveBeenCalled();
  });
});
