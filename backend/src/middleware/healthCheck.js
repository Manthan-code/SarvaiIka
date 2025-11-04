/**
 * Health Check Middleware
 * Provides comprehensive health monitoring for the application
 */

const logger = require('../utils/logger');
const { Pool } = require('pg');
const redis = require('redis');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const process = require('process');

// Health check configuration
const HEALTH_CHECK_CONFIG = {
  timeout: 5000, // 5 seconds timeout for each check
  retries: 3,
  interval: 30000, // 30 seconds between checks
  thresholds: {
    memory: 0.9, // 90% memory usage threshold
    cpu: 0.8, // 80% CPU usage threshold
    disk: 0.9, // 90% disk usage threshold
    responseTime: 1000 // 1 second response time threshold
  }
};

// Health status cache
let healthStatus = {
  status: 'unknown',
  timestamp: new Date().toISOString(),
  checks: {},
  metrics: {},
  uptime: 0,
  version: process.env.APP_VERSION || '1.0.0'
};

// Performance metrics
let performanceMetrics = {
  requestCount: 0,
  errorCount: 0,
  totalResponseTime: 0,
  averageResponseTime: 0,
  lastReset: new Date()
};

/**
 * Database health check
 */
const checkDatabase = async () => {
  const start = Date.now();
  try {
    // Check if database config exists
    let dbConfig;
    try {
      dbConfig = require('../config/database');
    } catch (error) {
      // Fallback to environment variables
      dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'ai_agent_platform',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password'
      };
    }

    const pool = new Pool({
      ...dbConfig,
      connectionTimeoutMillis: HEALTH_CHECK_CONFIG.timeout,
      max: 1 // Only one connection for health check
    });

    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    await pool.end();

    const duration = Date.now() - start;
    return {
      status: 'healthy',
      responseTime: duration,
      details: {
        connected: true,
        serverTime: result.rows[0].current_time
      }
    };
  } catch (error) {
    const duration = Date.now() - start;
    logger.logError(error, { component: 'health-check', check: 'database' });
    return {
      status: 'unhealthy',
      responseTime: duration,
      error: error.message,
      details: {
        connected: false
      }
    };
  }
};

/**
 * Redis health check
 */
const checkRedis = async () => {
  const start = Date.now();
  try {
    const client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: HEALTH_CHECK_CONFIG.timeout
      }
    });

    await client.connect();
    await client.ping();
    const info = await client.info('server');
    await client.quit();

    const duration = Date.now() - start;
    return {
      status: 'healthy',
      responseTime: duration,
      details: {
        connected: true,
        version: info.split('\n').find(line => line.startsWith('redis_version:'))?.split(':')[1]?.trim()
      }
    };
  } catch (error) {
    const duration = Date.now() - start;
    logger.logError(error, { component: 'health-check', check: 'redis' });
    return {
      status: 'unhealthy',
      responseTime: duration,
      error: error.message,
      details: {
        connected: false
      }
    };
  }
};

/**
 * Qdrant health check
 */
