module.exports = {
  displayName: 'E2E Tests',
  testEnvironment: 'node',
  rootDir: '../../',

  // Conservative parallelization for E2E tests
  maxWorkers: 1, // Sequential execution to avoid database conflicts
  workerIdleMemoryLimit: '1GB', // Higher memory limit for E2E tests

  testRegex: '.e2e-spec.ts$',

  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)', '../../packages/shared/dist'],

  setupFilesAfterEnv: [
    '<rootDir>/test/setup/jest.setup.ts',
    '<rootDir>/test/setup/integration-setup.ts',
  ],
  globalTeardown: '<rootDir>/test/setup/integration-teardown.ts',

  moduleNameMapper: {
    '^@/prisma/prisma\\.service$': '<rootDir>/prisma/prisma.service',
    '^@/test/(.*)$': '<rootDir>/test/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Extended timeouts for E2E tests
  testTimeout: 60000,

  // Coverage collection
  collectCoverage: true,
  coverageDirectory: 'coverage/e2e',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
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
  verbose: true, // More verbose output for E2E tests
  detectOpenHandles: true, // Detect async operations that prevent Jest from exiting
  forceExit: true, // Force exit after tests complete
};
