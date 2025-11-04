/**
 * Security configuration for the AI Agent Platform
 * Centralizes security settings and provides environment-based configuration
 */

const config = {
  // Rate limiting configuration
  rateLimiting: {
    auth: {
      windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5, // 5 attempts
      message: 'Too many authentication attempts, please try again later'
    },
    api: {
      windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW) || 1 * 60 * 1000, // 1 minute
      max: parseInt(process.env.API_RATE_LIMIT_MAX) || 60, // 60 requests
      message: 'API rate limit exceeded, please slow down'
    },
    chat: {
      windowMs: parseInt(process.env.CHAT_RATE_LIMIT_WINDOW) || 1 * 60 * 1000, // 1 minute
      max: parseInt(process.env.CHAT_RATE_LIMIT_MAX) || 15, // 15 messages
      message: 'Too many chat requests, please wait before sending more messages'
    },
    upload: {
      windowMs: parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW) || 5 * 60 * 1000, // 5 minutes
      max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX) || 5, // 5 uploads
      message: 'Too many file uploads, please wait before uploading more files'
    }
  },

  // Request size limits
  requestLimits: {
    maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE) || 5 * 1024 * 1024, // 5MB
    maxJsonSize: parseInt(process.env.MAX_JSON_SIZE) || 1024 * 1024, // 1MB
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },

  // IP filtering
  ipFiltering: {
    enabled: process.env.IP_FILTERING_ENABLED === 'true',
    whitelist: process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(',').map(ip => ip.trim()) : [],
    blacklist: process.env.IP_BLACKLIST ? process.env.IP_BLACKLIST.split(',').map(ip => ip.trim()) : []
  },

  // Security headers configuration
  headers: {
    contentSecurityPolicy: {
      enabled: process.env.CSP_ENABLED !== 'false', // Enabled by default
      reportOnly: process.env.NODE_ENV !== 'production',
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://api.openai.com",
          "https://*.supabase.co",
          "https://api.stripe.com",
          "https://*.qdrant.tech",
          "https://*.sentry.io" // Add Sentry for error reporting
        ],
        fontSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    hsts: {
      enabled: process.env.HSTS_ENABLED !== 'false',
      maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000, // 1 year
      includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
      preload: process.env.HSTS_PRELOAD !== 'false'
    }
  },

  // Input validation
  validation: {
    maxInputLength: parseInt(process.env.MAX_INPUT_LENGTH) || 50000,
    enableXssProtection: process.env.XSS_PROTECTION_ENABLED !== 'false',
    enableSqlInjectionProtection: process.env.SQL_INJECTION_PROTECTION_ENABLED !== 'false'
  },

  // Monitoring and logging
  monitoring: {
    logSuspiciousRequests: process.env.LOG_SUSPICIOUS_REQUESTS !== 'false',
    logFailedRequests: process.env.LOG_FAILED_REQUESTS !== 'false',
    alertOnBruteForce: process.env.ALERT_ON_BRUTE_FORCE !== 'false',
    sentrySecurityReporting: process.env.SENTRY_SECURITY_REPORTING !== 'false'
  },

  // CORS configuration
  cors: {
    origins: process.env.CORS_ORIGINS ? 
      process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()) : 
      ['http://localhost:8080'],
    credentials: process.env.CORS_CREDENTIALS !== 'false',
    maxAge: parseInt(process.env.CORS_MAX_AGE) || 86400 // 24 hours
  },

  // Session security
  session: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Validation function to ensure required security settings
function validateSecurityConfig() {
  const errors = [];

  // Check if production environment has secure settings
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.SENTRY_DSN) {
      errors.push('SENTRY_DSN is required in production for security monitoring');
    }
    
    if (config.headers.contentSecurityPolicy.reportOnly) {
      console.warn('CSP is in report-only mode in production');
    }
    
    if (config.cors.origins.includes('http://localhost:8080')) {
      errors.push('Localhost origins should not be allowed in production');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Security configuration errors:\n${errors.join('\n')}`);
  }

  return true;
}

// Export configuration and validation
module.exports = {
  config,
  validateSecurityConfig
};