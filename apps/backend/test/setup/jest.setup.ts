import { TestHelpers } from '../utils/test-helpers';

// Extend Jest matchers with custom matchers
declare global {
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
  toBeValidUser(received: any) {
    const pass =
      received &&
      typeof received === 'object' &&
      typeof received.id === 'string' &&
      typeof received.email === 'string' &&
      !received.hasOwnProperty('password') &&
      !received.hasOwnProperty('passwordHash');

    return {
      pass,
      message: () =>
        pass
          ? `Expected object not to be a valid user response`
          : `Expected object to be a valid user response with id, email, and no password fields`,
    };
  },

  toHaveValidTokens(received: any) {
    const pass =
      received &&
      typeof received === 'object' &&
      typeof received.accessToken === 'string' &&
      typeof received.refreshToken === 'string' &&
      typeof received.expiresIn === 'number' &&
      received.expiresIn > 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected object not to have valid authentication tokens`
          : `Expected object to have valid authentication tokens (accessToken, refreshToken, expiresIn)`,
    };
  },

  toBeValidOrganization(received: any) {
    const pass =
      received &&
      typeof received === 'object' &&
      typeof received.id === 'string' &&
      typeof received.name === 'string' &&
      received.name.length > 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected object not to be a valid organization`
          : `Expected object to be a valid organization with id and name`,
    };
  },

  toHaveValidAuditLog(received: any) {
    const pass =
      received &&
      typeof received === 'object' &&
      typeof received.id === 'string' &&
      typeof received.orgId === 'string' &&
      typeof received.action === 'string' &&
      typeof received.category === 'string' &&
      typeof received.severity === 'string' &&
      received.createdAt instanceof Date;

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
