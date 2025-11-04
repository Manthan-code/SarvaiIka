const supabase = require('./supabase/client');
const supabaseAdmin = require('./supabase/admin');
const { trackDatabaseQuery } = require('../services/performanceService');
const logger = require('../utils/logger');

/**
 * Enhanced Supabase client with performance tracking
 */
class PerformanceWrapper {
  constructor(client, clientType = 'client') {
    this.client = client;
    this.clientType = clientType;
  }

  /**
   * Wrap Supabase query with performance tracking
   */
  from(table) {
    const originalFrom = this.client.from(table);
    
    // Wrap common query methods
    const wrappedMethods = ['select', 'insert', 'update', 'delete', 'upsert'];
    
    wrappedMethods.forEach(method => {
      if (originalFrom[method]) {
        const originalMethod = originalFrom[method].bind(originalFrom);
        originalFrom[method] = (...args) => {
          const result = originalMethod(...args);
          
          // Wrap the final execution methods
          if (result && typeof result === 'object') {
            this.wrapExecutionMethods(result, table, method);
          }
          
          return result;
        };
      }
    });
    
    return originalFrom;
  }

  /**
   * Wrap execution methods that actually perform the query
   */
  wrapExecutionMethods(queryBuilder, table, operation) {
    const executionMethods = ['single', 'maybeSingle', 'then', 'catch'];
    
    executionMethods.forEach(method => {
      if (queryBuilder[method]) {
        const originalMethod = queryBuilder[method].bind(queryBuilder);
        queryBuilder[method] = (...args) => {
          const startTime = Date.now();
          
          const result = originalMethod(...args);
          
          // Handle promise-based execution
          if (result && typeof result.then === 'function') {
            return result
              .then(data => {
                const duration = Date.now() - startTime;
                this.trackQuery(table, operation, duration, true);
                return data;
              })
              .catch(error => {
                const duration = Date.now() - startTime;
                this.trackQuery(table, operation, duration, false, error);
                throw error;
              });
          }
          
          return result;
        };
      }
    });

    // Also wrap the query builder itself if it's thenable
    if (queryBuilder.then && typeof queryBuilder.then === 'function') {
      const originalThen = queryBuilder.then.bind(queryBuilder);
      queryBuilder.then = (onFulfilled, onRejected) => {
        const startTime = Date.now();
        
        return originalThen(
          (data) => {
            const duration = Date.now() - startTime;
            this.trackQuery(table, operation, duration, true);
            return onFulfilled ? onFulfilled(data) : data;
          },
          (error) => {
            const duration = Date.now() - startTime;
            this.trackQuery(table, operation, duration, false, error);
            return onRejected ? onRejected(error) : Promise.reject(error);
          }
        );
      };
    }
  }

  /**
   * Track database query performance
   */
  trackQuery(table, operation, duration, success, error = null) {
    const queryType = `${this.clientType}:${table}:${operation}`;
    
    try {
      trackDatabaseQuery(queryType, duration);
      
      // Log detailed information for slow or failed queries
      if (duration > 500 || !success) {
        const logLevel = !success ? 'error' : 'warn';
        logger[logLevel](`Database query performance`, {
          table,
          operation,
          duration,
          success,
          clientType: this.clientType,
          error: error ? error.message : null
        });
      }
    } catch (trackingError) {
      // Don't let tracking errors affect the main query
      logger.error('Error tracking database query:', trackingError);
    }
  }

  /**
   * Proxy other methods to the original client
   */
  auth = this.client.auth;
  storage = this.client.storage;
  realtime = this.client.realtime;
  functions = this.client.functions;
  
  // Proxy any other methods
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.client;
  }
}

// Create wrapped instances
const wrappedSupabase = new PerformanceWrapper(supabase, 'client');
const wrappedSupabaseAdmin = new PerformanceWrapper(supabaseAdmin, 'admin');

// Export both wrapped and original clients
module.exports = {
  supabase: wrappedSupabase,
  supabaseAdmin: wrappedSupabaseAdmin,
  originalSupabase: supabase,
  originalSupabaseAdmin: supabaseAdmin
};