module.exports = {
  displayName: 'Unit Tests',
  testEnvironment: 'node',
  rootDir: '../../',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
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
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test/setup/jest.setup.ts'],
  moduleNameMapper: {
    '^@/prisma/prisma\\.service$': '<rootDir>/prisma/prisma.service',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 10000,
};
