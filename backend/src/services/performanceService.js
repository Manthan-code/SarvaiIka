const logger = require('../utils/logger');
const sentryErrorTracker = require('../utils/sentryErrorTracker');
const { getCacheStats } = require('./cacheService');

/**
 * Performance metrics storage
 */
const performanceMetrics = {
  requests: {
    total: 0,
    successful: 0,
    failed: 0,
    averageResponseTime: 0,
    slowRequests: 0 // requests > 1000ms
  },
  database: {
    queries: 0,
    averageQueryTime: 0,
    slowQueries: 0 // queries > 500ms
  },
  memory: {
    heapUsed: 0,
    heapTotal: 0,
    external: 0,
    rss: 0
  },
  cpu: {
    usage: 0
  },
  errors: {
    total: 0,
    byType: {}
  }
};

/**
 * Request timing storage
 */
const requestTimings = [];
const MAX_TIMING_RECORDS = 1000;

/**
 * Database query timing storage
 */
const queryTimings = [];
const MAX_QUERY_RECORDS = 500;

/**
 * Performance monitoring middleware
 */
const performanceMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Track request start
  performanceMetrics.requests.total++;
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    
    // Update metrics
    updateRequestMetrics(responseTime, res.statusCode);
    
    // Log slow requests
    if (responseTime > 1000) {
      logger.warn(`Slow request detected: ${req.method} ${req.path} - ${responseTime}ms`);
      performanceMetrics.requests.slowRequests++;
    }
    
    // Store timing data
    storeRequestTiming({
      method: req.method,
      path: req.path,
      responseTime,
      statusCode: res.statusCode,
      timestamp: new Date()
    });
    
    originalEnd.apply(this, args);
  };
  
  next();
};

/**
 * Update request metrics
 */
const updateRequestMetrics = (responseTime, statusCode) => {
  if (statusCode >= 200 && statusCode < 400) {
    performanceMetrics.requests.successful++;
  } else {
    performanceMetrics.requests.failed++;
  }
  
  // Update average response time
  const totalRequests = performanceMetrics.requests.total;
  const currentAvg = performanceMetrics.requests.averageResponseTime;
  performanceMetrics.requests.averageResponseTime = 
    ((currentAvg * (totalRequests - 1)) + responseTime) / totalRequests;
};

/**
 * Store request timing data
 */
const storeRequestTiming = (timing) => {
  requestTimings.push(timing);
  
  // Keep only recent records
  if (requestTimings.length > MAX_TIMING_RECORDS) {
    requestTimings.shift();
  }
};

/**
 * Database query performance tracker
 */
const trackDatabaseQuery = (queryType, duration) => {
  performanceMetrics.database.queries++;
  
  // Update average query time
  const totalQueries = performanceMetrics.database.queries;
  const currentAvg = performanceMetrics.database.averageQueryTime;
  performanceMetrics.database.averageQueryTime = 
    ((currentAvg * (totalQueries - 1)) + duration) / totalQueries;
  
  // Track slow queries
  if (duration > 500) {
    performanceMetrics.database.slowQueries++;
    logger.warn(`Slow database query detected: ${queryType} - ${duration}ms`);
  }
  
  // Store query timing
  queryTimings.push({
    type: queryType,
    duration,
    timestamp: new Date()
  });
  
  // Keep only recent records
  if (queryTimings.length > MAX_QUERY_RECORDS) {
    queryTimings.shift();
  }
};

/**
 * Update memory metrics
 */
const updateMemoryMetrics = () => {
  const memUsage = process.memoryUsage();
  performanceMetrics.memory = {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    external: Math.round(memUsage.external / 1024 / 1024), // MB
    rss: Math.round(memUsage.rss / 1024 / 1024) // MB
  };
};

/**
 * Update CPU metrics
 */
const updateCpuMetrics = () => {
  const cpuUsage = process.cpuUsage();
  performanceMetrics.cpu.usage = Math.round(
    (cpuUsage.user + cpuUsage.system) / 1000000 // Convert to seconds
  );
};

/**
 * Track error occurrence
 */
