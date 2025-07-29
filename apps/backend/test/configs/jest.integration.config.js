module.exports = {
  displayName: 'Integration Tests',
  testEnvironment: 'node',
  rootDir: '../../',
  testMatch: ['<rootDir>/test/integration/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup/jest.setup.ts'],
  moduleNameMapper: {
    '^@/prisma/prisma\\.service$': '<rootDir>/prisma/prisma.service',
    '^@/test/(.*)$': '<rootDir>/test/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 30000,
  // Use a separate test database for integration tests
  globalSetup: '<rootDir>/test/setup/integration-setup.ts',
  globalTeardown: '<rootDir>/test/setup/integration-teardown.ts',

  // Coverage collection
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.integration.spec.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.dto.ts',
  ],
};
