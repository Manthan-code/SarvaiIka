const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const redisClient = require('./redis/unifiedRedisClient.js');
const qdrantClient = require('./db/qdrant/client.js');
const healthRoutes = require('./routes/healthRoutes.js');
const plansRoutes = require('./routes/plans.js');
const chatRoutes = require('./routes/chatRoutes.js');
const subscriptionRoutes = require('./routes/subscriptionRoutes.js');
const routerRoutes = require('./routes/routerRoutes.js');
const authRoutes = require('./routes/auth.js');
const usersRoutes = require('./routes/users.js');
const settingsRoutes = require('./routes/settings.js');
const billingRoutes = require('./routes/billingRoutes.js');
const shareRoutes = require('./routes/shareRoutes.js');
const streamingChatRoutes = require('./routes/streamingChatRoutes.js');
const errorRoutes = require('./routes/errorRoutes.js');
const adminRoutes = require('./routes/adminRoutes.js');
const errorHandler = require('./middlewares/errorHandler.js');
const { 
  validateRequest, 
  rateLimitConfigs, 
  securityHeaders, 
  validateInputLength 
} = require('./middlewares/validationMiddleware.js');
const {
  securityLogger,
  bruteForceProtection,
  apiAbuseProtection,
  chatSpamProtection,
  requestSizeLimit
} = require('./middlewares/securityMiddleware.js');
const { performanceMiddleware, startMonitoring } = require('./services/performanceService');
const logger = require('./config/logger.js');
const config = require('./config/config.js');
const { validateEnvironment } = require('./config/validateEnv.js');

const { initSentry, sentryErrorTracker } = require('./config/sentry.js');

const enhancedChatRoutes = require('./routes/enhancedChatRoutes.js');
const enhancedProfileRoutes = require('./routes/enhancedProfileRoutes.js');
const SubscriptionExpirationService = require('./services/subscriptionExpirationService.js');
const { setupSwagger } = require('./config/swagger.js');
const apiRoutes = require('./routes/api.js');

const app = express();
const PORT = config.port;

// Validate environment configuration early
validateEnvironment();

// Initialize Sentry
initSentry();

// ========== MIDDLEWARE ==========
// Sentry request handler must be the first middleware
app.use(sentryErrorTracker.requestHandler());

// Security logging and monitoring
app.use(securityLogger);

// Request size limits
app.use(requestSizeLimit(5 * 1024 * 1024)); // 5MB limit

// Performance monitoring
app.use(performanceMiddleware);

// Configure CORS first, before other middleware
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8080').split(',').map(origin => origin.trim());
const isProduction = process.env.NODE_ENV === 'production';

// Factor CORS options so they are reused for both middleware and OPTIONS handler
const corsOptions = {
  origin: (origin, callback) => {
    // In production, be strict about origins
    if (isProduction) {
      if (!origin) {
        return callback(new Error('Origin not allowed by CORS policy'));
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    } else {
      // In development, be more permissive
      // Allow requests with no origin (like mobile apps, curl, or preflight requests)
      if (!origin) return callback(null, true);
      // Allow any localhost origin in development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      // Allow configured origins
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // In development, log but allow unknown origins
      console.log(`CORS: Allowing unknown origin in development: ${origin}`);
      return callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  maxAge: 86400, // 24 hours preflight cache
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Enhanced security headers
app.use(securityHeaders());

// Security monitoring middleware
app.use((req, res, next) => {
  // Log suspicious requests
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript protocol
    /data:.*base64/i // Data URI with base64
  ];
  
  const requestString = `${req.method} ${req.url} ${JSON.stringify(req.headers)} ${JSON.stringify(req.body || {})}`;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      logger.warn('Suspicious request detected', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.url,
        pattern: pattern.toString()
      });
      break;
    }
  }
  
  next();
});

