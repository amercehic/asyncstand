module.exports = {
  displayName: 'E2E Tests',
  testEnvironment: 'node',
  rootDir: '../../',

  // Conservative parallelization for E2E tests
  maxWorkers: 1, // Sequential execution to avoid database conflicts
  workerIdleMemoryLimit: '1GB', // Higher memory limit for E2E tests

  testMatch: ['<rootDir>/test/e2e/**/*.test.ts'],

  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],

  setupFilesAfterEnv: [
    '<rootDir>/test/setup/jest.setup.ts',
    '<rootDir>/test/setup/integration-setup.ts',
  ],
  globalTeardown: '<rootDir>/test/setup/integration-teardown.ts',

  moduleNameMapper: {
    '^shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^@/prisma/prisma\\.service$': '<rootDir>/prisma/prisma.service',
    '^@/test/(.*)$': '<rootDir>/test/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Extended timeouts for E2E tests
  testTimeout: 60000,

  // Coverage collection
  coverageDirectory: 'coverage/e2e',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e-spec.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.dto.ts',
  ],

  // Performance optimizations
  cache: true,
  cacheDirectory: '/tmp/jest_e2e_cache',
  clearMocks: true,

  // Debugging options
  detectOpenHandles: true, // Detect async operations that prevent Jest from exiting
};
