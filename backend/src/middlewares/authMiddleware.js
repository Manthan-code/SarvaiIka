const logger = require('../config/logger');
// Use the standard Supabase client (anon key) for token validation
// This ensures the token issued on the frontend is validated against the same project
const supabase = require('../db/supabase/client.js');

/**
 * Helper function to set CORS headers on response
 */
const setCorsHeaders = (res) => {
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8080').split(',').map(origin => origin.trim());
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0] || 'http://localhost:8080');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
};

/**
 * Require authentication using Supabase session tokens only
 * Validates the Bearer token against Supabase auth service
 */
const requireAuth = async (req, res, next) => {
  try {
    console.log('[DEBUG] Entering requireAuth middleware');
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      setCorsHeaders(res);
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('Authentication failed:', error?.message);
      setCorsHeaders(res);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user profile from database
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id);

    if (profileError) {
      logger.warn('Profile fetch failed:', profileError.message);
      // Continue without profile if not found
    }

    const profile = profileData && profileData.length > 0 ? profileData[0] : null;

    req.user = user;
    req.userId = user.id;
    req.profile = profile;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    setCorsHeaders(res);
    res.status(500).json({ error: 'Authentication service error' });
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 * Useful for endpoints that work for both authenticated and anonymous users
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        // Get user profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id);

        const profile = profileData && profileData.length > 0 ? profileData[0] : null;

        req.user = user;
        req.userId = user.id;
        req.profile = profile;
      }
    }
    next();
  } catch (error) {
    // Silently continue without authentication for optional auth
    next();
  }
};

/**
 * Require specific role for access
 * Must be used after requireAuth middleware
 */
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      setCorsHeaders(res);
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.profile || req.profile.role !== role) {
      logger.warn('Access denied - insufficient role:', {
        userId: req.user.id,
        requiredRole: role,
        userRole: req.profile?.role
      });
      setCorsHeaders(res);
      return res.status(403).json({ error: 'Access denied - insufficient permissions' });
    }

    next();
  };
};

/**
 * Require admin role for access
 * Combines authentication and admin role checking
 */
const requireAdmin = async (req, res, next) => {
  // First authenticate the user
  await requireAuth(req, res, (authError) => {
    if (authError) return;

    // Then check for admin role
    const roleMiddleware = requireRole('admin');
    roleMiddleware(req, res, next);
  });
};

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  requireAdmin
};
