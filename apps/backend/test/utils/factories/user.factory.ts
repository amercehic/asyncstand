import { faker } from '@faker-js/faker';
import { User, OrgRole, OrgMemberStatus } from '@prisma/client';
import { hash } from '@node-rs/argon2';

export interface CreateUserOptions {
  email?: string;
  name?: string;
  password?: string;
  passwordHash?: string;
  twofaSecret?: string;
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateManyUsersOptions extends CreateUserOptions {
  count: number;
}

export class UserFactory {
  /**
   * Build a single user object with optional overrides
   */
  static build(overrides: CreateUserOptions = {}): User {
    return {
      id: overrides.id ?? faker.string.uuid(),
      email: overrides.email ?? faker.internet.email(),
      name: overrides.name ?? faker.person.fullName(),
      passwordHash: overrides.passwordHash ?? 'hashed_password_123',
      twofaSecret: overrides.twofaSecret ?? null,
      isSuperAdmin: false,
      createdAt: overrides.createdAt ?? new Date(),
      updatedAt: overrides.updatedAt ?? new Date(),
    };
  }

  /**
   * Build multiple user objects
   */
  static buildMany(options: CreateManyUsersOptions): User[] {
    const { count, ...userOptions } = options;
    return Array.from({ length: count }, (_, index) =>
      this.build({
        ...userOptions,
        email: userOptions.email ?? `user${index}@example.com`,
        name: userOptions.name ?? `Test User ${index + 1}`,
      }),
    );
  }

  /**
   * Create a user with hashed password for integration tests
   */
  static async buildWithHashedPassword(overrides: CreateUserOptions = {}): Promise<User> {
    const password = overrides.password ?? 'TestPassword123!';
    const passwordHash = await hash(password, {
      memoryCost: 65536,
      timeCost: 3,
      outputLen: 32,
      parallelism: 1,
    });

    return this.build({
      ...overrides,
      passwordHash,
    });
  }

  /**
   * Create user data for API requests (without sensitive fields)
   */
  static buildForRequest(overrides: Partial<CreateUserOptions> = {}) {
    return {
      email: overrides.email ?? faker.internet.email(),
      name: overrides.name ?? faker.person.fullName(),
      password: overrides.password ?? 'TestPassword123!',
    };
  }

  /**
   * Create user data for signup requests
   */
  static buildSignupRequest(overrides: Partial<CreateUserOptions> = {}) {
    return {
      ...this.buildForRequest(overrides),
      organizationName: faker.company.name(),
    };
  }

  /**
   * Create user data for login requests
   */
  static buildLoginRequest(user: Partial<User> = {}) {
    return {
      email: user.email ?? faker.internet.email(),
      password: 'TestPassword123!',
    };
  }

  /**
   * Create a user with organization membership
   */
  static buildWithOrgMembership(
    overrides: CreateUserOptions & {
      orgId?: string;
      role?: OrgRole;
      status?: OrgMemberStatus;
    } = {},
  ) {
    const user = this.build(overrides);
    const orgMembership = {
      orgId: overrides.orgId ?? faker.string.uuid(),
      userId: user.id,
      role: overrides.role ?? OrgRole.member,
      status: overrides.status ?? OrgMemberStatus.active,
      inviteToken: null,
      invitedAt: null,
      acceptedAt: new Date(),
    };

    return { user, orgMembership };
  }

  /**
   * Create test user with common test scenarios
   */
  static buildTestScenarios() {
    return {
      validUser: this.build({ email: 'valid@example.com' }),
      adminUser: this.build({ email: 'admin@example.com' }),
      inactiveUser: this.build({ email: 'inactive@example.com' }),
      pendingUser: this.build({ email: 'pending@example.com' }),
    };
  }
}
