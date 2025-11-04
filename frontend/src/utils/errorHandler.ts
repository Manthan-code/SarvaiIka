/**
 * Centralized Error Handling Utility
 * Provides consistent error handling across the application
 */

export interface AppError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
  timestamp: string;
  context?: string;
}

export interface ErrorHandlerOptions {
  showNotification?: boolean;
  logToConsole?: boolean;
  reportToService?: boolean;
  fallbackMessage?: string;
  context?: string;
}

/**
 * Standard error types for consistent handling
 */
export enum ErrorType {
  NETWORK = 'NETWORK_ERROR',
  AUTHENTICATION = 'AUTH_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER_ERROR',
  CLIENT = 'CLIENT_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR'
}

/**
 * Maps HTTP status codes to error types
 */
const statusCodeToErrorType = (statusCode: number, responseData?: any): ErrorType => {
  if (statusCode >= 400 && statusCode < 500) {
    switch (statusCode) {
      case 400:
        // Check if it's a validation error based on response data
        if (responseData && (
          responseData.errors || 
          responseData.message?.includes('Validation') ||
          responseData.message?.includes('Invalid') ||
          responseData.message?.includes('validation')
        )) {
          return ErrorType.VALIDATION;
        }
        return ErrorType.CLIENT;
      case 401:
        return ErrorType.AUTHENTICATION;
      case 403:
        return ErrorType.AUTHORIZATION;
      case 404:
        return ErrorType.NOT_FOUND;
      case 422:
        return ErrorType.VALIDATION;
      default:
        return ErrorType.CLIENT;
    }
  }
  if (statusCode >= 500) {
    return ErrorType.SERVER;
  }
  return ErrorType.UNKNOWN;
};

/**
 * Normalizes different error formats into a consistent AppError
 */
export const normalizeError = (error: any, context?: string): AppError => {
  const timestamp = new Date().toISOString();
  
  // Handle null/undefined errors
  if (error == null) {
    return {
      message: 'An unknown error occurred',
      code: ErrorType.UNKNOWN,
      statusCode: 500,
      timestamp,
      context
    };
  }
  
  // Handle axios errors
  if (error.response) {
    const statusCode = error.response.status;
    const responseData = error.response.data;
    const errorType = statusCodeToErrorType(statusCode, responseData);
    
    return {
      message: responseData?.message || responseData?.error || error.message || 'Request failed',
      code: errorType,
      statusCode,
      details: responseData,
      timestamp,
      context
    };
  }
  

  
  // Handle custom AppError
  if (error.code && error.message) {
    return {
      ...error,
      timestamp: error.timestamp || timestamp,
      context: error.context || context
    };
  }
  
  // Handle network errors (including fetch errors and NetworkError)
  if (error instanceof Error && (
    error.name === 'NetworkError' || 
    (error instanceof TypeError && error.message.includes('fetch')) ||
    error.message.includes('Failed to fetch')
  )) {
    return {
      message: error.message,
      code: ErrorType.NETWORK,
      statusCode: 0,
      timestamp,
      context
    };
  }

  // Handle generic Error objects
  if (error instanceof Error) {
    return {
      message: error.message,
      code: ErrorType.UNKNOWN,
      statusCode: 500,
      timestamp,
      context
    };
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      code: ErrorType.UNKNOWN,
      statusCode: 500,
      timestamp,
      context
    };
  }
  
  // Fallback for unknown error types
  return {
    message: 'An unexpected error occurred',
    code: ErrorType.UNKNOWN,
    timestamp,
    context
  };
};

/**
 * Creates a standardized AppError object
 */
export const createAppError = (
  message: string,
  code: ErrorType | string = ErrorType.UNKNOWN,
  statusCode: number = 500,
  details?: any,
  context?: string
): AppError => {
  return {
    message,
    code: code as ErrorType,
    statusCode,
    details,
    timestamp: new Date().toISOString(),
    context
  };
};

/**
 * Gets user-friendly error messages
 */
