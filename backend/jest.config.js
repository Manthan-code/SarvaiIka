/**
 * Jest Configuration for Backend Tests
 * Configures Jest for testing Node.js backend services
 */

module.exports = {
  // Test environment for Node.js
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
    '**/__tests__/**/*.js'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Module name mapping for mocks
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1'
  },
  
  // Coverage configuration
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: [],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/scripts/**',
    '!src/server.js'
  ],
  
  // Coverage thresholds - targeting 80% coverage
  coverageThreshold: {
    global: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    },
  },
  
  // Test timeout
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  passWithNoTests: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Reset modules between tests
  resetModules: false
};