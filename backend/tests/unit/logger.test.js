// Mock dependencies before requiring the logger
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    end: jest.fn()
  };
  
  return {
    format: {
      combine: jest.fn().mockReturnThis(),
      timestamp: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      colorize: jest.fn().mockReturnThis(),
      simple: jest.fn().mockReturnThis(),
      printf: jest.fn(formatter => formatter),
      label: jest.fn().mockReturnThis(),
      metadata: jest.fn().mockReturnThis()
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    },
    createLogger: jest.fn().mockReturnValue(mockLogger),
    addColors: jest.fn()
  };
});

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn()
}));

jest.mock('path', () => ({
  dirname: jest.fn().mockReturnValue('./logs'),
  join: jest.fn().mockImplementation((...args) => args.join('/'))
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mock-uuid')
}));

// Set environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'info';
process.env.ELASTICSEARCH_URL = 'http://localhost:9200';
process.env.ENABLE_ELASTICSEARCH = 'false';

// Require the logger after all mocks are set up
const logger = require('../../src/utils/logger');
const winston = require('winston');
const fs = require('fs');

// Mock process events after logger is loaded
const processOnSpy = jest.spyOn(process, 'on');
const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

describe('Logger Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Logger Methods', () => {
    test('info method logs messages correctly', () => {
      logger.info('Test info message', { test: 'data' });
      expect(winston.createLogger().info).toHaveBeenCalledWith('Test info message', { test: 'data' });
    });

    test('error method logs errors correctly', () => {
      const error = new Error('Test error');
      logger.error('Test error message', { error });
      expect(winston.createLogger().error).toHaveBeenCalledWith('Test error message', { error });
    });

    test('warn method logs warnings correctly', () => {
      logger.warn('Test warning message');
      expect(winston.createLogger().warn).toHaveBeenCalledWith('Test warning message');
    });

    test('debug method logs debug messages correctly', () => {
      logger.debug('Test debug message');
      expect(winston.createLogger().debug).toHaveBeenCalledWith('Test debug message');
    });

    test('http method logs HTTP messages correctly', () => {
      logger.http('Test HTTP message');
      expect(winston.createLogger().http).toHaveBeenCalledWith('Test HTTP message');
    });
  });

  describe('Helper Methods', () => {
    let req, res, next;
    
    beforeEach(() => {
      req = {
        method: 'GET',
        originalUrl: '/api/test',
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        get: jest.fn().mockReturnValue('Test User Agent'),
        user: { id: 'user-123' }
      };
      
      res = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        })
      };
      
      next = jest.fn();
    });
    
    test('logRequest logs HTTP requests correctly', () => {
      logger.logRequest(req, res, 100);
      expect(winston.createLogger().http).toHaveBeenCalled();
    });
    
    test('logRequest handles missing user and IP fallback', () => {
      delete req.user;
      delete req.ip;
      
      logger.logRequest(req, res, 100);
      expect(winston.createLogger().http).toHaveBeenCalled();
    });
    
    test('logRequest logs error status codes as warnings', () => {
      res.statusCode = 404;
      logger.logRequest(req, res, 100);
      expect(winston.createLogger().warn).toHaveBeenCalled();
    });
    
    test('logRequest logs server error status codes as errors or warnings', () => {
      res.statusCode = 500;
      logger.logRequest(req, res, 100);
      // Check either error or warn was called
      expect(
        winston.createLogger().error.mock.calls.length > 0 || 
        winston.createLogger().warn.mock.calls.length > 0
      ).toBeTruthy();
    });
    
    test('logSecurity logs security events correctly', () => {
      logger.logSecurity('login_attempt', { success: false }, req);
      expect(winston.createLogger().warn).toHaveBeenCalled();
    });
    
    test('logSecurity works without request object', () => {
      logger.logSecurity('config_change', { setting: 'security_level' });
      expect(winston.createLogger().warn).toHaveBeenCalled();
    });
    
    test('logPerformance logs performance metrics correctly', () => {
      logger.logPerformance('database_query', 150, { query: 'SELECT * FROM users' });
      expect(winston.createLogger().info).toHaveBeenCalled();
    });
    
    test('logPerformance handles missing metadata', () => {
      logger.logPerformance('database_query', 150);
      expect(winston.createLogger().info).toHaveBeenCalled();
    });
    
    test('logDatabase logs database operations correctly', () => {
      logger.logDatabase('query', 'users', 50);
      expect(winston.createLogger().debug).toHaveBeenCalled();
    });
    
    test('logDatabase logs database errors correctly', () => {
      const error = new Error('DB connection failed');
      logger.logDatabase('query', 'users', 50, error);
      expect(winston.createLogger().error).toHaveBeenCalled();
    });
    
    test('logAI logs AI service calls correctly', () => {
      logger.logAI('openai', 'completion', 1000, 0.02, 300);
      expect(winston.createLogger().info).toHaveBeenCalled();
    });
    
    test('logAI logs AI service errors correctly', () => {
      const error = new Error('API timeout');
      logger.logAI('openai', 'completion', 0, 0, 3000, error);
      expect(winston.createLogger().error).toHaveBeenCalled();
    });
    
    test('logUserAction logs user actions correctly', () => {
      logger.logUserAction('user-123', 'login', 'auth-system', { device: 'mobile' });
      expect(winston.createLogger().info).toHaveBeenCalled();
    });
    
    test('logUserAction handles missing metadata', () => {
      logger.logUserAction('user-123', 'login', 'auth-system');
      expect(winston.createLogger().info).toHaveBeenCalled();
    });
    
    test('logError logs application errors correctly', () => {
      const error = new Error('Test error');
      logger.logError(error, { component: 'auth' });
      expect(winston.createLogger().error).toHaveBeenCalled();
    });
    
    test('logError handles string errors', () => {
      logger.logError('String error message', { component: 'auth' });
      expect(winston.createLogger().error).toHaveBeenCalled();
    });
    
    test('logError handles missing metadata', () => {
      const error = new Error('Test error');
      logger.logError(error);
      expect(winston.createLogger().error).toHaveBeenCalled();
    });
    
    test('logBusiness logs business events correctly', () => {
      logger.logBusiness('subscription_renewed', { userId: 'user-123', plan: 'premium' });
      expect(winston.createLogger().info).toHaveBeenCalled();
    });
    
    test('requestLogger middleware works correctly', () => {
      logger.requestLogger(req, res, next);
      
      expect(req.id).toBeDefined();
      expect(winston.createLogger().http).toHaveBeenCalled();
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(next).toHaveBeenCalled();
    });
    
    test('requestLogger handles missing user', () => {
      delete req.user;
      logger.requestLogger(req, res, next);
      
      expect(req.id).toBeDefined();
      expect(winston.createLogger().http).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
    
    test('stream for Morgan integration works correctly', () => {
      expect(logger.stream).toBeDefined();
      expect(logger.stream.write).toBeDefined();
      
      logger.stream.write('HTTP GET /api/test 200\n');
      expect(winston.createLogger().http).toHaveBeenCalled();
    });
  });
});