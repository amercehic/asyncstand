import { TestHelpers } from '@/test/utils/test-helpers';
import { OrgRole, OrgMemberStatus } from '@prisma/client';

export class UserFixtures {
  /**
   * Valid user data for signup
   */
  static validSignupData(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      email: TestHelpers.generateRandomEmail(),
      password: 'TestPassword123!',
      name: 'Test User',
      ...overrides,
    };
  }

  /**
   * Valid user data without password (for responses)
   */
  static validUserResponse(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: TestHelpers.generateRandomString(),
      email: TestHelpers.generateRandomEmail(),
      name: 'Test User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * User data with weak password
   */
  static userWithWeakPassword(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      ...this.validSignupData(),
      password: '123',
      ...overrides,
    };
  }

  /**
   * User data with invalid email
   */
  static userWithInvalidEmail(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      ...this.validSignupData(),
      email: 'invalid-email',
      ...overrides,
    };
  }

  /**
   * User data with missing required fields
   */
  static userWithMissingFields(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      // Missing email and password
      name: 'Test User',
      ...overrides,
    };
  }

  /**
   * User data with very long name
   */
  static userWithLongName(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      ...this.validSignupData(),
      name: 'a'.repeat(256),
      ...overrides,
    };
  }

  /**
   * Login credentials
   */
  static validLoginCredentials(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      email: TestHelpers.generateRandomEmail(),
      password: 'TestPassword123!',
      ...overrides,
    };
  }

  /**
   * Invalid login credentials
   */
  static invalidLoginCredentials(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      email: TestHelpers.generateRandomEmail(),
      password: 'WrongPassword123!',
      ...overrides,
    };
  }

  /**
   * Password reset request data
   */
  static passwordResetRequest(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      email: TestHelpers.generateRandomEmail(),
      ...overrides,
    };
  }

  /**
   * Password reset data
   */
  static passwordResetData(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      token: 'valid_reset_token',
      password: 'NewPassword123!',
      email: TestHelpers.generateRandomEmail(),
      ...overrides,
    };
  }

  /**
   * User with organization membership
   */
  static userWithOrgMembership(overrides: Partial<Record<string, unknown>> = {}) {
    const userId = TestHelpers.generateRandomString();
    const orgId = TestHelpers.generateRandomString();

    return {
      id: userId,
      email: TestHelpers.generateRandomEmail(),
      name: 'Test User',
      passwordHash: 'hashed_password',
      createdAt: new Date(),
      updatedAt: new Date(),
      orgMembers: [
        {
          id: TestHelpers.generateRandomString(),
          orgId,
          userId,
          role: OrgRole.member,
          status: OrgMemberStatus.active,
          createdAt: new Date(),
          updatedAt: new Date(),
          acceptedAt: new Date(),
          org: {
            id: orgId,
            name: 'Test Organization',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
      ...overrides,
    };
  }

  /**
   * Owner user with organization
   */
  static ownerUserWithOrg(overrides: Partial<Record<string, unknown>> = {}) {
    return this.userWithOrgMembership({
      ...overrides,
      orgMembers: [
        {
          ...this.userWithOrgMembership().orgMembers[0],
          role: OrgRole.owner,
          ...overrides.orgMembers?.[0],
        },
      ],
    });
  }

  /**
   * Admin user with organization
   */
  static adminUserWithOrg(overrides: Partial<Record<string, unknown>> = {}) {
    return this.userWithOrgMembership({
      ...overrides,
      orgMembers: [
        {
          ...this.userWithOrgMembership().orgMembers[0],
          role: OrgRole.admin,
          ...overrides.orgMembers?.[0],
        },
      ],
    });
  }

  /**
   * Invited user (pending invitation)
   */
  static invitedUser(overrides: Partial<Record<string, unknown>> = {}) {
    return this.userWithOrgMembership({
      ...overrides,
      passwordHash: 'temp_hash',
      orgMembers: [
        {
          ...this.userWithOrgMembership().orgMembers[0],
          status: OrgMemberStatus.invited,
          inviteToken: 'invite_token_hash',
          invitedAt: new Date(),
          acceptedAt: null,
          ...overrides.orgMembers?.[0],
        },
      ],
    });
  }

  /**
   * User with multiple organization memberships
   */
  static userWithMultipleOrgs(overrides: Partial<Record<string, unknown>> = {}) {
    const userId = TestHelpers.generateRandomString();

    return {
      id: userId,
      email: TestHelpers.generateRandomEmail(),
      name: 'Test User',
      passwordHash: 'hashed_password',
      createdAt: new Date(),
      updatedAt: new Date(),
      orgMembers: [
        {
          id: TestHelpers.generateRandomString(),
          orgId: TestHelpers.generateRandomString(),
          userId,
          role: OrgRole.owner,
          status: OrgMemberStatus.active,
          createdAt: new Date(),
          updatedAt: new Date(),
          acceptedAt: new Date(),
          org: {
            id: TestHelpers.generateRandomString(),
            name: 'Primary Organization',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          id: TestHelpers.generateRandomString(),
          orgId: TestHelpers.generateRandomString(),
          userId,
          role: OrgRole.member,
          status: OrgMemberStatus.active,
          createdAt: new Date(),
          updatedAt: new Date(),
          acceptedAt: new Date(),
          org: {
            id: TestHelpers.generateRandomString(),
            name: 'Secondary Organization',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
      ...overrides,
    };
  }
}