const trackError = (error, type = 'unknown') => {
  performanceMetrics.errors.total++;
  
  if (!performanceMetrics.errors.byType[type]) {
    performanceMetrics.errors.byType[type] = 0;
  }
  performanceMetrics.errors.byType[type]++;
  
  // Log error for monitoring
  logger.error(`Error tracked: ${type}`, { error: error.message });
};

/**
 * Get comprehensive performance report
 */
const getPerformanceReport = () => {
  updateMemoryMetrics();
  updateCpuMetrics();
  
  const cacheStats = getCacheStats();
  
  return {
    timestamp: new Date(),
    requests: {
      ...performanceMetrics.requests,
      successRate: performanceMetrics.requests.total > 0 
        ? ((performanceMetrics.requests.successful / performanceMetrics.requests.total) * 100).toFixed(2) + '%'
        : '0%'
    },
    database: performanceMetrics.database,
    cache: cacheStats,
    memory: performanceMetrics.memory,
    cpu: performanceMetrics.cpu,
    errors: performanceMetrics.errors,
    recentSlowRequests: requestTimings
      .filter(t => t.responseTime > 1000)
      .slice(-10), // Last 10 slow requests
    recentSlowQueries: queryTimings
      .filter(q => q.duration > 500)
      .slice(-10) // Last 10 slow queries
  };
};

/**
 * Get performance alerts
 */
const getPerformanceAlerts = () => {
  const alerts = [];
  
  // High error rate
  const errorRate = performanceMetrics.requests.total > 0 
    ? (performanceMetrics.requests.failed / performanceMetrics.requests.total) * 100
    : 0;
  
  if (errorRate > 5) {
    alerts.push({
      type: 'high_error_rate',
      severity: 'warning',
      message: `Error rate is ${errorRate.toFixed(2)}%`,
      threshold: '5%'
    });
  }
  
  // Slow average response time
  if (performanceMetrics.requests.averageResponseTime > 2000) {
    alerts.push({
      type: 'slow_response_time',
      severity: 'warning',
      message: `Average response time is ${performanceMetrics.requests.averageResponseTime.toFixed(0)}ms`,
      threshold: '2000ms'
    });
  }
  
  // High memory usage
  if (performanceMetrics.memory.heapUsed > 500) {
    alerts.push({
      type: 'high_memory_usage',
      severity: 'warning',
      message: `Heap memory usage is ${performanceMetrics.memory.heapUsed}MB`,
      threshold: '500MB'
    });
  }
  
  // Too many slow queries
  const recentSlowQueries = queryTimings
    .filter(q => q.duration > 500 && Date.now() - q.timestamp.getTime() < 300000) // Last 5 minutes
    .length;
  
  if (recentSlowQueries > 10) {
    alerts.push({
      type: 'frequent_slow_queries',
      severity: 'critical',
      message: `${recentSlowQueries} slow database queries in the last 5 minutes`,
      threshold: '10 queries'
    });
  }
  
  return alerts;
};

/**
 * Reset performance metrics
 */
const resetMetrics = () => {
  performanceMetrics.requests = {
    total: 0,
    successful: 0,
    failed: 0,
    averageResponseTime: 0,
    slowRequests: 0
  };
  performanceMetrics.database = {
    queries: 0,
    averageQueryTime: 0,
    slowQueries: 0
  };
  performanceMetrics.errors = {
    total: 0,
    byType: {}
  };
  
  requestTimings.length = 0;
  queryTimings.length = 0;
};

/**
 * Start performance monitoring
 */
const startMonitoring = () => {
  // Update system metrics every 30 seconds
  setInterval(() => {
    updateMemoryMetrics();
    updateCpuMetrics();
    
    // Check for alerts
    const alerts = getPerformanceAlerts();
    if (alerts.length > 0) {
      alerts.forEach(alert => {
        if (alert.severity === 'critical') {
          sentryErrorTracker.captureMessage(
            `Performance Alert: ${alert.message}`,
            'error',
            { tags: { type: alert.type, severity: alert.severity } }
          );
        }
        logger.warn(`Performance Alert: ${alert.message}`);
      });
    }
  }, 30000);
  
  logger.info('Performance monitoring started');
};

module.exports = {
  performanceMiddleware,
  trackDatabaseQuery,
  trackError,
  getPerformanceReport,
  getPerformanceAlerts,
  resetMetrics,
  startMonitoring
};