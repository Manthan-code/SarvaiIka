const Sentry = require('@sentry/node');
const logger = require('./logger');

/**
 * Sentry error tracking utility
 */
class SentryErrorTracker {
  /**
   * Track an error with Sentry
   * @param {Error} error - The error to track
   * @param {Object} context - Additional context information
   */
  static trackError(error, context = {}) {
    try {
      // Add context to Sentry scope
      Sentry.withScope((scope) => {
        // Add user context if available
        if (context.user) {
          scope.setUser(context.user);
        }

        // Add tags
        if (context.tags) {
          Object.keys(context.tags).forEach(key => {
            scope.setTag(key, context.tags[key]);
          });
        }

        // Add extra context
        if (context.extra) {
          Object.keys(context.extra).forEach(key => {
            scope.setExtra(key, context.extra[key]);
          });
        }

        // Set level if provided
        if (context.level) {
          scope.setLevel(context.level);
        }

        // Capture the error
        Sentry.captureException(error);
      });

      // Also log locally
      logger.error('Error tracked to Sentry:', {
        error: error.message,
        stack: error.stack,
        context
      });
    } catch (sentryError) {
      // If Sentry fails, at least log the original error
      logger.error('Failed to track error with Sentry:', sentryError);
      logger.error('Original error:', error);
    }
  }

  /**
   * Track a performance issue
   * @param {string} operation - The operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} context - Additional context
   */
  static trackPerformance(operation, duration, context = {}) {
    try {
      Sentry.addBreadcrumb({
        message: `Performance: ${operation}`,
        level: 'info',
        data: {
          duration,
          ...context
        }
      });

      // Log performance issues that are too slow
      if (duration > 5000) { // 5 seconds threshold
        logger.warn('Slow operation detected:', {
          operation,
          duration,
          context
        });
      }
    } catch (error) {
      logger.error('Failed to track performance with Sentry:', error);
    }
  }

  /**
   * Add breadcrumb for debugging
   * @param {string} message - Breadcrumb message
   * @param {Object} data - Additional data
   * @param {string} level - Log level (debug, info, warning, error)
   */
  static addBreadcrumb(message, data = {}, level = 'info') {
    try {
      Sentry.addBreadcrumb({
        message,
        level,
        data
      });
    } catch (error) {
      logger.error('Failed to add breadcrumb to Sentry:', error);
    }
  }

  /**
   * Set user context for error tracking
   * @param {Object} user - User information
   */
  static setUser(user) {
    try {
      Sentry.setUser(user);
    } catch (error) {
      logger.error('Failed to set user context in Sentry:', error);
    }
  }

  /**
   * Clear user context
   */
  static clearUser() {
    try {
      Sentry.setUser(null);
    } catch (error) {
      logger.error('Failed to clear user context in Sentry:', error);
    }
  }
}

module.exports = SentryErrorTracker;