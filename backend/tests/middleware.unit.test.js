/**
 * Middleware Unit Tests
 * Comprehensive tests for authentication, rate limiting, and error handling middleware
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('jsonwebtoken');
jest.mock('express-rate-limit');

const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

describe('Middleware Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      body: {},
      query: {},
      params: {},
      user: null,
      ip: '127.0.0.1',
      method: 'GET',
      url: '/api/test'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      locals: {}
    };
    
    next = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('Authentication Middleware', () => {
    const authMiddleware = (req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
        req.user = decoded;
        next();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    };

    it('should authenticate valid token', () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      jwt.verify.mockReturnValue(mockUser);
      req.headers.authorization = 'Bearer valid-token';
      
      authMiddleware(req, res, next);
      
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request without token', () => {
      authMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      req.headers.authorization = 'Bearer invalid-token';
      
      authMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle expired token', () => {
      jwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });
      req.headers.authorization = 'Bearer expired-token';
      
      authMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle malformed authorization header', () => {
      req.headers.authorization = 'InvalidFormat';
      
      authMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive Bearer token', () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      jwt.verify.mockReturnValue(mockUser);
      req.headers.authorization = 'bearer valid-token';
      
      const caseInsensitiveAuthMiddleware = (req, res, next) => {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace(/^bearer\s+/i, '');
        
        if (!token || token === authHeader) {
          return res.status(401).json({ error: 'No token provided' });
        }
        
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
          req.user = decoded;
          next();
        } catch (error) {
          return res.status(401).json({ error: 'Invalid token' });
        }
      };
      
      caseInsensitiveAuthMiddleware(req, res, next);
      
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Rate Limiting Middleware', () => {
    const createRateLimitMiddleware = (options = {}) => {
      const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        max = 100, // limit each IP to 100 requests per windowMs
        message = 'Too many requests'
      } = options;
      
      const requests = new Map();
      
      return (req, res, next) => {
        const key = req.ip;
        const now = Date.now();
        const windowStart = now - windowMs;
        
        if (!requests.has(key)) {
          requests.set(key, []);
        }
        
        const userRequests = requests.get(key);
        const validRequests = userRequests.filter(time => time > windowStart);
        
        if (validRequests.length >= max) {
          return res.status(429).json({ error: message });
        }
        
        validRequests.push(now);
        requests.set(key, validRequests);
        
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', max - validRequests.length);
        res.setHeader('X-RateLimit-Reset', new Date(now + windowMs));
        
        next();
      };
    };

    it('should allow requests within rate limit', () => {
      const rateLimitMiddleware = createRateLimitMiddleware({ max: 5 });
      
      rateLimitMiddleware(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding rate limit', () => {
      const rateLimitMiddleware = createRateLimitMiddleware({ max: 1 });
      
      // First request should pass
      rateLimitMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      
      // Reset mocks for second request
      jest.clearAllMocks();
      
      // Second request should be blocked
      rateLimitMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({ error: 'Too many requests' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should use custom error message', () => {
      const customMessage = 'Rate limit exceeded';
      const rateLimitMiddleware = createRateLimitMiddleware({ 
        max: 1, 
        message: customMessage 
      });
      
      // First request
      rateLimitMiddleware(req, res, next);
      jest.clearAllMocks();
      
      // Second request should be blocked with custom message
      rateLimitMiddleware(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ error: customMessage });
    });

    it('should handle different IPs separately', () => {
      const rateLimitMiddleware = createRateLimitMiddleware({ max: 1 });
      
      // First IP
      req.ip = '127.0.0.1';
      rateLimitMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      
      jest.clearAllMocks();
      
      // Different IP should not be affected
      req.ip = '192.168.1.1';
      rateLimitMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reset rate limit after window expires', (done) => {
      const rateLimitMiddleware = createRateLimitMiddleware({ 
        max: 1, 
        windowMs: 100 // 100ms window
      });
      
      // First request
      rateLimitMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      
      jest.clearAllMocks();
      
      // Second request should be blocked
      rateLimitMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      
      jest.clearAllMocks();
      
      // After window expires, request should be allowed
      setTimeout(() => {
        rateLimitMiddleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        done();
      }, 150);
    });
  });

  describe('Error Handling Middleware', () => {
    const errorHandler = (err, req, res, next) => {
      console.error(err.stack);
      
      // Handle specific error types
      if (err.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation Error',
          details: err.message
        });
      }
      
      if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: err.message
        });
      }
      
      if (err.name === 'NotFoundError') {
        return res.status(404).json({
          error: 'Not Found',
          message: err.message
        });
      }
      
      if (err.status) {
        return res.status(err.status).json({
          error: err.message || 'An error occurred'
        });
      }
      
      // Default error response
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    };

    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      console.error.mockRestore();
    });

    it('should handle validation errors', () => {
      const error = new Error('Invalid input');
      error.name = 'ValidationError';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        details: 'Invalid input'
      });
    });

    it('should handle unauthorized errors', () => {
      const error = new Error('Access denied');
      error.name = 'UnauthorizedError';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Access denied'
      });
    });

    it('should handle not found errors', () => {
      const error = new Error('Resource not found');
      error.name = 'NotFoundError';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Resource not found'
      });
    });

    it('should handle errors with custom status', () => {
      const error = new Error('Custom error');
      error.status = 422;
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Custom error'
      });
    });

    it('should handle generic errors in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Something broke');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Something broke'
      });
    });

    it('should handle generic errors in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Something broke');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Something went wrong'
      });
    });

    it('should log error stack', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      errorHandler(error, req, res, next);
      
      expect(console.error).toHaveBeenCalledWith('Error stack trace');
    });
  });

  describe('CORS Middleware', () => {
    const corsMiddleware = (options = {}) => {
      const {
        origin = '*',
        methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders = ['Content-Type', 'Authorization'],
        credentials = false
      } = options;
      
      return (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
        res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
        
        if (credentials) {
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        
        if (req.method === 'OPTIONS') {
          return res.status(200).end();
        }
        
        next();
      };
    };

    it('should set CORS headers', () => {
      const middleware = corsMiddleware();
      
      middleware(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      expect(next).toHaveBeenCalled();
    });

    it('should handle OPTIONS preflight request', () => {
      const middleware = corsMiddleware();
      req.method = 'OPTIONS';
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should set credentials header when enabled', () => {
      const middleware = corsMiddleware({ credentials: true });
      
      middleware(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    });

    it('should use custom origin', () => {
      const middleware = corsMiddleware({ origin: 'https://example.com' });
      
      middleware(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
    });
  });

  describe('Request Logging Middleware', () => {
    const requestLogger = (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
      });
      
      next();
    };

    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      res.on = jest.fn();
    });

    afterEach(() => {
      console.log.mockRestore();
    });

    it('should set up response logging', () => {
      requestLogger(req, res, next);
      
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(next).toHaveBeenCalled();
    });

    it('should log request details on response finish', () => {
      let finishCallback;
      res.on.mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });
      res.statusCode = 200;
      
      requestLogger(req, res, next);
      
      // Simulate response finish
      finishCallback();
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/GET \/api\/test 200 - \d+ms/)
      );
    });
  });

  describe('Body Parser Middleware', () => {
    const jsonParser = (req, res, next) => {
      if (req.headers['content-type'] === 'application/json') {
        let body = '';
        
        req.on('data', chunk => {
          body += chunk.toString();
        });
        
        req.on('end', () => {
          try {
            req.body = JSON.parse(body);
            next();
          } catch (error) {
            res.status(400).json({ error: 'Invalid JSON' });
          }
        });
      } else {
        next();
      }
    };

    beforeEach(() => {
      req.on = jest.fn();
    });

    it('should parse JSON body', () => {
      req.headers['content-type'] = 'application/json';
      let dataCallback, endCallback;
      
      req.on.mockImplementation((event, callback) => {
        if (event === 'data') dataCallback = callback;
        if (event === 'end') endCallback = callback;
      });
      
      jsonParser(req, res, next);
      
      // Simulate receiving data
      dataCallback('{"test": "value"}');
      endCallback();
      
      expect(req.body).toEqual({ test: 'value' });
      expect(next).toHaveBeenCalled();
    });

    it('should handle invalid JSON', () => {
      req.headers['content-type'] = 'application/json';
      let dataCallback, endCallback;
      
      req.on.mockImplementation((event, callback) => {
        if (event === 'data') dataCallback = callback;
        if (event === 'end') endCallback = callback;
      });
      
      jsonParser(req, res, next);
      
      // Simulate receiving invalid JSON
      dataCallback('invalid json');
      endCallback();
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid JSON' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should skip parsing for non-JSON content', () => {
      req.headers['content-type'] = 'text/plain';
      
      jsonParser(req, res, next);
      
      expect(req.on).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Security Headers Middleware', () => {
    const securityHeaders = (req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('Content-Security-Policy', "default-src 'self'");
      next();
    };

    it('should set security headers', () => {
      securityHeaders(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(res.setHeader).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', "default-src 'self'");
      expect(next).toHaveBeenCalled();
    });
  });
});