export const getUserFriendlyMessage = (error: AppError): string => {
  switch (error.code) {
    case ErrorType.NETWORK:
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    case ErrorType.AUTHENTICATION:
      return error.message ? `${error.message}. Please log in again.` : 'Your session has expired. Please sign in again.';
    case ErrorType.AUTHORIZATION:
      return 'You do not have permission to perform this action.';
    case ErrorType.NOT_FOUND:
      return 'The requested resource was not found.';
    case ErrorType.VALIDATION:
      if (error.details && error.details.errors && Array.isArray(error.details.errors)) {
        const errorMessages = error.details.errors.map((err: any) => err.message).join(', ');
        return `${error.message}: ${errorMessages}`;
      }
      return error.message || 'Please check your input and try again.';
    case ErrorType.SERVER:
      return 'Something went wrong on our end. Please try again later.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
};

/**
 * Main error handler function
 */
export const handleError = async (
  error: any,
  options: ErrorHandlerOptions = {}
): Promise<AppError> => {
  const {
    showNotification = true,
    logToConsole = true,
    reportToService = true,
    fallbackMessage,
    context
  } = options;
  
  const normalizedError = normalizeError(error, context);
  
  // Log to console in development
  if (logToConsole && import.meta.env.DEV) {
    if (normalizedError.code === ErrorType.NOT_FOUND) {
      // Use console.warn for 404 errors to avoid triggering error tracking
      console.warn('Error handled (404):', {
        message: normalizedError.message,
        code: normalizedError.code,
        statusCode: normalizedError.statusCode
      });
    } else {
      console.error('Error handled:', {
        message: normalizedError.message,
        code: normalizedError.code,
        statusCode: normalizedError.statusCode
      });
    }
  }
  
  // Show user notification
  if (showNotification) {
    const message = fallbackMessage || getUserFriendlyMessage(normalizedError);
    
    // Import notification service dynamically to avoid circular dependencies
    try {
      const { notificationService } = await import('../services/notificationService');
      
      const notificationType = (normalizedError.code === ErrorType.SERVER || normalizedError.code === ErrorType.NETWORK || normalizedError.code === ErrorType.UNKNOWN) ? 'error' : 'warning';
      
      // Determine title based on error type
      let title = 'Error';
      if (normalizedError.code === ErrorType.SERVER) {
        title = 'Server Error';
      } else if (normalizedError.code === ErrorType.AUTHENTICATION) {
        title = 'Authentication Error';
      } else if (normalizedError.code === ErrorType.VALIDATION) {
        title = 'Validation Error';
      }
      
      notificationService.showNotification({
        type: notificationType,
        title,
        message,
        duration: 5000
      });
    } catch (notificationError) {
      console.warn('Failed to show notification:', notificationError);
    }
  }
  
  // Report to error tracking service
  if (reportToService) {
    try {
      const { errorTrackingService } = await import('../services/errorTrackingService');
      
      // Determine severity based on error type
      let severity = 'medium';
      if (normalizedError.code === ErrorType.SERVER) {
        severity = 'critical';
      } else if (normalizedError.code === ErrorType.NETWORK) {
        severity = 'high';
      } else if (normalizedError.code === ErrorType.VALIDATION) {
        severity = 'low';
      }
      
      errorTrackingService.reportError({
        message: normalizedError.message,
        statusCode: normalizedError.statusCode || 0,
        severity,
        component: context || 'Unknown',
        stackTrace: error.stack || ''
      });
    } catch (trackingError) {
      console.warn('Failed to report error to tracking service:', trackingError);
    }
  }
  
  return normalizedError;
};

/**
 * Wrapper for async operations with error handling
 */
export const withErrorHandling = <T>(
  operation: () => Promise<T>,
  options?: ErrorHandlerOptions
) => {
  return async (): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      await handleError(error, options);
      return null;
    }
  };
};

/**
 * React hook for error handling
 */
export const useErrorHandler = () => {
  return {
    handleError: (error: any, options?: ErrorHandlerOptions) => handleError(error, options),
    withErrorHandling
  };
};