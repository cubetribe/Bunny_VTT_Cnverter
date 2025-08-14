module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'utils/**/*.js',
    'server.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Test timeout
  testTimeout: 30000,
  
  // Verbose output for better debugging
  verbose: false,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Collect coverage from all files
  collectCoverage: false,
  
  // Coverage reporters
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  
  // Module file extensions
  moduleFileExtensions: [
    'js',
    'json'
  ],
  
  // Transform files
  transform: {},
  
  // Test results processor
  testResultsProcessor: undefined,
  
  // Global setup/teardown
  globalSetup: undefined,
  globalTeardown: undefined
};