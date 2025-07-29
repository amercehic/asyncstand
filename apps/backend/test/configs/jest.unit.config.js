module.exports = {
  displayName: 'Unit Tests',
  testEnvironment: 'node',
  rootDir: '../../',

  // Performance optimizations for unit tests
  maxWorkers: '75%', // More aggressive parallelization for unit tests
  workerIdleMemoryLimit: '200MB',

  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },

  // Coverage collection
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e-spec.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.dto.ts',
  ],
  coverageDirectory: 'coverage/unit',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  setupFilesAfterEnv: ['<rootDir>/test/setup/jest.setup.ts'],
  moduleNameMapper: {
    '^@/prisma/prisma\\.service$': '<rootDir>/prisma/prisma.service',
    '^@/test/(.*)$': '<rootDir>/test/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Optimized timeouts for unit tests
  testTimeout: 10000,

  // Performance optimizations
  cache: true,
  cacheDirectory: '/tmp/jest_unit_cache',
  clearMocks: true,

  // Faster test discovery
  haste: {
    enableSymlinks: false,
  },
};
