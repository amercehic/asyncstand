module.exports = {
  displayName: 'Backend Tests',

  // Performance optimizations
  maxWorkers: '50%', // Use 50% of available CPU cores
  workerIdleMemoryLimit: '500MB', // Restart workers after 500MB memory usage

  // Test execution projects for parallelization
  projects: [
    '<rootDir>/test/configs/jest.unit.config.js',
    '<rootDir>/test/configs/jest.integration.config.js',
    '<rootDir>/test/configs/jest.e2e.config.js',
  ],

  // Global coverage settings
  collectCoverage: false, // Coverage handled by individual projects
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageDirectory: 'coverage',

  // Test reporting
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'junit.xml',
        ancestrySeparator: ' › ',
        uniqueOutputName: 'false',
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        usePathForSuiteName: 'true',
      },
    ],
    [
      'jest-html-reporters',
      {
        publicPath: 'test-results/html',
        filename: 'test-report.html',
        pageTitle: 'Backend Test Report',
        logoImgPath: undefined,
        hideIcon: false,
        expand: false,
        testCommand: 'pnpm test',
        openReport: false,
        failureMessageOnly: 0,
        enableMergeData: true,
        dataMergeLevel: 1,
        inlineSource: false,
      },
    ],
  ],

  // Performance monitoring
  verbose: false, // Reduce output for better performance
  logHeapUsage: true,

  // Error handling
  bail: false, // Continue running tests even if some fail
  errorOnDeprecated: true,

  // Cache configuration for faster subsequent runs
  cache: true,
  cacheDirectory: '/tmp/jest_backend_cache',

  // Watch mode optimizations
  watchPathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/'],

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
};
