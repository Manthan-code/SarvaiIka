/**
 * Validation Middleware Unit Tests
 * Tests input validation, security checks, file upload validation, and security headers
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock dependencies
jest.mock('joi', () => ({
  object: jest.fn().mockReturnThis(),
  string: jest.fn().mockReturnThis(),
  number: jest.fn().mockReturnThis(),
  boolean: jest.fn().mockReturnThis(),
  array: jest.fn().mockReturnThis(),
  required: jest.fn().mockReturnThis(),
  optional: jest.fn().mockReturnThis(),
  min: jest.fn().mockReturnThis(),
  max: jest.fn().mockReturnThis(),
  email: jest.fn().mockReturnThis(),
  validate: jest.fn()
}));

jest.mock('../../../src/utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  logSecurity: jest.fn()
}));

jest.mock('../../../src/utils/sentryErrorTracker', () => ({
  addBreadcrumb: jest.fn(),
  setTag: jest.fn(),
  captureMessage: jest.fn()
}));

const Joi = require('joi');
const logger = require('../../../src/utils/logger');
const sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

describe('ValidationMiddleware', () => {
  let req, res, next;
  let validationMiddleware;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {},
      files: null,
      file: null,
      method: 'POST',
      path: '/api/test',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
        'content-type': 'application/json'
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
    delete require.cache[require.resolve('../../../src/middleware/validationMiddleware')];
    validationMiddleware = require('../../../src/middleware/validationMiddleware');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRequest', () => {
    let mockSchema;

    beforeEach(() => {
      mockSchema = {
        validate: jest.fn()
      };
    });

    it('should pass validation with valid data', () => {
      mockSchema.validate.mockReturnValue({ error: null, value: { name: 'test' } });
      req.body = { name: 'test' };

      const middleware = validationMiddleware.validateRequest(mockSchema);
      middleware(req, res, next);

      expect(mockSchema.validate).toHaveBeenCalledWith({ name: 'test' });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid data', () => {
      const validationError = {
        details: [{ message: 'Name is required', path: ['name'] }]
      };
      mockSchema.validate.mockReturnValue({ error: validationError, value: null });
      req.body = {};

      const middleware = validationMiddleware.validateRequest(mockSchema);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Validation failed',
          type: 'VALIDATION_ERROR',
          details: ['Name is required']
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle multiple validation errors', () => {
      const validationError = {
        details: [
          { message: 'Name is required', path: ['name'] },
          { message: 'Email is invalid', path: ['email'] }
        ]
      };
      mockSchema.validate.mockReturnValue({ error: validationError, value: null });
      req.body = {};

      const middleware = validationMiddleware.validateRequest(mockSchema);
      middleware(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Validation failed',
          type: 'VALIDATION_ERROR',
          details: ['Name is required', 'Email is invalid']
        }
      });
    });

    it('should log validation errors', () => {
      const validationError = {
        details: [{ message: 'Name is required', path: ['name'] }]
      };
      mockSchema.validate.mockReturnValue({ error: validationError, value: null });
      req.body = {};

      const middleware = validationMiddleware.validateRequest(mockSchema);
      middleware(req, res, next);

      expect(logger.warn).toHaveBeenCalledWith('Validation failed:', {
        path: '/api/test',
        errors: ['Name is required'],
        data: {}
      });
    });

    it('should handle schema validation exceptions', () => {
      mockSchema.validate.mockImplementation(() => {
        throw new Error('Schema error');
      });
      req.body = { name: 'test' };

      const middleware = validationMiddleware.validateRequest(mockSchema);
      middleware(req, res, next);

      expect(logger.error).toHaveBeenCalledWith('Validation middleware error:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Internal validation error',
          type: 'INTERNAL_ERROR'
        }
      });
    });

    it('should validate query parameters when specified', () => {
      mockSchema.validate.mockReturnValue({ error: null, value: { page: 1 } });
      req.query = { page: '1' };

      const middleware = validationMiddleware.validateRequest(mockSchema, 'query');
      middleware(req, res, next);

      expect(mockSchema.validate).toHaveBeenCalledWith({ page: '1' });
      expect(next).toHaveBeenCalled();
    });

    it('should validate params when specified', () => {
      mockSchema.validate.mockReturnValue({ error: null, value: { id: '123' } });
      req.params = { id: '123' };

      const middleware = validationMiddleware.validateRequest(mockSchema, 'params');
      middleware(req, res, next);

      expect(mockSchema.validate).toHaveBeenCalledWith({ id: '123' });
      expect(next).toHaveBeenCalled();
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize string inputs', () => {
      req.body = {
        name: '  John Doe  ',
        description: '<script>alert("xss")</script>Hello'
      };

      validationMiddleware.sanitizeInput(req, res, next);

      expect(req.body.name).toBe('John Doe');
      expect(req.body.description).toBe('Hello');
      expect(next).toHaveBeenCalled();
    });

    it('should sanitize query parameters', () => {
      req.query = {
        search: '  test query  ',
        filter: '<img src=x onerror=alert(1)>safe'
      };

      validationMiddleware.sanitizeInput(req, res, next);

      expect(req.query.search).toBe('test query');
      expect(req.query.filter).toBe('safe');
      expect(next).toHaveBeenCalled();
    });

    it('should handle nested objects', () => {
      req.body = {
        user: {
          name: '  John  ',
          profile: {
            bio: '<script>evil</script>Good bio'
          }
        }
      };

      validationMiddleware.sanitizeInput(req, res, next);

      expect(req.body.user.name).toBe('John');
      expect(req.body.user.profile.bio).toBe('Good bio');
      expect(next).toHaveBeenCalled();
    });

    it('should handle arrays', () => {
      req.body = {
        tags: ['  tag1  ', '<script>tag2</script>', '  tag3  ']
      };

      validationMiddleware.sanitizeInput(req, res, next);

      expect(req.body.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(next).toHaveBeenCalled();
    });

    it('should preserve non-string values', () => {
      req.body = {
        count: 42,
        active: true,
        data: null,
        items: [1, 2, 3]
      };

      validationMiddleware.sanitizeInput(req, res, next);

      expect(req.body.count).toBe(42);
      expect(req.body.active).toBe(true);
      expect(req.body.data).toBe(null);
      expect(req.body.items).toEqual([1, 2, 3]);
      expect(next).toHaveBeenCalled();
    });

    it('should handle circular references', () => {
      const obj = { name: '  test  ' };
      obj.self = obj;
      req.body = obj;

      validationMiddleware.sanitizeInput(req, res, next);

      expect(req.body.name).toBe('test');
      expect(next).toHaveBeenCalled();
    });

    it('should handle sanitization errors gracefully', () => {
      // Create an object that will cause an error during sanitization
      req.body = {
        get name() {
          throw new Error('Getter error');
        }
      };

      validationMiddleware.sanitizeInput(req, res, next);

      expect(logger.error).toHaveBeenCalledWith('Sanitization error:', expect.any(Error));
      expect(next).toHaveBeenCalled();
    });
  });

  describe('checkSqlInjection', () => {
    it('should allow safe inputs', () => {
      req.body = { name: 'John Doe', email: 'john@example.com' };
      req.query = { search: 'normal search term' };

      validationMiddleware.checkSqlInjection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should detect SQL injection in body', () => {
      req.body = { comment: "'; DROP TABLE users; --" };

      validationMiddleware.checkSqlInjection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Invalid input detected',
          type: 'SECURITY_ERROR'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should detect SQL injection in query parameters', () => {
      req.query = { filter: "1' OR '1'='1" };

      validationMiddleware.checkSqlInjection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(logger.logSecurity).toHaveBeenCalledWith('SQL injection attempt detected', {
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        path: '/api/test',
        suspiciousInput: "1' OR '1'='1"
      });
    });

    it('should detect various SQL injection patterns', () => {
      const sqlPatterns = [
        "'; DROP TABLE",
        "UNION SELECT",
        "1=1--",
        "' OR 1=1",
        "'; INSERT INTO",
        "'; DELETE FROM",
        "'; UPDATE SET"
      ];

      sqlPatterns.forEach(pattern => {
        jest.clearAllMocks();
        req.body = { input: pattern };

        validationMiddleware.checkSqlInjection(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
      });
    });

    it('should handle nested objects for SQL injection check', () => {
      req.body = {
        user: {
          profile: {
            bio: "'; DROP TABLE users; --"
          }
        }
      };

      validationMiddleware.checkSqlInjection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle arrays for SQL injection check', () => {
      req.body = {
        comments: ["normal comment", "'; DROP TABLE users; --"]
      };

      validationMiddleware.checkSqlInjection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle check errors gracefully', () => {
      // Create an object that will cause an error during checking
      req.body = {
        get malicious() {
          throw new Error('Getter error');
        }
      };

      validationMiddleware.checkSqlInjection(req, res, next);

      expect(logger.error).toHaveBeenCalledWith('SQL injection check error:', expect.any(Error));
      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateFileUpload', () => {
    it('should allow valid single file upload', () => {
      req.file = {
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 1024 // 1MB
      };

      const middleware = validationMiddleware.validateFileUpload({
        allowedTypes: ['application/pdf'],
        maxSize: 5 * 1024 * 1024 // 5MB
      });
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow valid multiple file uploads', () => {
      req.files = [
        {
          originalname: 'image1.jpg',
          mimetype: 'image/jpeg',
          size: 512 * 1024 // 512KB
        },
        {
          originalname: 'image2.png',
          mimetype: 'image/png',
          size: 256 * 1024 // 256KB
        }
      ];

      const middleware = validationMiddleware.validateFileUpload({
        allowedTypes: ['image/jpeg', 'image/png'],
        maxSize: 1024 * 1024, // 1MB
        maxFiles: 5
      });
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject files with invalid MIME types', () => {
      req.file = {
        originalname: 'script.exe',
        mimetype: 'application/x-msdownload',
        size: 1024
      };

      const middleware = validationMiddleware.validateFileUpload({
        allowedTypes: ['image/jpeg', 'image/png']
      });
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Invalid file type. Allowed types: image/jpeg, image/png',
          type: 'FILE_VALIDATION_ERROR'
        }
      });
    });

    it('should reject files exceeding size limit', () => {
      req.file = {
        originalname: 'large-file.pdf',
        mimetype: 'application/pdf',
        size: 10 * 1024 * 1024 // 10MB
      };

      const middleware = validationMiddleware.validateFileUpload({
        allowedTypes: ['application/pdf'],
        maxSize: 5 * 1024 * 1024 // 5MB
      });
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'File size exceeds limit of 5MB',
          type: 'FILE_VALIDATION_ERROR'
        }
      });
    });

    it('should reject too many files', () => {
      req.files = [
        { originalname: 'file1.jpg', mimetype: 'image/jpeg', size: 1024 },
        { originalname: 'file2.jpg', mimetype: 'image/jpeg', size: 1024 },
        { originalname: 'file3.jpg', mimetype: 'image/jpeg', size: 1024 }
      ];

      const middleware = validationMiddleware.validateFileUpload({
        allowedTypes: ['image/jpeg'],
        maxFiles: 2
      });
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Too many files. Maximum allowed: 2',
          type: 'FILE_VALIDATION_ERROR'
        }
      });
    });

    it('should reject files with suspicious extensions', () => {
      req.file = {
        originalname: 'document.pdf.exe',
        mimetype: 'application/pdf',
        size: 1024
      };

      const middleware = validationMiddleware.validateFileUpload({
        allowedTypes: ['application/pdf']
      });
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Suspicious file extension detected',
          type: 'FILE_VALIDATION_ERROR'
        }
      });
    });

    it('should handle missing file gracefully', () => {
      req.file = null;
      req.files = null;

      const middleware = validationMiddleware.validateFileUpload({
        allowedTypes: ['image/jpeg']
      });
      middleware(req, res, next);

      expect(next).toHaveBeenCalled(); // Should continue if no files
    });

    it('should log file validation failures', () => {
      req.file = {
        originalname: 'script.exe',
        mimetype: 'application/x-msdownload',
        size: 1024
      };

      const middleware = validationMiddleware.validateFileUpload({
        allowedTypes: ['image/jpeg']
      });
      middleware(req, res, next);

      expect(logger.logSecurity).toHaveBeenCalledWith('File upload validation failed', {
        ip: '127.0.0.1',
        filename: 'script.exe',
        mimetype: 'application/x-msdownload',
        size: 1024,
        reason: 'Invalid file type'
      });
    });

    it('should handle validation errors gracefully', () => {
      req.file = {
        get originalname() {
          throw new Error('Property error');
        }
      };

      const middleware = validationMiddleware.validateFileUpload({
        allowedTypes: ['image/jpeg']
      });
      middleware(req, res, next);

      expect(logger.error).toHaveBeenCalledWith('File validation error:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('setSecurityHeaders', () => {
    it('should set Content Security Policy header', () => {
      validationMiddleware.setSecurityHeaders(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' https:; connect-src 'self' https: wss:; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
      );
    });

    it('should set HSTS header', () => {
      validationMiddleware.setSecurityHeaders(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    });

    it('should set all security headers', () => {
      validationMiddleware.setSecurityHeaders(req, res, next);

      expect(res.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(res.set).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(res.set).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(res.set).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(res.set).toHaveBeenCalledWith('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
      expect(next).toHaveBeenCalled();
    });

    it('should handle header setting errors gracefully', () => {
      res.set.mockImplementation(() => {
        throw new Error('Header error');
      });

      validationMiddleware.setSecurityHeaders(req, res, next);

      expect(logger.error).toHaveBeenCalledWith('Error setting security headers:', expect.any(Error));
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Common Validation Schemas', () => {
    describe('userRegistrationSchema', () => {
      it('should be properly configured', () => {
        expect(validationMiddleware.schemas.userRegistration).toBeDefined();
        expect(typeof validationMiddleware.schemas.userRegistration.validate).toBe('function');
      });
    });

    describe('userLoginSchema', () => {
      it('should be properly configured', () => {
        expect(validationMiddleware.schemas.userLogin).toBeDefined();
        expect(typeof validationMiddleware.schemas.userLogin.validate).toBe('function');
      });
    });

    describe('chatMessageSchema', () => {
      it('should be properly configured', () => {
        expect(validationMiddleware.schemas.chatMessage).toBeDefined();
        expect(typeof validationMiddleware.schemas.chatMessage.validate).toBe('function');
      });
    });

    describe('updateProfileSchema', () => {
      it('should be properly configured', () => {
        expect(validationMiddleware.schemas.updateProfile).toBeDefined();
        expect(typeof validationMiddleware.schemas.updateProfile.validate).toBe('function');
      });
    });
  });

  describe('Helper Functions', () => {
    describe('containsSqlInjection', () => {
      it('should detect SQL injection patterns', () => {
        const sqlPatterns = [
          "'; DROP TABLE users; --",
          "1' OR '1'='1",
          "UNION SELECT * FROM",
          "'; INSERT INTO",
          "'; DELETE FROM",
          "'; UPDATE SET"
        ];

        sqlPatterns.forEach(pattern => {
          expect(validationMiddleware.containsSqlInjection(pattern)).toBe(true);
        });
      });

      it('should allow safe strings', () => {
        const safeStrings = [
          "John's car",
          "It's a beautiful day",
          "Price: $10.99",
          "Email: user@example.com"
        ];

        safeStrings.forEach(str => {
          expect(validationMiddleware.containsSqlInjection(str)).toBe(false);
        });
      });

      it('should handle non-string inputs', () => {
        expect(validationMiddleware.containsSqlInjection(null)).toBe(false);
        expect(validationMiddleware.containsSqlInjection(undefined)).toBe(false);
        expect(validationMiddleware.containsSqlInjection(123)).toBe(false);
        expect(validationMiddleware.containsSqlInjection({})).toBe(false);
      });
    });

    describe('sanitizeString', () => {
      it('should remove HTML tags', () => {
        const input = '<script>alert("xss")</script>Hello World<img src=x>';
        const result = validationMiddleware.sanitizeString(input);
        expect(result).toBe('Hello World');
      });

      it('should trim whitespace', () => {
        const input = '   Hello World   ';
        const result = validationMiddleware.sanitizeString(input);
        expect(result).toBe('Hello World');
      });

      it('should handle empty strings', () => {
        expect(validationMiddleware.sanitizeString('')).toBe('');
        expect(validationMiddleware.sanitizeString('   ')).toBe('');
      });

      it('should handle non-string inputs', () => {
        expect(validationMiddleware.sanitizeString(null)).toBe('');
        expect(validationMiddleware.sanitizeString(undefined)).toBe('');
        expect(validationMiddleware.sanitizeString(123)).toBe('123');
      });
    });

    describe('isValidFileExtension', () => {
      it('should validate allowed extensions', () => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        
        expect(validationMiddleware.isValidFileExtension('document.pdf', allowedTypes)).toBe(true);
        expect(validationMiddleware.isValidFileExtension('image.jpg', allowedTypes)).toBe(true);
        expect(validationMiddleware.isValidFileExtension('photo.png', allowedTypes)).toBe(true);
      });

      it('should reject disallowed extensions', () => {
        const allowedTypes = ['image/jpeg', 'image/png'];
        
        expect(validationMiddleware.isValidFileExtension('script.exe', allowedTypes)).toBe(false);
        expect(validationMiddleware.isValidFileExtension('document.pdf', allowedTypes)).toBe(false);
      });

      it('should detect suspicious double extensions', () => {
        const allowedTypes = ['application/pdf'];
        
        expect(validationMiddleware.isValidFileExtension('document.pdf.exe', allowedTypes)).toBe(false);
        expect(validationMiddleware.isValidFileExtension('image.jpg.bat', allowedTypes)).toBe(false);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work with multiple validation middleware in sequence', () => {
      req.body = { name: '  John Doe  ', email: 'john@example.com' };
      
      // First sanitize
      validationMiddleware.sanitizeInput(req, res, next);
      expect(req.body.name).toBe('John Doe');
      expect(next).toHaveBeenCalled();

      // Then check SQL injection
      jest.clearAllMocks();
      validationMiddleware.checkSqlInjection(req, res, next);
      expect(next).toHaveBeenCalled();

      // Finally set security headers
      jest.clearAllMocks();
      validationMiddleware.setSecurityHeaders(req, res, next);
      expect(res.set).toHaveBeenCalledTimes(7); // All security headers
      expect(next).toHaveBeenCalled();
    });

    it('should stop middleware chain on validation failure', () => {
      req.body = { comment: "'; DROP TABLE users; --" };

      validationMiddleware.checkSqlInjection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle complex nested validation scenarios', () => {
      req.body = {
        user: {
          name: '  <script>alert("xss")</script>John  ',
          profile: {
            bio: '  Safe bio content  ',
            settings: {
              theme: 'dark'
            }
          }
        },
        tags: ['  tag1  ', '<img src=x>tag2', '  tag3  ']
      };

      validationMiddleware.sanitizeInput(req, res, next);

      expect(req.body.user.name).toBe('John');
      expect(req.body.user.profile.bio).toBe('Safe bio content');
      expect(req.body.user.profile.settings.theme).toBe('dark');
      expect(req.body.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Performance Tests', () => {
    it('should handle large objects efficiently', () => {
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`field${i}`] = `  value${i}  `;
      }
      req.body = largeObject;

      const startTime = Date.now();
      validationMiddleware.sanitizeInput(req, res, next);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(next).toHaveBeenCalled();
    });

    it('should handle deep nesting efficiently', () => {
      let deepObject = {};
      let current = deepObject;
      for (let i = 0; i < 50; i++) {
        current.nested = { value: `  level${i}  ` };
        current = current.nested;
      }
      req.body = deepObject;

      const startTime = Date.now();
      validationMiddleware.sanitizeInput(req, res, next);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
      expect(next).toHaveBeenCalled();
    });
  });
});