/**
 * Security Middleware Unit Tests
 * Tests rate limiting, brute force protection, API abuse prevention, and security measures
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  logSecurity: jest.fn()
}));

jest.mock('../../../src/services/cacheService', () => ({
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
  del: jest.fn(),
  exists: jest.fn()
}));

jest.mock('../../../src/utils/sentryErrorTracker', () => ({
  addBreadcrumb: jest.fn(),
  setTag: jest.fn(),
  captureMessage: jest.fn()
}));

const logger = require('../../../src/utils/logger');
const cacheService = require('../../../src/services/cacheService');
const sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

describe('SecurityMiddleware', () => {
  let req, res, next;
  let securityMiddleware;

  beforeEach(() => {
    req = {
      ip: '127.0.0.1',
      method: 'GET',
      path: '/api/test',
      get: jest.fn(),
      body: {},
      query: {},
      user: null,
      headers: {
        'user-agent': 'test-agent',
        'x-forwarded-for': '127.0.0.1'
      }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };

    next = jest.fn();

    jest.clearAllMocks();
    
    // Clear require cache
    delete require.cache[require.resolve('../../../src/middleware/securityMiddleware')];
    securityMiddleware = require('../../../src/middleware/securityMiddleware');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rate Limiting', () => {
    describe('generalRateLimit', () => {
      it('should allow requests within rate limit', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.generalRateLimit(req, res, next);

        expect(cacheService.incr).toHaveBeenCalledWith('rate_limit:127.0.0.1', 1, 900);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should block requests exceeding rate limit', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(101); // Exceeds limit of 100

        await securityMiddleware.generalRateLimit(req, res, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: {
            message: 'Too many requests. Please try again later.',
            type: 'RATE_LIMIT_ERROR',
            retryAfter: 900
          }
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should log security event for rate limit exceeded', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(101);

        await securityMiddleware.generalRateLimit(req, res, next);

        expect(logger.logSecurity).toHaveBeenCalledWith('Rate limit exceeded', {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          path: '/api/test',
          method: 'GET',
          count: 101
        });
      });

      it('should handle cache errors gracefully', async () => {
        cacheService.get.mockRejectedValue(new Error('Cache error'));

        await securityMiddleware.generalRateLimit(req, res, next);

        expect(logger.error).toHaveBeenCalledWith('Rate limiting error:', expect.any(Error));
        expect(next).toHaveBeenCalled(); // Should continue on cache error
      });

      it('should use different limits for authenticated users', async () => {
        req.user = { id: 'user123' };
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.generalRateLimit(req, res, next);

        expect(cacheService.incr).toHaveBeenCalledWith('rate_limit:user:user123', 1, 900);
        expect(next).toHaveBeenCalled();
      });

      it('should handle X-Forwarded-For header', async () => {
        req.headers['x-forwarded-for'] = '192.168.1.1, 10.0.0.1';
        req.ip = '10.0.0.1';
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.generalRateLimit(req, res, next);

        expect(cacheService.incr).toHaveBeenCalledWith('rate_limit:192.168.1.1', 1, 900);
      });
    });

    describe('strictRateLimit', () => {
      it('should apply stricter limits', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(21); // Exceeds strict limit of 20

        await securityMiddleware.strictRateLimit(req, res, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: {
            message: 'Too many requests. Please try again later.',
            type: 'RATE_LIMIT_ERROR',
            retryAfter: 3600
          }
        });
      });

      it('should use longer timeout for strict rate limit', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.strictRateLimit(req, res, next);

        expect(cacheService.incr).toHaveBeenCalledWith('strict_rate_limit:127.0.0.1', 1, 3600);
      });
    });

    describe('authRateLimit', () => {
      it('should apply auth-specific rate limiting', async () => {
        req.path = '/api/auth/login';
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(6); // Exceeds auth limit of 5

        await securityMiddleware.authRateLimit(req, res, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: {
            message: 'Too many authentication attempts. Please try again later.',
            type: 'RATE_LIMIT_ERROR',
            retryAfter: 900
          }
        });
      });

      it('should track auth attempts per IP', async () => {
        req.path = '/api/auth/login';
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.authRateLimit(req, res, next);

        expect(cacheService.incr).toHaveBeenCalledWith('auth_rate_limit:127.0.0.1', 1, 900);
      });
    });
  });

  describe('Brute Force Protection', () => {
    describe('bruteForceProtection', () => {
      it('should allow requests with no failed attempts', async () => {
        cacheService.get.mockResolvedValue(null);

        await securityMiddleware.bruteForceProtection(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should block requests after multiple failed attempts', async () => {
        cacheService.get.mockResolvedValue(6); // Exceeds limit of 5

        await securityMiddleware.bruteForceProtection(req, res, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: {
            message: 'Too many failed attempts. Account temporarily locked.',
            type: 'BRUTE_FORCE_PROTECTION',
            retryAfter: 1800
          }
        });
      });

      it('should log brute force attempt', async () => {
        cacheService.get.mockResolvedValue(6);

        await securityMiddleware.bruteForceProtection(req, res, next);

        expect(logger.logSecurity).toHaveBeenCalledWith('Brute force protection triggered', {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          path: '/api/test',
          failedAttempts: 6
        });
      });

      it('should track failed attempts per IP', async () => {
        cacheService.get.mockResolvedValue(3);

        await securityMiddleware.bruteForceProtection(req, res, next);

        expect(cacheService.get).toHaveBeenCalledWith('brute_force:127.0.0.1');
        expect(next).toHaveBeenCalled();
      });

      it('should handle cache errors gracefully', async () => {
        cacheService.get.mockRejectedValue(new Error('Cache error'));

        await securityMiddleware.bruteForceProtection(req, res, next);

        expect(logger.error).toHaveBeenCalledWith('Brute force protection error:', expect.any(Error));
        expect(next).toHaveBeenCalled();
      });
    });

    describe('recordFailedAttempt', () => {
      it('should record failed login attempt', async () => {
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.recordFailedAttempt(req);

        expect(cacheService.incr).toHaveBeenCalledWith('brute_force:127.0.0.1', 1, 1800);
        expect(logger.logSecurity).toHaveBeenCalledWith('Failed login attempt recorded', {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          attempts: 1
        });
      });

      it('should increment existing failed attempts', async () => {
        cacheService.incr.mockResolvedValue(3);

        await securityMiddleware.recordFailedAttempt(req);

        expect(cacheService.incr).toHaveBeenCalledWith('brute_force:127.0.0.1', 1, 1800);
        expect(logger.logSecurity).toHaveBeenCalledWith('Failed login attempt recorded', {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          attempts: 3
        });
      });

      it('should handle cache errors', async () => {
        cacheService.incr.mockRejectedValue(new Error('Cache error'));

        await securityMiddleware.recordFailedAttempt(req);

        expect(logger.error).toHaveBeenCalledWith('Error recording failed attempt:', expect.any(Error));
      });
    });

    describe('clearFailedAttempts', () => {
      it('should clear failed attempts on successful login', async () => {
        cacheService.del.mockResolvedValue(true);

        await securityMiddleware.clearFailedAttempts(req);

        expect(cacheService.del).toHaveBeenCalledWith('brute_force:127.0.0.1');
        expect(logger.info).toHaveBeenCalledWith('Cleared failed attempts for IP:', '127.0.0.1');
      });

      it('should handle cache errors when clearing', async () => {
        cacheService.del.mockRejectedValue(new Error('Cache error'));

        await securityMiddleware.clearFailedAttempts(req);

        expect(logger.error).toHaveBeenCalledWith('Error clearing failed attempts:', expect.any(Error));
      });
    });
  });

  describe('API Abuse Prevention', () => {
    describe('apiAbuseProtection', () => {
      it('should allow normal API usage', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.apiAbuseProtection(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should block excessive API usage', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(1001); // Exceeds limit of 1000

        await securityMiddleware.apiAbuseProtection(req, res, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: {
            message: 'API usage limit exceeded. Please contact support.',
            type: 'API_ABUSE_PROTECTION',
            retryAfter: 86400
          }
        });
      });

      it('should log API abuse attempt', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(1001);

        await securityMiddleware.apiAbuseProtection(req, res, next);

        expect(logger.logSecurity).toHaveBeenCalledWith('API abuse detected', {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          path: '/api/test',
          requestCount: 1001
        });
      });

      it('should use daily time window', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.apiAbuseProtection(req, res, next);

        expect(cacheService.incr).toHaveBeenCalledWith('api_abuse:127.0.0.1', 1, 86400);
      });
    });
  });

  describe('Chat Spam Protection', () => {
    describe('chatSpamProtection', () => {
      it('should allow normal chat usage', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.chatSpamProtection(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should block excessive chat requests', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(51); // Exceeds limit of 50

        await securityMiddleware.chatSpamProtection(req, res, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: {
            message: 'Too many chat requests. Please slow down.',
            type: 'CHAT_SPAM_PROTECTION',
            retryAfter: 3600
          }
        });
      });

      it('should log chat spam attempt', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(51);

        await securityMiddleware.chatSpamProtection(req, res, next);

        expect(logger.logSecurity).toHaveBeenCalledWith('Chat spam detected', {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          chatCount: 51
        });
      });

      it('should track chat requests per IP per hour', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.chatSpamProtection(req, res, next);

        expect(cacheService.incr).toHaveBeenCalledWith('chat_spam:127.0.0.1', 1, 3600);
      });
    });
  });

  describe('Upload Protection', () => {
    describe('uploadProtection', () => {
      it('should allow normal upload requests', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.uploadProtection(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should block excessive upload requests', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(11); // Exceeds limit of 10

        await securityMiddleware.uploadProtection(req, res, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: {
            message: 'Too many upload requests. Please try again later.',
            type: 'UPLOAD_PROTECTION',
            retryAfter: 3600
          }
        });
      });

      it('should log upload abuse attempt', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(11);

        await securityMiddleware.uploadProtection(req, res, next);

        expect(logger.logSecurity).toHaveBeenCalledWith('Upload abuse detected', {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          uploadCount: 11
        });
      });

      it('should track uploads per IP per hour', async () => {
        cacheService.get.mockResolvedValue(null);
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.uploadProtection(req, res, next);

        expect(cacheService.incr).toHaveBeenCalledWith('upload_protection:127.0.0.1', 1, 3600);
      });
    });
  });

  describe('Security Headers', () => {
    describe('securityHeaders', () => {
      it('should set all security headers', () => {
        securityMiddleware.securityHeaders(req, res, next);

        expect(res.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
        expect(res.set).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
        expect(res.set).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
        expect(res.set).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
        expect(res.set).toHaveBeenCalledWith('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        expect(next).toHaveBeenCalled();
      });

      it('should set CSP header', () => {
        securityMiddleware.securityHeaders(req, res, next);

        expect(res.set).toHaveBeenCalledWith(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';"
        );
      });

      it('should set HSTS header', () => {
        securityMiddleware.securityHeaders(req, res, next);

        expect(res.set).toHaveBeenCalledWith(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains; preload'
        );
      });
    });
  });

  describe('Suspicious Activity Detection', () => {
    describe('detectSuspiciousActivity', () => {
      it('should detect suspicious user agents', async () => {
        req.headers['user-agent'] = 'sqlmap/1.0';
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.detectSuspiciousActivity(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: {
            message: 'Suspicious activity detected',
            type: 'SUSPICIOUS_ACTIVITY'
          }
        });
      });

      it('should detect SQL injection attempts in query', async () => {
        req.query.search = "'; DROP TABLE users; --";
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.detectSuspiciousActivity(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(logger.logSecurity).toHaveBeenCalledWith('Suspicious activity detected', {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          path: '/api/test',
          reason: 'SQL injection attempt in query parameters'
        });
      });

      it('should detect SQL injection attempts in body', async () => {
        req.body.comment = "'; DROP TABLE users; --";
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.detectSuspiciousActivity(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(logger.logSecurity).toHaveBeenCalledWith('Suspicious activity detected', {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          path: '/api/test',
          reason: 'SQL injection attempt in request body'
        });
      });

      it('should detect XSS attempts', async () => {
        req.body.message = '<script>alert("xss")</script>';
        cacheService.incr.mockResolvedValue(1);

        await securityMiddleware.detectSuspiciousActivity(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(logger.logSecurity).toHaveBeenCalledWith('Suspicious activity detected', {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          path: '/api/test',
          reason: 'XSS attempt in request body'
        });
      });

      it('should allow normal requests', async () => {
        req.query.search = 'normal search term';
        req.body.message = 'Hello world!';

        await securityMiddleware.detectSuspiciousActivity(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should block after multiple suspicious activities', async () => {
        req.headers['user-agent'] = 'sqlmap/1.0';
        cacheService.incr.mockResolvedValue(4); // Exceeds limit of 3

        await securityMiddleware.detectSuspiciousActivity(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(logger.logSecurity).toHaveBeenCalledWith('IP blocked due to repeated suspicious activity', {
          ip: '127.0.0.1',
          suspiciousCount: 4
        });
      });
    });
  });

  describe('Helper Functions', () => {
    describe('getClientIp', () => {
      it('should extract IP from X-Forwarded-For header', () => {
        req.headers['x-forwarded-for'] = '192.168.1.1, 10.0.0.1';
        req.ip = '10.0.0.1';

        const ip = securityMiddleware.getClientIp(req);

        expect(ip).toBe('192.168.1.1');
      });

      it('should use req.ip when no X-Forwarded-For header', () => {
        delete req.headers['x-forwarded-for'];
        req.ip = '127.0.0.1';

        const ip = securityMiddleware.getClientIp(req);

        expect(ip).toBe('127.0.0.1');
      });

      it('should handle malformed X-Forwarded-For header', () => {
        req.headers['x-forwarded-for'] = '';
        req.ip = '127.0.0.1';

        const ip = securityMiddleware.getClientIp(req);

        expect(ip).toBe('127.0.0.1');
      });
    });

    describe('isWhitelisted', () => {
      it('should whitelist localhost', () => {
        expect(securityMiddleware.isWhitelisted('127.0.0.1')).toBe(true);
        expect(securityMiddleware.isWhitelisted('::1')).toBe(true);
        expect(securityMiddleware.isWhitelisted('localhost')).toBe(true);
      });

      it('should not whitelist external IPs', () => {
        expect(securityMiddleware.isWhitelisted('192.168.1.1')).toBe(false);
        expect(securityMiddleware.isWhitelisted('8.8.8.8')).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle cache service failures gracefully', async () => {
      cacheService.get.mockRejectedValue(new Error('Redis connection failed'));

      await securityMiddleware.generalRateLimit(req, res, next);

      expect(logger.error).toHaveBeenCalledWith('Rate limiting error:', expect.any(Error));
      expect(next).toHaveBeenCalled(); // Should continue despite error
    });

    it('should handle missing request properties', async () => {
      delete req.ip;
      delete req.headers;
      cacheService.get.mockResolvedValue(null);
      cacheService.incr.mockResolvedValue(1);

      await securityMiddleware.generalRateLimit(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle Sentry errors gracefully', async () => {
      sentryErrorTracker.addBreadcrumb.mockImplementation(() => {
        throw new Error('Sentry error');
      });
      cacheService.get.mockResolvedValue(null);
      cacheService.incr.mockResolvedValue(1);

      await securityMiddleware.generalRateLimit(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('should work with multiple middleware in sequence', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.incr.mockResolvedValue(1);

      await securityMiddleware.generalRateLimit(req, res, next);
      expect(next).toHaveBeenCalled();

      jest.clearAllMocks();
      await securityMiddleware.bruteForceProtection(req, res, next);
      expect(next).toHaveBeenCalled();

      jest.clearAllMocks();
      await securityMiddleware.detectSuspiciousActivity(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should stop middleware chain when rate limit is exceeded', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.incr.mockResolvedValue(101);

      await securityMiddleware.generalRateLimit(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });
  });
});