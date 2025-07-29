import { TestHelpers } from '@/test/utils/test-helpers';

// Extend Jest matchers with custom matchers
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidUser(): R;
      toHaveValidTokens(): R;
      toBeValidOrganization(): R;
      toHaveValidAuditLog(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidUser(received: unknown) {
    const obj = received as Record<string, unknown>;
    const pass =
      received &&
      typeof received === 'object' &&
      typeof obj.id === 'string' &&
      typeof obj.email === 'string' &&
      !Object.prototype.hasOwnProperty.call(received, 'password') &&
      !Object.prototype.hasOwnProperty.call(received, 'passwordHash');

    return {
      pass,
      message: () =>
        pass
          ? `Expected object not to be a valid user response`
          : `Expected object to be a valid user response with id, email, and no password fields`,
    };
  },

  toHaveValidTokens(received: unknown) {
    const obj = received as Record<string, unknown>;
    const pass =
      received &&
      typeof received === 'object' &&
      typeof obj.accessToken === 'string' &&
      typeof obj.refreshToken === 'string' &&
      typeof obj.expiresIn === 'number' &&
      (obj.expiresIn as number) > 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected object not to have valid authentication tokens`
          : `Expected object to have valid authentication tokens (accessToken, refreshToken, expiresIn)`,
    };
  },

  toBeValidOrganization(received: unknown) {
    const obj = received as Record<string, unknown>;
    const pass =
      received &&
      typeof received === 'object' &&
      typeof obj.id === 'string' &&
      typeof obj.name === 'string' &&
      (obj.name as string).length > 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected object not to be a valid organization`
          : `Expected object to be a valid organization with id and name`,
    };
  },

  toHaveValidAuditLog(received: unknown) {
    const obj = received as Record<string, unknown>;
    const pass =
      received &&
      typeof received === 'object' &&
      typeof obj.id === 'string' &&
      typeof obj.orgId === 'string' &&
      typeof obj.action === 'string' &&
      typeof obj.category === 'string' &&
      typeof obj.severity === 'string' &&
      obj.createdAt instanceof Date;

    return {
      pass,
      message: () =>
        pass
          ? `Expected object not to be a valid audit log`
          : `Expected object to be a valid audit log with required fields`,
    };
  },
});

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';

  // Set test database URL if not set
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  }

  // Set JWT secret for tests
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing';
  }

  // Disable console.log in tests unless explicitly enabled
  if (!process.env.ENABLE_TEST_LOGS) {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  }
});

// Global test teardown
afterAll(() => {
  // Restore console methods
  jest.restoreAllMocks();
});

// Global test utilities
global.testHelpers = TestHelpers;

// Mock external dependencies that shouldn't be called in tests
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    close: jest.fn(),
  })),
}));

// Mock Redis if used (commented out since not currently used)
// jest.mock('redis', () => ({
//   createClient: jest.fn(() => ({
//     connect: jest.fn(),
//     disconnect: jest.fn(),
//     get: jest.fn(),
//     set: jest.fn(),
//     del: jest.fn(),
//   })),
// }));

// Set longer timeout for integration tests
jest.setTimeout(30000);

export {};
