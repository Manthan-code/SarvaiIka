/**
 * Authentication Middleware
 * Handles JWT token verification and user authentication
 */

const jwt = require('jsonwebtoken');
const supabaseClient = require('../db/supabase/client');
const logger = require('../utils/logger');
const config = require('../config/config');

// Simple in-memory rate limiting store
const rateLimitStore = new Map();

/**
 * Middleware to verify JWT token and authenticate user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate = async (req, res, next) => {
  try {
    // If user already attached by a previous middleware, skip verification
    if (req.user) {
      return next();
    }

    // Get token from Authorization header (case-insensitive "Bearer")
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      return res.status(401).json({ error: 'No token provided' });
    }

    const [scheme, token] = authHeader.split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const tokenSecret = (config.jwt && config.jwt.secret) || process.env.JWT_SECRET || 'test-secret';
    const decoded = jwt.verify(token, tokenSecret);

    // Get user from database
    const { data: user, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      logger.error('User not found or database error', { error });
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error', { error: error.message });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Middleware to check if user has admin role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

/**
 * Middleware to check if user has premium subscription
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requirePremium = (req, res, next) => {
  if (!req.user || !req.user.subscription || req.user.subscription !== 'premium') {
    return res.status(403).json({ error: 'Premium subscription required' });
  }
  next();
};

/**
 * Middleware to check if user has active subscription
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const checkSubscriptionAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.subscriptionStatus) {
    return res.status(403).json({ 
      success: false,
      error: 'Subscription required' 
    });
  }

  if (req.user.subscriptionStatus !== 'active') {
    return res.status(403).json({ 
      success: false,
      error: 'Active subscription required' 
    });
  }

  next();
};

/**
 * Middleware to check if user has API access
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const checkApiAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.api_access) {
    return res.status(403).json({ error: 'API access required' });
  }

  next();
};

/**
 * Middleware to check if user has required permissions
 * @param {Array} permissions - Required permissions
 * @returns {Function} Middleware function
 */
const checkPermissions = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userPermissions = req.user.permissions || [];
    const hasAllPermissions = permissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

/**
 * Rate limiting middleware factory based on user ID
 * @param {Number} maxRequests - Maximum number of requests allowed in the time window
 * @param {Number} windowMs - Time window in milliseconds
 * @returns {Function} Middleware function
 */
const rateLimitByUser = (maxRequests, windowSec) => {
  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowMs = windowSec * 1000;
    
    // Initialize or get user's rate limit data
    if (!rateLimitStore.has(userId)) {
      rateLimitStore.set(userId, {
        count: 0,
        resetAt: now + windowMs
      });
    }
    
    const userRateLimit = rateLimitStore.get(userId);
    
    // Reset count if time window has passed
    if (now > userRateLimit.resetAt) {
      userRateLimit.count = 0;
      userRateLimit.resetAt = now + windowMs;
    }
    
    // Check if rate limit exceeded
    if (userRateLimit.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded'
      });
    }
    
    // Increment request count
    userRateLimit.count++;
    rateLimitStore.set(userId, userRateLimit);
    
    next();
  };
};

module.exports = {
  authenticate,
  requireAdmin,
  requirePremium,
  checkSubscriptionAccess,
  checkApiAccess,
  checkPermissions,
  rateLimitByUser
};