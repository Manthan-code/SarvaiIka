const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const MongoStore = require('rate-limit-mongo');
const logger = require('../config/logger');
const { sentryErrorTracker } = require('../config/sentry');

/**
 * Advanced security middleware for enhanced protection
 */

// IP-based rate limiting with Redis/Memory store
const createAdvancedRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    message = 'Too many requests from this IP',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    skipFailedRequests,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      });
      
      // Report to Sentry for monitoring
      sentryErrorTracker.captureMessage(
        `Rate limit exceeded: ${req.ip}`,
        'warning',
        {
          tags: { security: 'rate_limit' },
          extra: {
            ip: req.ip,
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent')
          }
        }
      );
      
      res.status(429).json({ error: message });
    }
  });
};

// Progressive delay for suspicious activity
const createSlowDown = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    delayAfter = 5, // Allow 5 requests per windowMs without delay
    delayMs = 500, // Add 500ms delay per request after delayAfter
    maxDelayMs = 20000 // Maximum delay of 20 seconds
  } = options;

  return slowDown({
    windowMs,
    delayAfter,
    delayMs,
    maxDelayMs,
    onLimitReached: (req, res, options) => {
      logger.warn(`Slow down triggered for IP: ${req.ip}`, {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
    }
  });
};

// Security event logging middleware
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript injection
    /eval\(/i, // Code injection
    /exec\(/i, // Command injection
  ];
  
  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(requestData) || pattern.test(req.url)
  );
  
  if (isSuspicious) {
    logger.warn('Suspicious request detected', {
      ip: req.ip,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      body: req.body,
      query: req.query,
      headers: req.headers
    });
    
    // Report to Sentry
    sentryErrorTracker.captureMessage(
      'Suspicious request pattern detected',
      'warning',
      {
        tags: { security: 'suspicious_request' },
        extra: {
          ip: req.ip,
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
          requestData
        }
      }
    );
  }
  
  // Log response time and status
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP error response', {
        ip: req.ip,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('User-Agent')
      });
    }
  });
  
  next();
};

// Brute force protection for authentication endpoints
const bruteForceProtection = createAdvancedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 100 : 5, // More lenient in development
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true // Don't count successful requests
});

// API abuse protection
const apiAbuseProtection = createAdvancedRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 300 : 60, // More lenient in development
  message: 'API rate limit exceeded, please slow down'
});

// Chat spam protection
const chatSpamProtection = createAdvancedRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // 15 chat messages per minute
  message: 'Too many chat requests, please wait before sending more messages'
});

// File upload protection
const uploadProtection = createAdvancedRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 uploads per 5 minutes
  message: 'Too many file uploads, please wait before uploading more files'
});

// Request size validation
const requestSizeLimit = (maxSize = 1024 * 1024) => { // 1MB default
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    
    if (contentLength > maxSize) {
      logger.warn('Request size limit exceeded', {
        ip: req.ip,
        contentLength,
        maxSize,
        path: req.path
      });
      
      return res.status(413).json({
        error: 'Request entity too large',
        maxSize: `${maxSize} bytes`
      });
    }
    
    next();
  };
};

// IP whitelist/blacklist middleware
const ipFilter = (options = {}) => {
  const { whitelist = [], blacklist = [] } = options;
  
  return (req, res, next) => {
    const clientIP = req.ip;
    
    // Check blacklist first
    if (blacklist.length > 0 && blacklist.includes(clientIP)) {
      logger.warn('Blocked IP attempted access', {
        ip: clientIP,
        path: req.path,
        method: req.method
      });
      
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check whitelist if configured
    if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
      logger.warn('Non-whitelisted IP attempted access', {
        ip: clientIP,
        path: req.path,
        method: req.method
      });
      
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
  };
};

module.exports = {
  createAdvancedRateLimit,
  createSlowDown,
  securityLogger,
  bruteForceProtection,
  apiAbuseProtection,
  chatSpamProtection,
  uploadProtection,
  requestSizeLimit,
  ipFilter
};