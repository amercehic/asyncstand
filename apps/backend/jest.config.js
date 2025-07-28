module.exports = {
  projects: [
    '<rootDir>/test/configs/jest.unit.config.js',
    '<rootDir>/test/configs/jest.integration.config.js',
    '<rootDir>/test/configs/jest.e2e.config.js',
  ],
  collectCoverage: false, // Coverage handled by individual projects
};
