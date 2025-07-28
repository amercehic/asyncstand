module.exports = {
  displayName: 'E2E Tests',
  testEnvironment: 'node',
  rootDir: '../../',
  // testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'], // Using testRegex instead
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)', '../../packages/shared/dist'],
  setupFilesAfterEnv: ['<rootDir>/test/setup/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/prisma/prisma\\.service$': '<rootDir>/prisma/prisma.service',
  },
  testTimeout: 60000,
  // Use current e2e setup
  testRegex: '.e2e-spec.ts$',
};
