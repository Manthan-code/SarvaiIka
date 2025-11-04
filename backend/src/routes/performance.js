const express = require('express');
const router = express.Router();
const { getPerformanceReport, getPerformanceAlerts, resetMetrics } = require('../services/performanceService');
const { getCacheStats, resetCacheStats } = require('../services/cacheService');
const { requireAuth } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validationMiddleware');
const logger = require('../utils/logger');

/**
 * @route GET /api/performance/metrics
 * @desc Get comprehensive performance metrics
 * @access Private (Admin only)
 */
router.get('/metrics', requireAuth, async (req, res) => {
  try {
    // Check if user is admin (you may need to adjust this based on your user model)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const performanceReport = getPerformanceReport();
    
    res.json({
      success: true,
      data: performanceReport
    });
  } catch (error) {
    logger.error('Error fetching performance metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance metrics'
    });
  }
});

/**
 * @route GET /api/performance/alerts
 * @desc Get current performance alerts
 * @access Private (Admin only)
 */
router.get('/alerts', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const alerts = getPerformanceAlerts();
    
    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        criticalCount: alerts.filter(a => a.severity === 'critical').length,
        warningCount: alerts.filter(a => a.severity === 'warning').length
      }
    });
  } catch (error) {
    logger.error('Error fetching performance alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance alerts'
    });
  }
});

/**
 * @route GET /api/performance/cache
 * @desc Get cache statistics
 * @access Private (Admin only)
 */
router.get('/cache', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const cacheStats = getCacheStats();
    
    res.json({
      success: true,
      data: cacheStats
    });
  } catch (error) {
    logger.error('Error fetching cache statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cache statistics'
    });
  }
});

/**
 * @route POST /api/performance/reset
 * @desc Reset performance metrics
 * @access Private (Admin only)
 */
router.post('/reset', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { type } = req.body;
    
    if (type === 'performance' || type === 'all') {
      resetMetrics();
      logger.info('Performance metrics reset by admin', { userId: req.user.id });
    }
    
    if (type === 'cache' || type === 'all') {
      resetCacheStats();
      logger.info('Cache statistics reset by admin', { userId: req.user.id });
    }
    
    res.json({
      success: true,
      message: `${type} metrics have been reset successfully`
    });
  } catch (error) {
    logger.error('Error resetting metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset metrics'
    });
  }
});

/**
 * @route GET /api/performance/health
 * @desc Get basic health check with key metrics
 * @access Private
 */
router.get('/health', requireAuth, async (req, res) => {
  try {
    const performanceReport = getPerformanceReport();
    const alerts = getPerformanceAlerts();
    
    // Basic health indicators
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: performanceReport.memory,
      requests: {
        total: performanceReport.requests.total,
        successRate: performanceReport.requests.successRate,
        averageResponseTime: performanceReport.requests.averageResponseTime
      },
      cache: {
        hitRate: performanceReport.cache.hitRate
      },
      alerts: {
        count: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length
      }
    };
    
    // Determine overall health status
    if (alerts.some(a => a.severity === 'critical')) {
      health.status = 'critical';
    } else if (alerts.length > 0) {
      health.status = 'warning';
    }
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Error fetching health status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch health status',
      data: {
        status: 'error',
        timestamp: new Date()
      }
    });
  }
});

module.exports = router;