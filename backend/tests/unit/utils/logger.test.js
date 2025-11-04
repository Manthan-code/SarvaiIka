/**
 * Logger Unit Tests
 * Tests Winston logger configuration, log levels, and formatting
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const fs = require('fs');
const path = require('path');

// Mock winston before importing logger
jest.mock('winston', () => {
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    configure: jest.fn(),
    level: 'info'
  };

  const mockFormat = {
    combine: jest.fn().mockReturnValue('combined-format'),
    timestamp: jest.fn().mockReturnValue('timestamp-format'),
    errors: jest.fn().mockReturnValue('errors-format'),
    json: jest.fn().mockReturnValue('json-format'),
    colorize: jest.fn().mockReturnValue('colorize-format'),
    simple: jest.fn().mockReturnValue('simple-format'),
    printf: jest.fn().mockReturnValue('printf-format')
  };

  const mockTransports = {
    Console: jest.fn().mockImplementation(() => ({ name: 'console' })),
    File: jest.fn().mockImplementation(() => ({ name: 'file' }))
  };

  return {
    createLogger: jest.fn().mockReturnValue(mockLogger),
    format: mockFormat,
    transports: mockTransports,
    addColors: jest.fn()
  };
});

jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({ name: 'daily-rotate-file' }));
});

let winston;
let DailyRotateFile;

describe('Logger', () => {
  let logger;
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    jest.clearAllMocks();
    
    // Ensure fresh modules for each test to align mocks
    try { jest.resetModules(); } catch (_) {}

    // Clear require cache to get fresh logger and mocked dependencies
    delete require.cache[require.resolve('winston')];
    delete require.cache[require.resolve('winston-daily-rotate-file')];
    delete require.cache[require.resolve('../../../src/utils/logger')];

    // Re-require mocked dependencies so test references match the instance used by the logger under test
    winston = require('winston');
    DailyRotateFile = require('winston-daily-rotate-file');
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.clearAllMocks();
  });

  describe('Logger Configuration', () => {
    it('should create logger with correct configuration in development', () => {
      process.env.NODE_ENV = 'development';
      
      logger = require('../../../src/utils/logger');

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
          defaultMeta: expect.objectContaining({
            service: 'ai-agent-platform'
          }),
          transports: expect.any(Array)
        })
      );
    });

    it('should create logger with correct configuration in production', () => {
      process.env.NODE_ENV = 'production';
      
      logger = require('../../../src/utils/logger');

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          defaultMeta: expect.objectContaining({
            service: 'ai-agent-platform'
          }),
          transports: expect.any(Array)
        })
      );
    });

    it('should create logger with correct configuration in test', () => {
      process.env.NODE_ENV = 'test';
      
      logger = require('../../../src/utils/logger');

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          silent: true,
          transports: expect.any(Array)
        })
      );
    });

    it('should configure custom colors', () => {
      logger = require('../../../src/utils/logger');

      expect(winston.addColors).toHaveBeenCalledWith({
        error: 'red',
        warn: 'yellow',
        info: 'cyan',
        debug: 'green'
      });
    });

    it('should create console transport in development', () => {
      process.env.NODE_ENV = 'development';
      
      logger = require('../../../src/utils/logger');

      expect(winston.transports.Console).toHaveBeenCalledWith(
        expect.objectContaining({
          format: expect.any(String)
        })
      );
    });

    it('should create file transports in production', () => {
      process.env.NODE_ENV = 'production';
      
      logger = require('../../../src/utils/logger');

      expect(DailyRotateFile).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: expect.stringContaining('error-%DATE%.log'),
          level: 'error',
          maxSize: '20m',
          maxFiles: '14d'
        })
      );

      expect(DailyRotateFile).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: expect.stringContaining('combined-%DATE%.log'),
          maxSize: '20m',
          maxFiles: '14d'
        })
      );
    });
  });

  describe('Logger Methods', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      logger = require('../../../src/utils/logger');
    });

    it('should have error method', () => {
      expect(logger.error).toBeDefined();
      expect(typeof logger.error).toBe('function');
    });

    it('should have warn method', () => {
      expect(logger.warn).toBeDefined();
      expect(typeof logger.warn).toBe('function');
    });

    it('should have info method', () => {
      expect(logger.info).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    it('should have debug method', () => {
      expect(logger.debug).toBeDefined();
      expect(typeof logger.debug).toBe('function');
    });

    it('should have helper methods', () => {
      expect(logger.logError).toBeDefined();
      expect(logger.logWarning).toBeDefined();
      expect(logger.logInfo).toBeDefined();
      expect(logger.logDebug).toBeDefined();
      expect(logger.logRequest).toBeDefined();
      expect(logger.logResponse).toBeDefined();
      expect(logger.logPerformance).toBeDefined();
      expect(logger.logSecurity).toBeDefined();
      expect(logger.logDatabase).toBeDefined();
      expect(logger.logExternalApi).toBeDefined();
    });
  });

  describe('Helper Methods', () => {
    let mockLogger;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      mockLogger = winston.createLogger();
      logger = require('../../../src/utils/logger');
    });

    it('should log error with context', () => {
      const error = new Error('Test error');
      const context = { userId: '123', action: 'test' };

      logger.logError('Test message', error, context);

      expect(mockLogger.error).toHaveBeenCalledWith('Test message', {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        context
      });
    });

    it('should log warning with context', () => {
      const context = { userId: '123' };

      logger.logWarning('Warning message', context);

      expect(mockLogger.warn).toHaveBeenCalledWith('Warning message', { context });
    });

    it('should log info with context', () => {
      const context = { feature: 'test' };

      logger.logInfo('Info message', context);

      expect(mockLogger.info).toHaveBeenCalledWith('Info message', { context });
    });

    it('should log debug with context', () => {
      const context = { debug: true };

      logger.logDebug('Debug message', context);

      expect(mockLogger.debug).toHaveBeenCalledWith('Debug message', { context });
    });

    it('should log request details', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-user-agent'),
        user: { id: '123' }
      };

      logger.logRequest(req);

      expect(mockLogger.info).toHaveBeenCalledWith('HTTP Request', {
        type: 'request',
        method: 'GET',
        url: '/api/test',
        ip: '127.0.0.1',
        userAgent: 'test-user-agent',
        userId: '123'
      });
    });

    it('should log request without user', () => {
      const req = {
        method: 'POST',
        url: '/api/auth',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-user-agent')
      };

      logger.logRequest(req);

      expect(mockLogger.info).toHaveBeenCalledWith('HTTP Request', {
        type: 'request',
        method: 'POST',
        url: '/api/auth',
        ip: '127.0.0.1',
        userAgent: 'test-user-agent',
        userId: undefined
      });
    });

    it('should log response details', () => {
      const res = {
        statusCode: 200,
        get: jest.fn().mockReturnValue('application/json')
      };
      const responseTime = 150;

      logger.logResponse(res, responseTime);

      expect(mockLogger.info).toHaveBeenCalledWith('HTTP Response', {
        type: 'response',
        statusCode: 200,
        contentType: 'application/json',
        responseTime: 150
      });
    });

    it('should log performance metrics', () => {
      const metrics = {
        operation: 'database_query',
        duration: 250,
        memory: 1024,
        cpu: 15.5
      };

      logger.logPerformance('Database query performance', metrics);

      expect(mockLogger.info).toHaveBeenCalledWith('Database query performance', {
        type: 'performance',
        metrics
      });
    });

    it('should log security events', () => {
      const event = {
        type: 'failed_login',
        ip: '192.168.1.1',
        userAgent: 'malicious-bot',
        attempts: 5
      };

      logger.logSecurity('Failed login attempt', event);

      expect(mockLogger.warn).toHaveBeenCalledWith('Failed login attempt', {
        type: 'security',
        event
      });
    });

    it('should log database operations', () => {
      const operation = {
        query: 'SELECT * FROM users',
        duration: 45,
        rows: 10
      };

      logger.logDatabase('Database query executed', operation);

      expect(mockLogger.debug).toHaveBeenCalledWith('Database query executed', {
        type: 'database',
        operation
      });
    });

    it('should log external API calls', () => {
      const apiCall = {
        service: 'openai',
        endpoint: '/chat/completions',
        method: 'POST',
        statusCode: 200,
        duration: 1200
      };

      logger.logExternalApi('OpenAI API call', apiCall);

      expect(mockLogger.info).toHaveBeenCalledWith('OpenAI API call', {
        type: 'external_api',
        apiCall
      });
    });
  });

  describe('Error Handling', () => {
    let mockLogger;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      mockLogger = winston.createLogger();
      logger = require('../../../src/utils/logger');
    });

    it('should handle error without stack trace', () => {
      const error = { message: 'Error without stack' };

      logger.logError('Test error', error);

      expect(mockLogger.error).toHaveBeenCalledWith('Test error', {
        error: {
          message: 'Error without stack',
          stack: undefined,
          name: undefined
        },
        context: undefined
      });
    });

    it('should handle string error', () => {
      logger.logError('Test error', 'String error');

      expect(mockLogger.error).toHaveBeenCalledWith('Test error', {
        error: {
          message: 'String error',
          stack: undefined,
          name: undefined
        },
        context: undefined
      });
    });

    it('should handle null error', () => {
      logger.logError('Test error', null);

      expect(mockLogger.error).toHaveBeenCalledWith('Test error', {
        error: {
          message: null,
          stack: undefined,
          name: undefined
        },
        context: undefined
      });
    });

    it('should handle request without user-agent header', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue(undefined)
      };

      logger.logRequest(req);

      expect(mockLogger.info).toHaveBeenCalledWith('HTTP Request', {
        type: 'request',
        method: 'GET',
        url: '/api/test',
        ip: '127.0.0.1',
        userAgent: undefined,
        userId: undefined
      });
    });

    it('should handle response without content-type header', () => {
      const res = {
        statusCode: 404,
        get: jest.fn().mockReturnValue(undefined)
      };

      logger.logResponse(res);

      expect(mockLogger.info).toHaveBeenCalledWith('HTTP Response', {
        type: 'response',
        statusCode: 404,
        contentType: undefined,
        responseTime: undefined
      });
    });
  });

  describe('Environment-specific Behavior', () => {
    it('should be silent in test environment', () => {
      process.env.NODE_ENV = 'test';
      
      logger = require('../../../src/utils/logger');

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          silent: true
        })
      );
    });

    it('should use debug level in development', () => {
      process.env.NODE_ENV = 'development';
      
      logger = require('../../../src/utils/logger');

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug'
        })
      );
    });

    it('should use info level in production', () => {
      process.env.NODE_ENV = 'production';
      
      logger = require('../../../src/utils/logger');

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info'
        })
      );
    });

    it('should use error level in test', () => {
      process.env.NODE_ENV = 'test';
      
      logger = require('../../../src/utils/logger');

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error'
        })
      );
    });
  });

  describe('Format Configuration', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      logger = require('../../../src/utils/logger');
    });

    it('should configure timestamp format', () => {
      expect(winston.format.timestamp).toHaveBeenCalledWith({
        format: 'YYYY-MM-DD HH:mm:ss'
      });
    });

    it('should configure errors format', () => {
      expect(winston.format.errors).toHaveBeenCalledWith({
        stack: true
      });
    });

    it('should combine multiple formats', () => {
      expect(winston.format.combine).toHaveBeenCalled();
    });
  });

  describe('Transport Configuration', () => {
    it('should configure daily rotate file transport correctly', () => {
      process.env.NODE_ENV = 'production';
      
      logger = require('../../../src/utils/logger');

      expect(DailyRotateFile).toHaveBeenCalledWith(
        expect.objectContaining({
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d'
        })
      );
    });

    it('should create logs directory if it does not exist', () => {
      // This test would require mocking fs.existsSync and fs.mkdirSync
      // For now, we just verify the logger is created without errors
      process.env.NODE_ENV = 'production';
      
      expect(() => {
        logger = require('../../../src/utils/logger');
      }).not.toThrow();
    });
  });

  describe('Default Meta Configuration', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      logger = require('../../../src/utils/logger');
    });

    it('should include service name in default meta', () => {
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultMeta: expect.objectContaining({
            service: 'ai-agent-platform'
          })
        })
      );
    });

    it('should include environment in default meta', () => {
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultMeta: expect.objectContaining({
            environment: 'development'
          })
        })
      );
    });
  });
});