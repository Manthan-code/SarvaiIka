/**
 * Error Handler Unit Tests
 * Tests error mapping, formatting, and middleware functionality
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock logger before importing errorHandler
jest.mock('../../../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const logger = require('../../../src/utils/logger');
const {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalApiError,
  ErrorTypes,
  mapError,
  formatErrorResponse,
  errorHandler,
  asyncHandler,
  validateRequest,
  dbOperation,
  externalApiCall
} = require('../../../src/utils/errorHandler');

describe('ErrorHandler', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      path: '/api/test',
      query: {},
      body: {},
      user: { id: 'test-user' },
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
      id: 'test-request-id'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Classes', () => {
    describe('AppError', () => {
      it('should create AppError with default values', () => {
        const error = new AppError('Test error');

        expect(error.name).toBe('AppError');
        expect(error.message).toBe('Test error');
        expect(error.statusCode).toBe(500);
        expect(error.errorType).toBe(ErrorTypes.SERVER);
        expect(error.details).toBeNull();
        expect(error.isOperational).toBe(true);
        expect(error.timestamp).toBeDefined();
      });

      it('should create AppError with custom values', () => {
        const details = { field: 'email', value: 'invalid' };
        const error = new AppError('Custom error', 400, ErrorTypes.VALIDATION, details);

        expect(error.message).toBe('Custom error');
        expect(error.statusCode).toBe(400);
        expect(error.errorType).toBe(ErrorTypes.VALIDATION);
        expect(error.details).toEqual(details);
      });
    });

    describe('ValidationError', () => {
      it('should create ValidationError with correct properties', () => {
        const details = [{ field: 'email', message: 'Invalid email' }];
        const error = new ValidationError('Validation failed', details);

        expect(error.name).toBe('ValidationError');
        expect(error.message).toBe('Validation failed');
        expect(error.statusCode).toBe(400);
        expect(error.errorType).toBe(ErrorTypes.VALIDATION);
        expect(error.details).toEqual(details);
      });
    });

    describe('AuthenticationError', () => {
      it('should create AuthenticationError with default message', () => {
        const error = new AuthenticationError();

        expect(error.name).toBe('AuthenticationError');
        expect(error.message).toBe('Authentication required');
        expect(error.statusCode).toBe(401);
        expect(error.errorType).toBe(ErrorTypes.AUTHENTICATION);
      });

      it('should create AuthenticationError with custom message', () => {
        const error = new AuthenticationError('Invalid credentials');

        expect(error.message).toBe('Invalid credentials');
      });
    });

    describe('AuthorizationError', () => {
      it('should create AuthorizationError with default message', () => {
        const error = new AuthorizationError();

        expect(error.name).toBe('AuthorizationError');
        expect(error.message).toBe('Insufficient permissions');
        expect(error.statusCode).toBe(403);
        expect(error.errorType).toBe(ErrorTypes.AUTHORIZATION);
      });
    });

    describe('NotFoundError', () => {
      it('should create NotFoundError with default message', () => {
        const error = new NotFoundError();

        expect(error.name).toBe('NotFoundError');
        expect(error.message).toBe('Resource not found');
        expect(error.statusCode).toBe(404);
        expect(error.errorType).toBe(ErrorTypes.NOT_FOUND);
      });
    });

    describe('ConflictError', () => {
      it('should create ConflictError with default message', () => {
        const error = new ConflictError();

        expect(error.name).toBe('ConflictError');
        expect(error.message).toBe('Resource conflict');
        expect(error.statusCode).toBe(409);
        expect(error.errorType).toBe(ErrorTypes.CONFLICT);
      });
    });

    describe('RateLimitError', () => {
      it('should create RateLimitError with default message', () => {
        const error = new RateLimitError();

        expect(error.name).toBe('RateLimitError');
        expect(error.message).toBe('Rate limit exceeded');
        expect(error.statusCode).toBe(429);
        expect(error.errorType).toBe(ErrorTypes.RATE_LIMIT);
      });
    });

    describe('DatabaseError', () => {
      it('should create DatabaseError with default message', () => {
        const error = new DatabaseError();

        expect(error.name).toBe('DatabaseError');
        expect(error.message).toBe('Database operation failed');
        expect(error.statusCode).toBe(500);
        expect(error.errorType).toBe(ErrorTypes.DATABASE);
      });

      it('should create DatabaseError with details', () => {
        const details = { table: 'users', operation: 'insert' };
        const error = new DatabaseError('Insert failed', details);

        expect(error.message).toBe('Insert failed');
        expect(error.details).toEqual(details);
      });
    });

    describe('ExternalApiError', () => {
      it('should create ExternalApiError with default values', () => {
        const error = new ExternalApiError();

        expect(error.name).toBe('ExternalApiError');
        expect(error.message).toBe('External API error');
        expect(error.statusCode).toBe(502);
        expect(error.errorType).toBe(ErrorTypes.EXTERNAL_API);
      });

      it('should create ExternalApiError with custom status code', () => {
        const error = new ExternalApiError('API timeout', 504);

        expect(error.message).toBe('API timeout');
        expect(error.statusCode).toBe(504);
      });
    });
  });

  describe('Error Mapping', () => {
    it('should map PostgreSQL unique violation error', () => {
      const pgError = {
        code: '23505',
        constraint: 'users_email_unique'
      };

      const mappedError = mapError(pgError);

      expect(mappedError).toBeInstanceOf(ConflictError);
      expect(mappedError.message).toBe('Resource already exists');
      expect(mappedError.details).toEqual({ constraint: 'users_email_unique' });
    });

    it('should map PostgreSQL foreign key violation error', () => {
      const pgError = {
        code: '23503',
        constraint: 'fk_user_id'
      };

      const mappedError = mapError(pgError);

      expect(mappedError).toBeInstanceOf(ValidationError);
      expect(mappedError.message).toBe('Referenced resource does not exist');
      expect(mappedError.details).toEqual({ constraint: 'fk_user_id' });
    });

    it('should map PostgreSQL not null violation error', () => {
      const pgError = {
        code: '23502',
        column: 'email'
      };

      const mappedError = mapError(pgError);

      expect(mappedError).toBeInstanceOf(ValidationError);
      expect(mappedError.message).toBe('Required field is missing');
      expect(mappedError.details).toEqual({ column: 'email' });
    });

    it('should map PGRST116 error specially', () => {
      const pgrstError = {
        code: 'PGRST116',
        message: 'No single result found'
      };

      const mappedError = mapError(pgrstError);

      expect(mappedError.message).toBe('No single result found');
      expect(mappedError.isPGRST116).toBe(true);
      expect(mappedError.originalError).toEqual(pgrstError);
    });

    it('should map JWT errors', () => {
      const jwtError = {
        name: 'JsonWebTokenError',
        message: 'invalid token'
      };

      const mappedError = mapError(jwtError);

      expect(mappedError).toBeInstanceOf(AuthenticationError);
      expect(mappedError.message).toBe('Invalid token');
    });

    it('should map JWT expired errors', () => {
      const jwtError = {
        name: 'TokenExpiredError',
        message: 'jwt expired'
      };

      const mappedError = mapError(jwtError);

      expect(mappedError).toBeInstanceOf(AuthenticationError);
      expect(mappedError.message).toBe('Token expired');
    });

    it('should map Joi validation errors', () => {
      const joiError = {
        name: 'ValidationError',
        isJoi: true,
        message: 'Validation failed',
        details: [{ path: ['email'], message: 'Invalid email' }]
      };

      const mappedError = mapError(joiError);

      expect(mappedError).toBeInstanceOf(ValidationError);
      expect(mappedError.message).toBe('Validation failed');
      expect(mappedError.details).toEqual(joiError.details);
    });

    it('should map axios response errors', () => {
      const axiosError = {
        response: {
          status: 404,
          data: { message: 'Not found' }
        }
      };

      const mappedError = mapError(axiosError);

      expect(mappedError).toBeInstanceOf(ExternalApiError);
      expect(mappedError.message).toBe('Not found');
      expect(mappedError.statusCode).toBe(404);
      expect(mappedError.details).toEqual({ message: 'Not found' });
    });

    it('should map network errors', () => {
      const networkError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      };

      const mappedError = mapError(networkError);

      expect(mappedError).toBeInstanceOf(ExternalApiError);
      expect(mappedError.message).toBe('External service unavailable');
      expect(mappedError.statusCode).toBe(503);
    });

    it('should return AppError as-is', () => {
      const appError = new ValidationError('Test error');
      const mappedError = mapError(appError);

      expect(mappedError).toBe(appError);
    });

    it('should map unknown errors to AppError', () => {
      const unknownError = new Error('Unknown error');
      const mappedError = mapError(unknownError);

      expect(mappedError).toBeInstanceOf(AppError);
      expect(mappedError.message).toBe('Unknown error');
      expect(mappedError.statusCode).toBe(500);
      expect(mappedError.errorType).toBe(ErrorTypes.SERVER);
    });
  });

  describe('Error Response Formatting', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should format error response in development', () => {
      const error = new ValidationError('Test validation error', { field: 'email' });
      error.stack = 'Error stack trace';

      const response = formatErrorResponse(error, req);

      expect(response).toEqual({
        success: false,
        error: {
          message: 'Test validation error',
          type: ErrorTypes.VALIDATION,
          timestamp: error.timestamp,
          path: '/api/test',
          method: 'GET',
          requestId: 'test-request-id',
          details: { field: 'email' },
          stack: 'Error stack trace'
        }
      });
    });

    it('should format error response in production', () => {
      process.env.NODE_ENV = 'production';
      
      const error = new AppError('Server error', 500);
      error.stack = 'Error stack trace';

      const response = formatErrorResponse(error, req);

      expect(response).toEqual({
        success: false,
        error: {
          message: 'Server error',
          type: ErrorTypes.SERVER,
          timestamp: error.timestamp,
          path: '/api/test',
          method: 'GET',
          requestId: 'test-request-id'
        }
      });

      // Should not include stack trace in production
      expect(response.error.stack).toBeUndefined();
    });

    it('should include details for client errors in production', () => {
      process.env.NODE_ENV = 'production';
      
      const error = new ValidationError('Validation failed', { field: 'email' });

      const response = formatErrorResponse(error, req);

      expect(response.error.details).toEqual({ field: 'email' });
    });

    it('should handle request without ID', () => {
      delete req.id;
      
      const error = new AppError('Test error');
      const response = formatErrorResponse(error, req);

      expect(response.error.requestId).toBeUndefined();
    });
  });

  describe('Error Handler Middleware', () => {
    it('should handle AppError correctly', () => {
      const error = new ValidationError('Validation failed');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Validation failed',
            type: ErrorTypes.VALIDATION
          })
        })
      );
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle unknown errors', () => {
      const error = new Error('Unknown error');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Unknown error',
            type: ErrorTypes.SERVER
          })
        })
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('should log client errors as warnings', () => {
      const error = new NotFoundError('Resource not found');

      errorHandler(error, req, res, next);

      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should log server errors as errors', () => {
      const error = new AppError('Server error', 500);

      errorHandler(error, req, res, next);

      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Async Handler', () => {
    it('should handle successful async operations', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(req, res, next);

      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should catch and forward async errors', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(req, res, next);

      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle sync errors in async handler', async () => {
      const error = new Error('Sync error');
      const asyncFn = jest.fn().mockImplementation(() => {
        throw error;
      });
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('Validation Request Helper', () => {
    const Joi = require('joi');
    
    it('should validate request body successfully', () => {
      const schema = Joi.object({
        email: Joi.string().email().required(),
        name: Joi.string().required()
      });

      req.body = { email: 'test@example.com', name: 'Test User' };

      const middleware = validateRequest(schema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ email: 'test@example.com', name: 'Test User' });
    });

    it('should throw validation error for invalid data', () => {
      const schema = Joi.object({
        email: Joi.string().email().required()
      });

      req.body = { email: 'invalid-email' };

      const middleware = validateRequest(schema);

      expect(() => middleware(req, res, next)).toThrow(ValidationError);
    });

    it('should validate query parameters', () => {
      const schema = Joi.object({
        page: Joi.number().min(1).required()
      });

      req.query = { page: '2' };

      const middleware = validateRequest(schema, 'query');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should sanitize validated data', () => {
      const schema = Joi.object({
        email: Joi.string().email().lowercase().required(),
        name: Joi.string().trim().required()
      });

      req.body = { email: 'TEST@EXAMPLE.COM', name: '  Test User  ' };

      const middleware = validateRequest(schema);
      middleware(req, res, next);

      expect(req.body.email).toBe('test@example.com');
      expect(req.body.name).toBe('Test User');
    });
  });

  describe('Database Operation Wrapper', () => {
    it('should execute database operation successfully', async () => {
      const operation = jest.fn().mockResolvedValue({ id: 1, name: 'Test' });

      const result = await dbOperation(operation, 'Test operation');

      expect(operation).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('should catch and map database errors', async () => {
      const dbError = { code: '23505', constraint: 'unique_email' };
      const operation = jest.fn().mockRejectedValue(dbError);

      await expect(dbOperation(operation, 'Test operation')).rejects.toBeInstanceOf(ConflictError);
      expect(logger.error).toHaveBeenCalledWith('Test operation failed:', dbError);
    });
  });

  describe('External API Call Wrapper', () => {
    it('should execute external API call successfully', async () => {
      const apiCall = jest.fn().mockResolvedValue({ data: 'success' });

      const result = await externalApiCall(apiCall, 'API call');

      expect(apiCall).toHaveBeenCalled();
      expect(result).toEqual({ data: 'success' });
    });

    it('should catch and map external API errors', async () => {
      const apiError = {
        response: { status: 404, data: { message: 'Not found' } }
      };
      const apiCall = jest.fn().mockRejectedValue(apiError);

      await expect(externalApiCall(apiCall, 'API call')).rejects.toBeInstanceOf(ExternalApiError);
      expect(logger.error).toHaveBeenCalledWith('API call failed:', apiError);
    });
  });

  describe('Error Types Constants', () => {
    it('should have all required error types', () => {
      expect(ErrorTypes.VALIDATION).toBe('VALIDATION_ERROR');
      expect(ErrorTypes.AUTHENTICATION).toBe('AUTH_ERROR');
      expect(ErrorTypes.AUTHORIZATION).toBe('AUTHORIZATION_ERROR');
      expect(ErrorTypes.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorTypes.CONFLICT).toBe('CONFLICT_ERROR');
      expect(ErrorTypes.RATE_LIMIT).toBe('RATE_LIMIT_ERROR');
      expect(ErrorTypes.SERVER).toBe('SERVER_ERROR');
      expect(ErrorTypes.DATABASE).toBe('DATABASE_ERROR');
      expect(ErrorTypes.EXTERNAL_API).toBe('EXTERNAL_API_ERROR');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null error', () => {
      const mappedError = mapError(null);
      
      expect(mappedError).toBeInstanceOf(AppError);
      expect(mappedError.message).toBe('Internal server error');
    });

    it('should handle undefined error', () => {
      const mappedError = mapError(undefined);
      
      expect(mappedError).toBeInstanceOf(AppError);
      expect(mappedError.message).toBe('Internal server error');
    });

    it('should handle error without message', () => {
      const error = {};
      const mappedError = mapError(error);
      
      expect(mappedError).toBeInstanceOf(AppError);
      expect(mappedError.message).toBe('Internal server error');
    });

    it('should handle circular reference in error details', () => {
      const error = new ValidationError('Test error');
      error.details = {};
      error.details.self = error.details; // Circular reference

      expect(() => formatErrorResponse(error, req)).not.toThrow();
    });
  });
});