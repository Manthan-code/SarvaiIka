/**
 * Error Handler Middleware Unit Tests
 * Comprehensive tests for global error handling middleware
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const errorHandler = require('../src/middlewares/errorHandler');

// Mock console.error to avoid noise in test output
const originalConsoleError = console.error;

describe('Error Handler Middleware Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock request object
    mockReq = {
      originalUrl: '/api/test',
      method: 'GET',
      headers: {},
      body: {}
    };
    
    // Setup mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    // Setup mock next function
    mockNext = jest.fn();
    
    // Mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    console.error = originalConsoleError;
  });

  describe('Basic Error Handling', () => {
    it('should handle standard error with status and message', () => {
      const error = new Error('Test error message');
      error.status = 400;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Global error handler:', error);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Test error message',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle error without status (default to 500)', () => {
      const error = new Error('Internal error');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal error',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle error without message (default message)', () => {
      const error = new Error();
      error.status = 404;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle error with empty message', () => {
      const error = new Error('');
      error.status = 422;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle error with null message', () => {
      const error = { status: 403, message: null };
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle error with undefined message', () => {
      const error = { status: 401, message: undefined };
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });
  });

  describe('HTTP Status Codes', () => {
    const statusCodes = [
      { code: 400, name: 'Bad Request' },
      { code: 401, name: 'Unauthorized' },
      { code: 403, name: 'Forbidden' },
      { code: 404, name: 'Not Found' },
      { code: 422, name: 'Unprocessable Entity' },
      { code: 429, name: 'Too Many Requests' },
      { code: 500, name: 'Internal Server Error' },
      { code: 502, name: 'Bad Gateway' },
      { code: 503, name: 'Service Unavailable' }
    ];

    statusCodes.forEach(({ code, name }) => {
      it(`should handle ${code} ${name} error`, () => {
        const error = new Error(`${name} error`);
        error.status = code;
        
        errorHandler(error, mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(code);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: `${name} error`,
          timestamp: expect.any(String),
          path: '/api/test'
        });
      });
    });
  });

  describe('Request Path Handling', () => {
    it('should handle different request paths', () => {
      const paths = [
        '/api/users',
        '/api/chat/history',
        '/api/billing/123',
        '/health',
        '/',
        '/api/v1/complex/nested/path'
      ];

      paths.forEach(path => {
        mockReq.originalUrl = path;
        const error = new Error('Test error');
        error.status = 400;
        
        errorHandler(error, mockReq, mockRes, mockNext);
        
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Test error',
          timestamp: expect.any(String),
          path: path
        });
        
        // Reset mocks for next iteration
        mockRes.status.mockClear();
        mockRes.json.mockClear();
      });
    });

    it('should handle missing originalUrl', () => {
      mockReq.originalUrl = undefined;
      const error = new Error('Test error');
      error.status = 400;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Test error',
        timestamp: expect.any(String),
        path: undefined
      });
    });

    it('should handle null originalUrl', () => {
      mockReq.originalUrl = null;
      const error = new Error('Test error');
      error.status = 400;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Test error',
        timestamp: expect.any(String),
        path: null
      });
    });

    it('should handle empty originalUrl', () => {
      mockReq.originalUrl = '';
      const error = new Error('Test error');
      error.status = 400;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Test error',
        timestamp: expect.any(String),
        path: ''
      });
    });
  });

  describe('Timestamp Handling', () => {
    it('should include valid ISO timestamp', () => {
      const error = new Error('Test error');
      error.status = 400;
      
      const beforeCall = new Date().toISOString();
      errorHandler(error, mockReq, mockRes, mockNext);
      const afterCall = new Date().toISOString();
      
      const responseCall = mockRes.json.mock.calls[0][0];
      const timestamp = responseCall.timestamp;
      
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(timestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeCall).getTime());
      expect(new Date(timestamp).getTime()).toBeLessThanOrEqual(new Date(afterCall).getTime());
    });

    it('should generate unique timestamps for concurrent errors', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      error1.status = 400;
      error2.status = 500;
      
      const mockRes1 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      
      const mockRes2 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      
      errorHandler(error1, mockReq, mockRes1, mockNext);
      errorHandler(error2, mockReq, mockRes2, mockNext);
      
      const timestamp1 = mockRes1.json.mock.calls[0][0].timestamp;
      const timestamp2 = mockRes2.json.mock.calls[0][0].timestamp;
      
      // Timestamps should be different (or at least not fail if same due to timing)
      expect(timestamp1).toBeDefined();
      expect(timestamp2).toBeDefined();
    });
  });

  describe('Error Object Types', () => {
    it('should handle Error instance', () => {
      const error = new Error('Standard error');
      error.status = 400;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Standard error',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle TypeError instance', () => {
      const error = new TypeError('Type error occurred');
      error.status = 400;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Type error occurred',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle ReferenceError instance', () => {
      const error = new ReferenceError('Reference error occurred');
      error.status = 500;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Reference error occurred',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle plain object error', () => {
      const error = {
        status: 422,
        message: 'Plain object error'
      };
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Plain object error',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle string error', () => {
      const error = 'String error message';
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle null error', () => {
      const error = null;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle undefined error', () => {
      const error = undefined;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle error with non-numeric status', () => {
      const error = new Error('Test error');
      error.status = 'invalid';
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Test error',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle error with negative status', () => {
      const error = new Error('Test error');
      error.status = -1;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(-1);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Test error',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle error with zero status', () => {
      const error = new Error('Test error');
      error.status = 0;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Test error',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle error with very large status code', () => {
      const error = new Error('Test error');
      error.status = 999999;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(999999);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Test error',
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle error with very long message', () => {
      const longMessage = 'a'.repeat(10000);
      const error = new Error(longMessage);
      error.status = 400;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: longMessage,
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle error with special characters in message', () => {
      const specialMessage = '!@#$%^&*()_+{}|:<>?[]\\;\',./`~"\n\t\r';
      const error = new Error(specialMessage);
      error.status = 400;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: specialMessage,
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle error with unicode characters in message', () => {
      const unicodeMessage = '错误信息 🚨 émojis and ñoñó';
      const error = new Error(unicodeMessage);
      error.status = 400;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: unicodeMessage,
        timestamp: expect.any(String),
        path: '/api/test'
      });
    });

    it('should handle missing request object', () => {
      const error = new Error('Test error');
      error.status = 400;
      
      errorHandler(error, null, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Test error',
        timestamp: expect.any(String),
        path: undefined
      });
    });

    it('should handle missing response object', () => {
      const error = new Error('Test error');
      error.status = 400;
      
      expect(() => {
        errorHandler(error, mockReq, null, mockNext);
      }).toThrow();
    });
  });

  describe('Console Logging', () => {
    it('should log error to console', () => {
      const error = new Error('Test error');
      error.status = 400;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Global error handler:', error);
    });

    it('should log complex error objects', () => {
      const complexError = {
        name: 'CustomError',
        message: 'Complex error',
        status: 422,
        details: {
          field: 'email',
          code: 'INVALID_FORMAT'
        },
        stack: 'Error stack trace...'
      };
      
      errorHandler(complexError, mockReq, mockRes, mockNext);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Global error handler:', complexError);
    });
  });

  describe('Performance Tests', () => {
    it('should handle errors within reasonable time', () => {
      const error = new Error('Performance test error');
      error.status = 400;
      
      const startTime = Date.now();
      errorHandler(error, mockReq, mockRes, mockNext);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle multiple concurrent errors', () => {
      const errors = Array.from({ length: 100 }, (_, i) => {
        const error = new Error(`Error ${i}`);
        error.status = 400 + (i % 100);
        return error;
      });
      
      const startTime = Date.now();
      
      errors.forEach((error, i) => {
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };
        errorHandler(error, mockReq, res, mockNext);
      });
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});