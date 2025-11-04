/**
 * Mock Winston logger for backend testing
 * Prevents actual file system operations and provides test-friendly logging
 */

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  silly: jest.fn(),
  log: jest.fn()
};

const mockTransports = {
  Console: jest.fn().mockImplementation(() => ({})),
  DailyRotateFile: jest.fn().mockImplementation(() => ({})),
  File: jest.fn().mockImplementation(() => ({}))
};

const mockFormat = {
  combine: jest.fn().mockReturnValue({}),
  timestamp: jest.fn().mockReturnValue({}),
  json: jest.fn().mockReturnValue({}),
  simple: jest.fn().mockReturnValue({}),
  colorize: jest.fn().mockReturnValue({})
};

const winston = {
  createLogger: jest.fn().mockReturnValue(mockLogger),
  format: mockFormat,
  transports: mockTransports,
  Logger: jest.fn().mockImplementation(() => mockLogger)
};

module.exports = winston;
module.exports.default = winston;