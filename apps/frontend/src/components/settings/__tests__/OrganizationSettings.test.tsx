import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { OrganizationSettings } from '@/components/settings/OrganizationSettings';
import { organizationApi } from '@/lib/api';
import type { Organization, OrgMember } from '@/lib/api';

// Mock the API
vi.mock('@/lib/api', () => ({
  organizationApi: {
    updateOrganization: vi.fn(),
  },
}));

// Mock the toast
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

describe('OrganizationSettings', () => {
  const mockOrganization: Organization = {
    id: 'org-1',
    name: 'Test Organization',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-02T00:00:00Z',
  };

  const mockMembers: OrgMember[] = [
    {
      id: 'member-1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'owner',
      status: 'active',
      joinedAt: '2023-01-01T00:00:00Z',
    },
    {
      id: 'member-2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'admin',
      status: 'active',
      joinedAt: '2023-01-02T00:00:00Z',
    },
  ];

  const defaultProps = {
    organization: mockOrganization,
    members: mockMembers,
    canManageOrg: true,
    onOrganizationUpdate: vi.fn() as (org: Organization) => void,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders organization information correctly', () => {
    render(<OrganizationSettings {...defaultProps} />);

    expect(screen.getByText('Organization Information')).toBeInTheDocument();
    expect(screen.getByTestId('organization-name')).toHaveTextContent('Test Organization');
    expect(screen.getByTestId('organization-members-count')).toHaveTextContent('2 members');
    expect(screen.getByTestId('organization-created')).toBeInTheDocument();
    expect(screen.getByTestId('organization-updated')).toBeInTheDocument();
  });

  it('shows edit button when user can manage organization', () => {
    render(<OrganizationSettings {...defaultProps} />);

    expect(screen.getByTestId('edit-org-name-button')).toBeInTheDocument();
  });

  it('hides edit button when user cannot manage organization', () => {
    render(<OrganizationSettings {...defaultProps} canManageOrg={false} />);

    expect(screen.queryByTestId('edit-org-name-button')).not.toBeInTheDocument();
  });

  it('enters edit mode when edit button is clicked', () => {
    render(<OrganizationSettings {...defaultProps} />);

    fireEvent.click(screen.getByTestId('edit-org-name-button'));

    expect(screen.getByTestId('org-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('save-org-name-button')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-edit-button')).toBeInTheDocument();
  });

  it('allows editing organization name', () => {
    render(<OrganizationSettings {...defaultProps} />);

    fireEvent.click(screen.getByTestId('edit-org-name-button'));

    const input = screen.getByTestId('org-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Updated Organization' } });

    expect(input.value).toBe('Updated Organization');
  });

  it('saves organization name successfully', async () => {
    const mockUpdateOrganization = vi.fn().mockResolvedValue({});
    (
      organizationApi.updateOrganization as MockedFunction<
        typeof organizationApi.updateOrganization
      >
    ).mockImplementation(mockUpdateOrganization);

    const onOrganizationUpdate = vi.fn();
    render(<OrganizationSettings {...defaultProps} onOrganizationUpdate={onOrganizationUpdate} />);

    fireEvent.click(screen.getByTestId('edit-org-name-button'));

    const input = screen.getByTestId('org-name-input');
    fireEvent.change(input, { target: { value: 'Updated Organization' } });

    fireEvent.click(screen.getByTestId('save-org-name-button'));

    await waitFor(() => {
      expect(mockUpdateOrganization).toHaveBeenCalledWith({ name: 'Updated Organization' });
      expect(onOrganizationUpdate).toHaveBeenCalledWith({
        ...mockOrganization,
        name: 'Updated Organization',
      });
    });
  });

  it('shows error when trying to save empty organization name', async () => {
    const { toast } = await import('@/components/ui');

    render(<OrganizationSettings {...defaultProps} />);

    fireEvent.click(screen.getByTestId('edit-org-name-button'));

    const input = screen.getByTestId('org-name-input');
    fireEvent.change(input, { target: { value: '   ' } }); // Empty/whitespace

    fireEvent.click(screen.getByTestId('save-org-name-button'));

    expect(toast.error).toHaveBeenCalledWith('Organization name cannot be empty');
  });

  it('handles save error gracefully', async () => {
    const { toast } = await import('@/components/ui');
    const mockUpdateOrganization = vi.fn().mockRejectedValue(new Error('API Error'));
    (
      organizationApi.updateOrganization as MockedFunction<
        typeof organizationApi.updateOrganization
      >
    ).mockImplementation(mockUpdateOrganization);

    render(<OrganizationSettings {...defaultProps} />);

    fireEvent.click(screen.getByTestId('edit-org-name-button'));

    const input = screen.getByTestId('org-name-input');
    fireEvent.change(input, { target: { value: 'Updated Organization' } });

    fireEvent.click(screen.getByTestId('save-org-name-button'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update organization name');
    });
  });

  it('cancels edit mode when cancel button is clicked', () => {
    render(<OrganizationSettings {...defaultProps} />);

    fireEvent.click(screen.getByTestId('edit-org-name-button'));

    const input = screen.getByTestId('org-name-input');
    fireEvent.change(input, { target: { value: 'Updated Organization' } });

    fireEvent.click(screen.getByTestId('cancel-edit-button'));

    // Should exit edit mode and revert to original name
    expect(screen.getByTestId('organization-name')).toHaveTextContent('Test Organization');
    expect(screen.queryByTestId('org-name-input')).not.toBeInTheDocument();
  });

  it('displays correct member count', () => {
    render(<OrganizationSettings {...defaultProps} />);

    expect(screen.getByTestId('organization-members-count')).toHaveTextContent('2 members');
  });

  it('handles empty members array', () => {
    render(<OrganizationSettings {...defaultProps} members={[]} />);

    expect(screen.getByTestId('organization-members-count')).toHaveTextContent('0 members');
  });

  it('handles null organization gracefully', () => {
    render(<OrganizationSettings {...defaultProps} organization={null} />);

    expect(screen.getByTestId('organization-name')).toHaveTextContent('');
    expect(screen.getByTestId('organization-created')).toHaveTextContent('N/A');
    expect(screen.getByTestId('organization-updated')).toHaveTextContent('N/A');
  });

  it('formats dates correctly', () => {
    const orgWithDates: Organization = {
      id: 'org-1',
      name: 'Test Organization',
      createdAt: '2023-06-15T12:30:00Z',
      updatedAt: '2023-07-20T09:15:00Z',
    };

    render(<OrganizationSettings {...defaultProps} organization={orgWithDates} />);

    const created = screen.getByTestId('organization-created');
    const updated = screen.getByTestId('organization-updated');

    // Check that dates are formatted (exact format may vary based on locale)
    expect(created.textContent).toMatch(/Jun.*15.*2023/);
    expect(updated.textContent).toMatch(/Jul.*20.*2023/);
  });

  it('shows loading state during save', async () => {
    const mockUpdateOrganization = vi
      .fn()
      .mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockOrganization), 100))
      );
    (
      organizationApi.updateOrganization as MockedFunction<
        typeof organizationApi.updateOrganization
      >
    ).mockImplementation(mockUpdateOrganization);

    render(<OrganizationSettings {...defaultProps} />);

    fireEvent.click(screen.getByTestId('edit-org-name-button'));

    const input = screen.getByTestId('org-name-input');
    fireEvent.change(input, { target: { value: 'Updated Organization' } });

    fireEvent.click(screen.getByTestId('save-org-name-button'));

    // Should show loading spinner
    expect(screen.getByTestId('save-org-name-button')).toHaveAttribute('disabled');

    await waitFor(() => {
      expect(mockUpdateOrganization).toHaveBeenCalled();
    });
  });
});
