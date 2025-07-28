module.exports = {
  displayName: 'Integration Tests',
  testEnvironment: 'node',
  rootDir: '../../',
  testMatch: ['<rootDir>/test/integration/**/*.integration.spec.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/prisma/prisma\\.service$': '<rootDir>/prisma/prisma.service',
  },
  testTimeout: 30000,
  // Use a separate test database for integration tests
  globalSetup: '<rootDir>/test/setup/integration-setup.ts',
  globalTeardown: '<rootDir>/test/setup/integration-teardown.ts',
};