// Use JSON parsing for all routes except Stripe webhooks
app.use((req, res, next) => {
  if (req.path === '/api/subscriptions/webhook') {
    // For Stripe webhooks, we need the raw body as a buffer
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

// Enhanced rate limiting with security monitoring
// Exclude /profile endpoint from brute force protection as it's accessed frequently
app.use('/api/auth', (req, res, next) => {
  if (req.path === '/profile') {
    // Use regular API rate limiting for profile endpoint
    return apiAbuseProtection(req, res, next);
  }
  // Use brute force protection for other auth endpoints
  return bruteForceProtection(req, res, next);
});
// Apply chat spam protection only to POST requests (actual chat messages)
app.use('/api/chat', (req, res, next) => {
  if (req.method === 'POST') {
    return chatSpamProtection(req, res, next);
  }
  next();
});
app.use('/api', apiAbuseProtection);

// Input length validation for all routes
app.use('/api', validateInputLength(50000)); // 50KB limit

// Request validation middleware
app.use('/api', validateRequest());

// Setup Swagger documentation
setupSwagger(app);

// Enhanced routes with Redis caching
app.use('/api', apiRoutes);
app.use('/api/enhanced-chat', enhancedChatRoutes);
app.use('/api/enhanced-profile', enhancedProfileRoutes);
// ========== ROUTES ==========
app.use('/health', healthRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/router', routerRoutes);
// compatibility alias expected by tests (/api/route)
app.post('/api/route', async (req, res, next) => {
  try {
    // Delegate to routerRoutes mounted path
    req.url = '/route';
    return routerRoutes.handle(req, res, next);
  } catch (e) {
    return next(e);
  }
});
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/streaming', streamingChatRoutes);
// Compatibility alias for direct path to streaming endpoint
app.post('/api/streaming/stream', async (req, res, next) => {
  try {
    // Delegate to the router mounted at /api/streaming
    req.url = '/stream';
    return streamingChatRoutes.handle(req, res, next);
  } catch (e) {
    return next(e);
  }
});
app.use('/api/billing', billingRoutes);
app.use('/api/errors', errorRoutes);
// Handle trailing slash for error routes
//app.use('/api/errors/', errorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/performance', require('./routes/performance'));

// Debug: Log all registered routes at startup to verify availability
try {
  const listRoutes = () => {
    const routes = [];
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        const methods = Object.keys(middleware.route.methods)
          .filter(m => middleware.route.methods[m])
          .map(m => m.toUpperCase())
          .join(',');
        routes.push(`${methods} ${middleware.route.path}`);
      } else if (middleware.name === 'router' && middleware.handle.stack) {
        middleware.handle.stack.forEach((handler) => {
          const route = handler.route;
          if (route) {
            const methods = Object.keys(route.methods)
              .filter(m => route.methods[m])
              .map(m => m.toUpperCase())
              .join(',');
            // Attempt to extract mount path from the parent layer regexp
            let mountPath = '';
            if (middleware.regexp && middleware.regexp.source) {
              // Convert the regexp to a readable path prefix
              const source = middleware.regexp.source
                .replace('^\\', '')
                .replace('\\/?(?=\\/|$)', '')
                .replace('(?=\\/|$)', '')
                .replace('\\/', '/');
              mountPath = source.startsWith('/') ? source : `/${source}`;
            }
            routes.push(`${methods} ${mountPath}${route.path}`);
          }
        });
      }
    });
    console.log('📚 Registered routes:', routes.sort());
  };
  // Defer listing until next tick so all mounts are included
  process.nextTick(listRoutes);
} catch (e) {
  console.warn('Route listing failed:', e.message);
}

// Root route
app.get("/", (_req, res) => res.send("API up ✅")); 

// Test route to verify routing is working
app.get("/test", (_req, res) => res.send("Test route working ✅")); 

// Explicitly handle OPTIONS requests for preflight checks with the same options
app.options('*', cors(corsOptions));

// ========== ERROR HANDLING ==========
// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Sentry error handler must be before custom error handler
app.use(sentryErrorTracker.errorHandler());

// Global error handler (must be last)
app.use(errorHandler);

// ========== SERVER STARTUP ==========
// Test connections and start server
async function testConnections() {
  try {
    await redisClient.initialize();
    await redisClient.ping();
    logger.info('Redis connection successful');
  } catch (err) {
    logger.error('Redis connection failed:', err.message);
  }

  try {
    await qdrantClient.getCollections();
    logger.info('Qdrant connection successful');
  } catch (err) {
    logger.error('Qdrant connection failed:', err.message);
  }
}

let server;

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, async () => {
    logger.info('Smart AI Agent Platform Backend');
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
    logger.info(`Chat API: http://localhost:${PORT}/api/chat`);
    logger.info('Services: Redis, Qdrant, Supabase');
    logger.info(new Date().toISOString());

    await testConnections();
    
    // Start performance monitoring
    startMonitoring();
    
    // Start subscription expiration checker
    SubscriptionExpirationService.startExpirationChecker();
  });
}

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    const status = redisClient.getStatus();
    if (status.isConnected) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }

    if (server) {
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }

    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);

  } catch (err) {
    logger.error('Error during graceful shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;

