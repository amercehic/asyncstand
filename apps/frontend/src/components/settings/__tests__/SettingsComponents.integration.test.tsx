import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils';
import { OrganizationSettings } from '@/components/settings/OrganizationSettings';
import { MembersSettings } from '@/components/settings/MembersSettings';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import {} from '@/lib/api';
import type { Organization, OrgMember } from '@/lib/api';

// Mock APIs
vi.mock('@/lib/api', () => ({
  organizationApi: {
    updateOrganization: vi.fn(),
    inviteMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    getMembers: vi.fn(),
  },
  authApi: {
    updatePassword: vi.fn(),
  },
}));

// Mock UI components
vi.mock('@/components/ui', async () => {
  const actual = await vi.importActual('@/components/ui');
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
    ConfirmationModal: ({
      isOpen,
      onConfirm,
      onClose,
    }: {
      isOpen: boolean;
      onConfirm: () => void;
      onClose: () => void;
    }) =>
      isOpen ? (
        <div data-testid="confirmation-modal">
          <button onClick={onConfirm} data-testid="confirm-button">
            Confirm
          </button>
          <button onClick={onClose} data-testid="cancel-button">
            Cancel
          </button>
        </div>
      ) : null,
  };
});

describe('Settings Components Integration', () => {
  const mockOrganization: Organization = {
    id: 'org-integration-1',
    name: 'Integration Test Org',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-02T00:00:00Z',
  };

  const mockMembers: OrgMember[] = [
    {
      id: 'member-integration-1',
      name: 'Integration User',
      email: 'integration@example.com',
      role: 'owner',
      status: 'active',
      joinedAt: '2023-01-01T00:00:00Z',
    },
  ];

  const mockUser = {
    id: 'user-integration-1',
    name: 'Integration User',
    email: 'integration@example.com',
    role: 'owner',
    updatedAt: '2023-01-01T12:30:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Parallel Component Isolation', () => {
    it('OrganizationSettings works independently with unique IDs', () => {
      render(
        <OrganizationSettings
          organization={mockOrganization}
          members={mockMembers}
          canManageOrg={true}
          onOrganizationUpdate={vi.fn() as (org: Organization) => void}
        />
      );

      expect(screen.getByText('Integration Test Org')).toBeInTheDocument();
      expect(screen.getByTestId('organization-name')).toHaveTextContent('Integration Test Org');
      expect(screen.getByTestId('organization-members-count')).toHaveTextContent('1 members');
    });

    it('MembersSettings works independently with unique IDs', () => {
      render(
        <MembersSettings
          members={mockMembers}
          canManageMembers={true}
          currentUserId="member-integration-1"
          onMembersUpdate={vi.fn() as (members: OrgMember[]) => void}
        />
      );

      expect(screen.getByText('Integration User')).toBeInTheDocument();
      expect(screen.getByTestId('members-count')).toHaveTextContent('1 of 1 members');
      expect(screen.getByTestId('member-row-member-integration-1')).toBeInTheDocument();
    });

    it('ProfileSettings works independently with unique IDs', () => {
      render(<ProfileSettings user={mockUser} onUserUpdate={vi.fn() as () => void} />);

      expect(screen.getByTestId('profile-name-input')).toHaveValue('Integration User');
      expect(screen.getByTestId('profile-email-input')).toHaveValue('integration@example.com');
      expect(screen.getByTestId('profile-role')).toHaveTextContent('owner');
    });

    it('Components can render simultaneously without interference', () => {
      // Render multiple components with different data to test isolation
      const { rerender } = render(
        <div>
          <OrganizationSettings
            organization={mockOrganization}
            members={mockMembers}
            canManageOrg={true}
            onOrganizationUpdate={vi.fn() as (org: Organization) => void}
          />
          <MembersSettings
            members={mockMembers}
            canManageMembers={true}
            currentUserId="member-integration-1"
            onMembersUpdate={vi.fn() as (members: OrgMember[]) => void}
          />
        </div>
      );

      // Both components should render their own content
      expect(screen.getByText('Integration Test Org')).toBeInTheDocument();
      expect(screen.getByText('Integration User')).toBeInTheDocument();
      expect(screen.getByTestId('organization-name')).toHaveTextContent('Integration Test Org');
      expect(screen.getByTestId('members-count')).toHaveTextContent('1 of 1 members');

      // Rerender with ProfileSettings added
      rerender(
        <div>
          <OrganizationSettings
            organization={mockOrganization}
            members={mockMembers}
            canManageOrg={true}
            onOrganizationUpdate={vi.fn() as (org: Organization) => void}
          />
          <MembersSettings
            members={mockMembers}
            canManageMembers={true}
            currentUserId="member-integration-1"
            onMembersUpdate={vi.fn() as (members: OrgMember[]) => void}
          />
          <ProfileSettings user={mockUser} onUserUpdate={vi.fn() as () => void} />
        </div>
      );

      // All components should still work
      expect(screen.getByText('Integration Test Org')).toBeInTheDocument();
      expect(screen.getByText('Integration User')).toBeInTheDocument();
      expect(screen.getByTestId('profile-name-input')).toHaveValue('Integration User');
    });
  });

  describe('State Isolation', () => {
    it('each component maintains independent state', () => {
      // Render OrganizationSettings
      const { unmount: unmountOrg } = render(
        <OrganizationSettings
          organization={mockOrganization}
          members={mockMembers}
          canManageOrg={true}
          onOrganizationUpdate={vi.fn() as (org: Organization) => void}
        />
      );

      expect(screen.getByTestId('organization-name')).toHaveTextContent('Integration Test Org');
      unmountOrg();

      // Render MembersSettings - should have no interference from previous component
      render(
        <MembersSettings
          members={mockMembers}
          canManageMembers={true}
          currentUserId="member-integration-1"
          onMembersUpdate={vi.fn() as (members: OrgMember[]) => void}
        />
      );

      expect(screen.getByTestId('members-count')).toHaveTextContent('1 of 1 members');
      expect(screen.queryByTestId('organization-name')).not.toBeInTheDocument();
    });
  });

  describe('Props and Callbacks', () => {
    it('each component calls its own callbacks independently', () => {
      const orgUpdateCallback = vi.fn();
      const membersUpdateCallback = vi.fn();
      const userUpdateCallback = vi.fn();

      // Test OrganizationSettings callback
      const { unmount: unmountOrg } = render(
        <OrganizationSettings
          organization={mockOrganization}
          members={mockMembers}
          canManageOrg={true}
          onOrganizationUpdate={orgUpdateCallback}
        />
      );

      expect(orgUpdateCallback).not.toHaveBeenCalled();
      unmountOrg();

      // Test MembersSettings callback
      const { unmount: unmountMembers } = render(
        <MembersSettings
          members={mockMembers}
          canManageMembers={true}
          currentUserId="member-integration-1"
          onMembersUpdate={membersUpdateCallback}
        />
      );

      expect(membersUpdateCallback).not.toHaveBeenCalled();
      expect(orgUpdateCallback).not.toHaveBeenCalled(); // Still not called
      unmountMembers();

      // Test ProfileSettings callback
      render(<ProfileSettings user={mockUser} onUserUpdate={userUpdateCallback} />);

      expect(userUpdateCallback).not.toHaveBeenCalled();
      expect(membersUpdateCallback).not.toHaveBeenCalled(); // Still not called
      expect(orgUpdateCallback).not.toHaveBeenCalled(); // Still not called
    });
  });
});
