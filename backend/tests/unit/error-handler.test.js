/**
 * Error Handler Test Suite
 * Tests for error handling utilities
 */

const {
  ErrorTypes,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalApiError,
  mapError,
  handleError
} = require('../../src/utils/errorHandler');

const logger = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/logger');

describe('Error Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Custom Error Classes', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Server error', 500, ErrorTypes.SERVER, { detail: 'test' });
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AppError');
      expect(error.message).toBe('Server error');
      expect(error.statusCode).toBe(500);
      expect(error.errorType).toBe(ErrorTypes.SERVER);
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeDefined();
    });

    it('should create ValidationError with correct properties', () => {
      const error = new ValidationError('Invalid input', { field: 'username' });
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.errorType).toBe(ErrorTypes.VALIDATION);
      expect(error.details).toEqual({ field: 'username' });
    });

    it('should create AuthenticationError with correct properties', () => {
      const error = new AuthenticationError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
      expect(error.errorType).toBe(ErrorTypes.AUTHENTICATION);
    });

    it('should create AuthorizationError with correct properties', () => {
      const error = new AuthorizationError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('AuthorizationError');
      expect(error.message).toBe('Insufficient permissions');
      expect(error.statusCode).toBe(403);
      expect(error.errorType).toBe(ErrorTypes.AUTHORIZATION);
    });

    it('should create NotFoundError with correct properties', () => {
      const error = new NotFoundError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('NotFoundError');
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.errorType).toBe(ErrorTypes.NOT_FOUND);
    });

    it('should create ConflictError with correct properties', () => {
      const error = new ConflictError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('ConflictError');
      expect(error.message).toBe('Resource conflict');
      expect(error.statusCode).toBe(409);
      expect(error.errorType).toBe(ErrorTypes.CONFLICT);
    });

    it('should create RateLimitError with correct properties', () => {
      const error = new RateLimitError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('RateLimitError');
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.errorType).toBe(ErrorTypes.RATE_LIMIT);
    });

    it('should create DatabaseError with correct properties', () => {
      const error = new DatabaseError('Database connection failed', { table: 'users' });
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('DatabaseError');
      expect(error.message).toBe('Database connection failed');
      expect(error.statusCode).toBe(500);
      expect(error.errorType).toBe(ErrorTypes.DATABASE);
      expect(error.details).toEqual({ table: 'users' });
    });

    it('should create ExternalApiError with correct properties', () => {
      const error = new ExternalApiError('API timeout', 504, { service: 'payment' });
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('ExternalApiError');
      expect(error.message).toBe('API timeout');
      expect(error.statusCode).toBe(504);
      expect(error.errorType).toBe(ErrorTypes.EXTERNAL_API);
      expect(error.details).toEqual({ service: 'payment' });
    });
  });

  describe('Error Mapping', () => {
    it('should map database constraint errors correctly', () => {
      const pgError = {
        code: '23505',
        detail: 'Key (email)=(test@example.com) already exists'
      };
      
      const mappedError = mapError(pgError);
      
      expect(mappedError).toBeInstanceOf(ConflictError);
      expect(mappedError.message).toContain('already exists');
    });
    
    it('should map database foreign key errors correctly', () => {
      const pgError = {
        code: '23503',
        detail: 'Foreign key violation'
      };
      
      const mappedError = mapError(pgError);
      
      expect(mappedError).toBeInstanceOf(ValidationError);
      expect(mappedError.message).toContain('related record');
    });
    
    it('should return original error if no mapping exists', () => {
      const originalError = new Error('Unknown error');
      
      const mappedError = mapError(originalError);
      
      expect(mappedError).toBe(originalError);
    });
  });
});