const checkQdrant = async () => {
  const start = Date.now();
  try {
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const response = await fetch(`${qdrantUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(HEALTH_CHECK_CONFIG.timeout)
    });

    if (!response.ok) {
      throw new Error(`Qdrant health check failed: ${response.status}`);
    }

    const data = await response.json();
    const duration = Date.now() - start;

    return {
      status: 'healthy',
      responseTime: duration,
      details: {
        connected: true,
        status: data.status || 'ok'
      }
    };
  } catch (error) {
    const duration = Date.now() - start;
    logger.logError(error, { component: 'health-check', check: 'qdrant' });
    return {
      status: 'unhealthy',
      responseTime: duration,
      error: error.message,
      details: {
        connected: false
      }
    };
  }
};

/**
 * File system health check
 */
const checkFileSystem = async () => {
  const start = Date.now();
  try {
    const testFile = path.join(os.tmpdir(), `health-check-${Date.now()}.tmp`);
    const testData = 'health-check-test';

    // Write test
    await fs.writeFile(testFile, testData);
    
    // Read test
    const readData = await fs.readFile(testFile, 'utf8');
    
    // Cleanup
    await fs.unlink(testFile);

    if (readData !== testData) {
      throw new Error('File system read/write test failed');
    }

    const duration = Date.now() - start;
    return {
      status: 'healthy',
      responseTime: duration,
      details: {
        writable: true,
        readable: true
      }
    };
  } catch (error) {
    const duration = Date.now() - start;
    logger.logError(error, { component: 'health-check', check: 'filesystem' });
    return {
      status: 'unhealthy',
      responseTime: duration,
      error: error.message,
      details: {
        writable: false,
        readable: false
      }
    };
  }
};

/**
 * System metrics collection
 */
const collectSystemMetrics = () => {
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    memory: {
      used: usedMem,
      total: totalMem,
      percentage: (usedMem / totalMem) * 100,
      process: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      }
    },
    cpu: {
      loadAverage: os.loadavg(),
      cores: os.cpus().length
    },
    uptime: {
      system: os.uptime(),
      process: process.uptime()
    },
    network: {
      interfaces: Object.keys(os.networkInterfaces()).length
    }
  };
};

/**
 * Performance metrics collection
 */
const collectPerformanceMetrics = () => {
  const now = new Date();
  const timeSinceReset = (now - performanceMetrics.lastReset) / 1000; // seconds
  
  return {
    requests: {
      total: performanceMetrics.requestCount,
      errors: performanceMetrics.errorCount,
      successRate: performanceMetrics.requestCount > 0 
        ? ((performanceMetrics.requestCount - performanceMetrics.errorCount) / performanceMetrics.requestCount) * 100 
        : 100,
      rps: timeSinceReset > 0 ? performanceMetrics.requestCount / timeSinceReset : 0
    },
    responseTime: {
      average: performanceMetrics.averageResponseTime,
      total: performanceMetrics.totalResponseTime
    },
    period: {
      start: performanceMetrics.lastReset,
      duration: timeSinceReset
    }
  };
};

/**
 * Run all health checks
 */
const runHealthChecks = async () => {
  const checks = {};
  const startTime = Date.now();

  try {
    // Run all checks in parallel
    const [database, redis, qdrant, filesystem] = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkQdrant(),
      checkFileSystem()
    ]);

    checks.database = database.status === 'fulfilled' ? database.value : {
      status: 'unhealthy',
      error: database.reason?.message || 'Check failed',
      responseTime: 0
    };

    checks.redis = redis.status === 'fulfilled' ? redis.value : {
      status: 'unhealthy',
      error: redis.reason?.message || 'Check failed',
      responseTime: 0
    };

    checks.qdrant = qdrant.status === 'fulfilled' ? qdrant.value : {
      status: 'unhealthy',
      error: qdrant.reason?.message || 'Check failed',
      responseTime: 0
    };

    checks.filesystem = filesystem.status === 'fulfilled' ? filesystem.value : {
      status: 'unhealthy',
      error: filesystem.reason?.message || 'Check failed',
      responseTime: 0
    };

    // Determine overall status
    const allHealthy = Object.values(checks).every(check => check.status === 'healthy');
    const overallStatus = allHealthy ? 'healthy' : 'unhealthy';

    // Collect metrics
    const systemMetrics = collectSystemMetrics();
    const performanceMetricsData = collectPerformanceMetrics();

    // Update health status
    healthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      metrics: {
        system: systemMetrics,
        performance: performanceMetricsData
      },
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      responseTime: Date.now() - startTime
    };

    // Log health status
    logger.logPerformance('health-check', Date.now() - startTime, {
      status: overallStatus,
      checks: Object.keys(checks).reduce((acc, key) => {
        acc[key] = checks[key].status;
        return acc;
      }, {})
    });

    return healthStatus;
  } catch (error) {
    logger.logError(error, { component: 'health-check', operation: 'run-checks' });
    
    healthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {},
      metrics: {},
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      error: error.message,
      responseTime: Date.now() - startTime
    };

    return healthStatus;
  }
};

/**
 * Middleware to track request metrics
 */
const trackRequestMetrics = (req, res, next) => {
  const start = Date.now();
  
  performanceMetrics.requestCount++;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    performanceMetrics.totalResponseTime += duration;
    performanceMetrics.averageResponseTime = performanceMetrics.totalResponseTime / performanceMetrics.requestCount;
    
    if (res.statusCode >= 400) {
      performanceMetrics.errorCount++;
    }
  });
  
  next();
};

/**
 * Reset performance metrics
 */
const resetMetrics = () => {
  performanceMetrics = {
    requestCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    averageResponseTime: 0,
    lastReset: new Date()
  };
};

/**
 * Health check endpoint handler
 */
const healthCheckHandler = async (req, res) => {
  try {
    const health = await runHealthChecks();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    logger.logError(error, { component: 'health-check', endpoint: '/health' });
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0'
    });
  }
};

/**
 * Readiness check endpoint handler
 */
const readinessCheckHandler = async (req, res) => {
  try {
    // Check only critical services for readiness
    const [database, redis] = await Promise.allSettled([
      checkDatabase(),
      checkRedis()
    ]);

    const dbHealthy = database.status === 'fulfilled' && database.value.status === 'healthy';
    const redisHealthy = redis.status === 'fulfilled' && redis.value.status === 'healthy';
    
    const ready = dbHealthy && redisHealthy;
    const statusCode = ready ? 200 : 503;
    
    res.status(statusCode).json({
      status: ready ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? 'ready' : 'not ready',
        redis: redisHealthy ? 'ready' : 'not ready'
      }
    });
  } catch (error) {
    logger.logError(error, { component: 'health-check', endpoint: '/ready' });
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed'
    });
  }
};

/**
 * Liveness check endpoint handler
 */
const livenessCheckHandler = (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '1.0.0'
  });
};

/**
 * Metrics endpoint handler
 */
const metricsHandler = (req, res) => {
  const systemMetrics = collectSystemMetrics();
  const performanceMetricsData = collectPerformanceMetrics();
  
  res.json({
    timestamp: new Date().toISOString(),
    system: systemMetrics,
    performance: performanceMetricsData,
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '1.0.0'
  });
};

// Start periodic health checks
let healthCheckInterval;
const startPeriodicHealthChecks = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  // Run initial check
  runHealthChecks();
  
  // Schedule periodic checks
  healthCheckInterval = setInterval(runHealthChecks, HEALTH_CHECK_CONFIG.interval);
  
  logger.info('Periodic health checks started', {
    interval: HEALTH_CHECK_CONFIG.interval,
    component: 'health-check'
  });
};

// Stop periodic health checks
const stopPeriodicHealthChecks = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    logger.info('Periodic health checks stopped', { component: 'health-check' });
  }
};

// Graceful shutdown
process.on('SIGINT', stopPeriodicHealthChecks);
process.on('SIGTERM', stopPeriodicHealthChecks);

module.exports = {
  healthCheckHandler,
  readinessCheckHandler,
  livenessCheckHandler,
  metricsHandler,
  trackRequestMetrics,
  runHealthChecks,
  resetMetrics,
  startPeriodicHealthChecks,
  stopPeriodicHealthChecks,
  getHealthStatus: () => healthStatus,
  getPerformanceMetrics: () => performanceMetrics
};