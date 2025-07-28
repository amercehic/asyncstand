import { TestHelpers } from '../test-helpers';
import { OrgRole, OrgMemberStatus } from '@prisma/client';

export class OrganizationFixtures {
  /**
   * Valid organization data
   */
  static validOrgData(overrides: Partial<any> = {}) {
    return {
      name: `Test Organization ${TestHelpers.generateRandomSuffix()}`,
      ...overrides,
    };
  }

  /**
   * Organization response data
   */
  static validOrgResponse(overrides: Partial<any> = {}) {
    return {
      id: TestHelpers.generateRandomString(),
      name: `Test Organization ${TestHelpers.generateRandomSuffix()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Organization with very long name
   */
  static orgWithLongName(overrides: Partial<any> = {}) {
    return {
      ...this.validOrgData(),
      name: 'a'.repeat(256),
      ...overrides,
    };
  }

  /**
   * Organization with members
   */
  static orgWithMembers(overrides: Partial<any> = {}) {
    const orgId = TestHelpers.generateRandomString();

    return {
      id: orgId,
      name: `Test Organization ${TestHelpers.generateRandomSuffix()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [
        {
          id: TestHelpers.generateRandomString(),
          orgId,
          userId: TestHelpers.generateRandomString(),
          role: OrgRole.owner,
          status: OrgMemberStatus.active,
          createdAt: new Date(),
          updatedAt: new Date(),
          acceptedAt: new Date(),
          user: {
            id: TestHelpers.generateRandomString(),
            email: TestHelpers.generateRandomEmail(),
            name: 'Owner User',
          },
        },
        {
          id: TestHelpers.generateRandomString(),
          orgId,
          userId: TestHelpers.generateRandomString(),
          role: OrgRole.admin,
          status: OrgMemberStatus.active,
          createdAt: new Date(),
          updatedAt: new Date(),
          acceptedAt: new Date(),
          user: {
            id: TestHelpers.generateRandomString(),
            email: TestHelpers.generateRandomEmail(),
            name: 'Admin User',
          },
        },
        {
          id: TestHelpers.generateRandomString(),
          orgId,
          userId: TestHelpers.generateRandomString(),
          role: OrgRole.member,
          status: OrgMemberStatus.active,
          createdAt: new Date(),
          updatedAt: new Date(),
          acceptedAt: new Date(),
          user: {
            id: TestHelpers.generateRandomString(),
            email: TestHelpers.generateRandomEmail(),
            name: 'Regular Member',
          },
        },
      ],
      ...overrides,
    };
  }

  /**
   * Member invitation data
   */
  static memberInvitationData(overrides: Partial<any> = {}) {
    return {
      email: TestHelpers.generateRandomEmail(),
      role: OrgRole.member,
      ...overrides,
    };
  }

  /**
   * Admin invitation data
   */
  static adminInvitationData(overrides: Partial<any> = {}) {
    return {
      ...this.memberInvitationData(),
      role: OrgRole.admin,
      ...overrides,
    };
  }

  /**
   * Invalid invitation data (invalid email)
   */
  static invalidInvitationData(overrides: Partial<any> = {}) {
    return {
      email: 'invalid-email',
      role: OrgRole.member,
      ...overrides,
    };
  }

  /**
   * Accept invitation data
   */
  static acceptInvitationData(overrides: Partial<any> = {}) {
    return {
      token: 'valid_invite_token',
      name: 'New Member',
      password: 'NewPassword123!',
      ...overrides,
    };
  }

  /**
   * Accept invitation data for existing user
   */
  static acceptInvitationDataExistingUser(overrides: Partial<any> = {}) {
    return {
      token: 'valid_invite_token',
      name: 'Existing User',
      // No password for existing users
      ...overrides,
    };
  }

  /**
   * Update member data
   */
  static updateMemberData(overrides: Partial<any> = {}) {
    return {
      role: OrgRole.admin,
      ...overrides,
    };
  }

  /**
   * Suspend member data
   */
  static suspendMemberData(overrides: Partial<any> = {}) {
    return {
      suspend: true,
      ...overrides,
    };
  }

  /**
   * Organization member response
   */
  static memberResponse(overrides: Partial<any> = {}) {
    return {
      id: TestHelpers.generateRandomString(),
      email: TestHelpers.generateRandomEmail(),
      name: 'Test Member',
      role: 'member',
      status: 'active',
      joinedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Members list response
   */
  static membersListResponse(overrides: Partial<any> = {}) {
    return {
      members: [
        this.memberResponse({ role: 'owner', name: 'Owner User' }),
        this.memberResponse({ role: 'admin', name: 'Admin User' }),
        this.memberResponse({ role: 'member', name: 'Regular Member' }),
      ],
      ...overrides,
    };
  }

  /**
   * Organization with pending invitations
   */
  static orgWithPendingInvitations(overrides: Partial<any> = {}) {
    const orgId = TestHelpers.generateRandomString();

    return {
      ...this.validOrgResponse({ id: orgId }),
      pendingInvitations: [
        {
          id: TestHelpers.generateRandomString(),
          orgId,
          userId: TestHelpers.generateRandomString(),
          role: OrgRole.member,
          status: OrgMemberStatus.invited,
          inviteToken: 'hashed_invite_token',
          invitedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: TestHelpers.generateRandomString(),
            email: TestHelpers.generateRandomEmail(),
            name: 'Pending User',
            passwordHash: 'temp_hash',
          },
        },
      ],
      ...overrides,
    };
  }

  /**
   * Empty organization (no members)
   */
  static emptyOrganization(overrides: Partial<any> = {}) {
    return {
      ...this.validOrgResponse(),
      members: [],
      ...overrides,
    };
  }
}
