/**
 * Standardized Backend Error Handler
 * Provides consistent error handling and response formatting
 */

const logger = require('./logger');

/**
 * Standard error types
 */
const ErrorTypes = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTH_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  SERVER: 'SERVER_ERROR',
  DATABASE: 'DATABASE_ERROR',
  EXTERNAL_API: 'EXTERNAL_API_ERROR'
};

/**
 * Custom error classes
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errorType = ErrorTypes.SERVER, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.isOperational = true; // Distinguishes operational errors from programming errors
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, ErrorTypes.VALIDATION, details);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, ErrorTypes.AUTHENTICATION);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, ErrorTypes.AUTHORIZATION);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, ErrorTypes.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, ErrorTypes.CONFLICT);
    this.name = 'ConflictError';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, ErrorTypes.RATE_LIMIT);
    this.name = 'RateLimitError';
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details = null) {
    super(message, 500, ErrorTypes.DATABASE, details);
    this.name = 'DatabaseError';
  }
}

class ExternalApiError extends AppError {
  constructor(message = 'External API error', statusCode = 502, details = null) {
    super(message, statusCode, ErrorTypes.EXTERNAL_API, details);
    this.name = 'ExternalApiError';
  }
}

/**
 * Maps common error patterns to standardized errors
 */
const mapError = (error) => {
  // Debug logging for PGRST116 investigation
  if (error.code === 'PGRST116') {
    console.log('🔍 PGRST116 Error Details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      fullError: error
    });
  }
  
  // Handle Supabase/PostgreSQL errors
  if (error.code) {
    switch (error.code) {
      case '23505': // unique_violation
        return new ConflictError('Resource already exists', { constraint: error.constraint });
      case '23503': // foreign_key_violation
        return new ValidationError('Referenced resource does not exist', { constraint: error.constraint });
      case '23502': // not_null_violation
        return new ValidationError('Required field is missing', { column: error.column });
      case '42P01': // undefined_table
        return new DatabaseError('Database table not found', { table: error.table });
      case '42703': // undefined_column
        return new DatabaseError('Database column not found', { column: error.column });
      case 'PGRST116': // PostgREST single result error - not actually an error for our use case
        // This happens when .single() is called but no rows or multiple rows are returned
        // For settings, this is normal when user has no settings yet
        // We'll create a special error that can be caught and handled gracefully
        const pgrst116Error = new Error('No single result found');
        pgrst116Error.isPGRST116 = true;
        pgrst116Error.originalError = error;
        return pgrst116Error;
      default:
        return new DatabaseError(error.message || 'Database operation failed', { code: error.code });
    }
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token expired');
  }

  // Handle validation errors from libraries like Joi, express-validator
  if (error.name === 'ValidationError' || error.isJoi) {
    return new ValidationError(error.message, error.details);
  }

  // Handle axios/fetch errors
  if (error.response) {
    return new ExternalApiError(
      error.response.data?.message || 'External API error',
      error.response.status,
      error.response.data
    );
  }

  // Handle network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new ExternalApiError('External service unavailable', 503);
  }

  // Return as-is if already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // Default to server error
  return new AppError(error.message || 'Internal server error', 500, ErrorTypes.SERVER);
};

/**
 * Format error response
 */
const formatErrorResponse = (error, req) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const response = {
    success: false,
    error: {
      message: error.message,
      type: error.errorType || ErrorTypes.SERVER,
      timestamp: error.timestamp || new Date().toISOString(),
      path: req.path,
      method: req.method
    }
  };

  // Add request ID if available
  if (req.id) {
    response.error.requestId = req.id;
  }

  // Add details in development or for client errors
  if (isDevelopment || (error.statusCode >= 400 && error.statusCode < 500)) {
    if (error.details) {
      response.error.details = error.details;
    }
  }

  // Add stack trace in development
  if (isDevelopment && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
};

/**
 * Main error handling middleware
 */
const errorHandler = (error, req, res, next) => {
  // Map error to standardized format
  const mappedError = mapError(error);
  
  // Log error
  const logLevel = mappedError.statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel]('Request error:', {
    error: {
      message: mappedError.message,
      type: mappedError.errorType,
      statusCode: mappedError.statusCode,
      stack: mappedError.stack
    },
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    }
  });

  // Format and send response
  const response = formatErrorResponse(mappedError, req);
  res.status(mappedError.statusCode).json(response);
};

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation helper
 */
const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false });
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      throw new ValidationError('Validation failed', details);
    }
    
    req[property] = value; // Use validated/sanitized value
    next();
  };
};

/**
 * Database operation wrapper
 */
const dbOperation = async (operation, context = 'Database operation') => {
  try {
    return await operation();
  } catch (error) {
    logger.error(`${context} failed:`, error);
    throw mapError(error);
  }
};

/**
 * External API call wrapper
 */
const externalApiCall = async (operation, context = 'External API call') => {
  try {
    return await operation();
  } catch (error) {
    logger.error(`${context} failed:`, error);
    throw mapError(error);
  }
};

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalApiError,
  
  // Error types
  ErrorTypes,
  
  // Utilities
  mapError,
  formatErrorResponse,
  errorHandler,
  asyncHandler,
  validateRequest,
  dbOperation,
  externalApiCall
};