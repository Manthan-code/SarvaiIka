/**
 * @swagger
 * components:
 *   schemas:
 *     HealthStatus:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, unhealthy, degraded]
 *         timestamp:
 *           type: string
 *           format: date-time
 *         uptime:
 *           type: number
 *         version:
 *           type: string
 *         environment:
 *           type: string
 *         checks:
 *           type: object
 *           properties:
 *             database:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 responseTime:
 *                   type: number
 *             redis:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 responseTime:
 *                   type: number
 *             qdrant:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 responseTime:
 *                   type: number
 *         metrics:
 *           type: object
 *           properties:
 *             memory:
 *               type: object
 *             cpu:
 *               type: object
 *             requests:
 *               type: object
 */

/**
 * Health Check Routes
 * Provides health monitoring endpoints for the application
 */

const express = require('express');
const router = express.Router();
const {
  healthCheckHandler,
  readinessCheckHandler,
  livenessCheckHandler,
  metricsHandler,
  resetMetrics
} = require('../middleware/healthCheck');
const logger = require('../utils/logger');

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Comprehensive health check
 *     description: Returns detailed health status including all service checks and metrics
 *     responses:
 *       200:
 *         description: Health check completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthStatus'
 *       503:
 *         description: Service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthStatus'
 */
router.get('/', healthCheckHandler);

/**
 * @swagger
 * /health/live:
 *   get:
 *     tags: [Health]
 *     summary: Liveness probe
 *     description: Simple liveness check for Kubernetes health monitoring
 *     responses:
 *       200:
 *         description: Service is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: alive
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/live', livenessCheckHandler);

/**
 * @swagger
 * /health/ready:
 *   get:
 *     tags: [Health]
 *     summary: Readiness probe
 *     description: Readiness check for Kubernetes deployment readiness
 *     responses:
 *       200:
 *         description: Service is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ready
 *                 checks:
 *                   type: object
 *       503:
 *         description: Service not ready
 */
router.get('/ready', readinessCheckHandler);

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     tags: [Health]
 *     summary: Application metrics
 *     description: Returns system and performance metrics
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 system:
 *                   type: object
 *                 performance:
 *                   type: object
 *                 requests:
 *                   type: object
 */
router.get('/metrics', metricsHandler);

/**
 * @route POST /health/metrics/reset
 * @desc Reset performance metrics
 * @access Private (should be protected in production)
 * @returns {Object} Reset confirmation
 */
router.post('/metrics/reset', (req, res) => {
  try {
    resetMetrics();
    
    logger.logUserAction(
      req.user?.id || 'system',
      'reset-metrics',
      'health-metrics',
      { ip: req.ip }
    );
    
    res.json({
      status: 'success',
      message: 'Performance metrics reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.logError(error, { 
      component: 'health-routes', 
      endpoint: '/health/metrics/reset',
      userId: req.user?.id
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /health/status
 * @desc Quick status check (cached)
 * @access Public
 * @returns {Object} Cached health status
 */
router.get('/status', (req, res) => {
  try {
    const { getHealthStatus } = require('../middleware/healthCheck');
    const status = getHealthStatus();
    
    const statusCode = status.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json({
      status: status.status,
      timestamp: status.timestamp,
      uptime: status.uptime,
      version: status.version,
      cached: true
    });
  } catch (error) {
    logger.logError(error, { 
      component: 'health-routes', 
      endpoint: '/health/status'
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to get health status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /health/version
 * @desc Application version information
 * @access Public
 * @returns {Object} Version and build information
 */
router.get('/version', (req, res) => {
  const packageJson = require('../../../package.json');
  
  res.json({
    name: packageJson.name || 'ai-agent-platform-backend',
    version: packageJson.version || process.env.APP_VERSION || '1.0.0',
    description: packageJson.description || 'AI Agent Platform Backend',
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    environment: process.env.NODE_ENV || 'development',
    buildDate: process.env.BUILD_DATE || new Date().toISOString(),
    commit: process.env.GIT_COMMIT || 'unknown',
    branch: process.env.GIT_BRANCH || 'unknown',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route GET /health/dependencies
 * @desc Check external dependencies status
 * @access Public
 * @returns {Object} Status of external services
 */
router.get('/dependencies', async (req, res) => {
  try {
    const { runHealthChecks } = require('../middleware/healthCheck');
    const health = await runHealthChecks();
    
    const dependencies = {
      database: {
        status: health.checks.database?.status || 'unknown',
        responseTime: health.checks.database?.responseTime || 0,
        details: health.checks.database?.details || {}
      },
      redis: {
        status: health.checks.redis?.status || 'unknown',
        responseTime: health.checks.redis?.responseTime || 0,
        details: health.checks.redis?.details || {}
      },
      qdrant: {
        status: health.checks.qdrant?.status || 'unknown',
        responseTime: health.checks.qdrant?.responseTime || 0,
        details: health.checks.qdrant?.details || {}
      },
      filesystem: {
        status: health.checks.filesystem?.status || 'unknown',
        responseTime: health.checks.filesystem?.responseTime || 0,
        details: health.checks.filesystem?.details || {}
      }
    };
    
    const allHealthy = Object.values(dependencies).every(dep => dep.status === 'healthy');
    const statusCode = allHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      dependencies
    });
  } catch (error) {
    logger.logError(error, { 
      component: 'health-routes', 
      endpoint: '/health/dependencies'
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to check dependencies',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Error handling middleware for health routes
 */
router.use((error, req, res, next) => {
  logger.logError(error, {
    component: 'health-routes',
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({
    status: 'error',
    message: 'Health check endpoint error',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;