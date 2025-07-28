import { faker } from '@faker-js/faker';

export class TestHelpers {
  /**
   * Create mock user data for testing
   */
  static createMockUser(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      passwordHash: 'hashed_password_123',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Create mock organization data for testing
   */
  static createMockOrganization(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      name: faker.company.name(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Generate a random email for testing
   */
  static generateRandomEmail(): string {
    return faker.internet.email();
  }

  /**
   * Generate a random string of specified length
   */
  static generateRandomString(length: number = 8): string {
    return faker.string.alphanumeric(length);
  }

  /**
   * Generate a random suffix for test data
   */
  static generateRandomSuffix(): string {
    return Math.random().toString(36).substring(7);
  }

  /**
   * Create valid user signup data
   */
  static createValidUserData(overrides: Partial<any> = {}) {
    return {
      email: faker.internet.email(),
      password: 'TestPassword123!',
      name: faker.person.fullName(),
      ...overrides,
    };
  }

  /**
   * Create valid organization data
   */
  static createValidOrgData(overrides: Partial<any> = {}) {
    return {
      name: faker.company.name(),
      ...overrides,
    };
  }

  /**
   * Wait for a specified amount of time (useful for async operations)
   */
  static async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create mock audit log data for testing
   */
  static createMockAuditLog(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      orgId: faker.string.uuid(),
      actorUserId: faker.string.uuid(),
      actorType: 'user',
      action: 'user.create',
      category: 'user',
      severity: 'info',
      requestData: {},
      responseData: {},
      resources: [],
      sessionId: faker.string.uuid(),
      correlationId: faker.string.uuid(),
      tags: [],
      executionTime: faker.number.int({ min: 10, max: 1000 }),
      createdAt: new Date(),
      updatedAt: new Date(),
      actorUser: {
        id: faker.string.uuid(),
        email: faker.internet.email(),
        name: faker.person.fullName(),
      },
      ...overrides,
    };
  }

  /**
   * Deep clone an object (useful for test data manipulation)
   */
  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
