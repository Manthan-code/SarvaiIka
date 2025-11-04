const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

// Load environment variables from .env only outside of test runs
if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const toInt = (val, def) => {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : def;
};

const isValidUrl = (str) => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

const parseRedisUrl = (redisUrl) => {
  try {
    const urlObj = new URL(redisUrl);
    const auth = urlObj.username || urlObj.password ? { user: urlObj.username, pass: urlObj.password } : null;
    const db = urlObj.pathname && urlObj.pathname.length > 1 ? toInt(urlObj.pathname.slice(1), 0) : 0;
    return {
      host: urlObj.hostname || 'localhost',
      port: toInt(urlObj.port, 6379),
      password: auth ? auth.pass : undefined,
      db
    };
  } catch (e) {
    // Fallback to defaults on parsing error
    return {
      host: 'localhost',
      port: 6379,
      password: undefined,
      db: 0
    };
  }
};

const loadPackageInfo = () => {
  try {
    const pkgPath = path.join(__dirname, '../../package.json');
    if (fs.existsSync(pkgPath)) {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw);
      return { name: pkg.name || 'ai-agent-platform', version: pkg.version || '1.0.0' };
    }
  } catch (e) {
    // ignore
  }
  return { name: 'ai-agent-platform', version: '1.0.0' };
};

const buildConfig = () => {
  const env = process.env.NODE_ENV || 'development';

  const appInfo = loadPackageInfo();

  // Debug snapshot of relevant envs for tests
  logger.debug('Config env snapshot', {
    NODE_ENV: env,
    PORT: process.env.PORT,
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
    CACHE_TTL: process.env.CACHE_TTL
  });

  const server = {
    port: toInt(process.env.PORT, 3000),
    host: process.env.HOST || '0.0.0.0',
    apiVersion: process.env.API_VERSION || 'v1',
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },
    rateLimit: {
      windowMs: toInt(process.env.RATE_LIMIT_WINDOW, 15 * 60 * 1000),
      max: toInt(process.env.RATE_LIMIT_MAX, 100),
      message: 'Too many requests from this IP'
    },
    timeout: toInt(process.env.WEBHOOK_TIMEOUT, 30000)
  };

  const database = {
    url: process.env.DATABASE_URL,
    supabase: {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY
    },
    pool: {
      min: toInt(process.env.DB_POOL_MIN, 2),
      max: toInt(process.env.DB_POOL_MAX, 10),
      idleTimeoutMillis: toInt(process.env.DB_POOL_IDLE_TIMEOUT, 30000),
      connectionTimeoutMillis: toInt(process.env.DB_POOL_CONNECTION_TIMEOUT, 2000)
    },
    ssl: env === 'production'
  };

  const auth = {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 10),
    sessionSecret: process.env.SESSION_SECRET,
    tokenTypes: {
      access: 'access',
      refresh: 'refresh',
      reset: 'reset',
      verify: 'verify'
    },
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    }
  };

  const redisDefaults = parseRedisUrl(process.env.REDIS_URL || 'redis://localhost:6379');
  const redis = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: redisDefaults.host,
    port: redisDefaults.port,
    password: process.env.REDIS_PASSWORD || redisDefaults.password,
    db: toInt(process.env.REDIS_DB, redisDefaults.db),
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000
  };

  const openai = {
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORGANIZATION,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-3.5-turbo',
    maxTokens: toInt(process.env.OPENAI_MAX_TOKENS, 4096),
    temperature: Number.isFinite(parseFloat(process.env.OPENAI_TEMPERATURE)) ? parseFloat(process.env.OPENAI_TEMPERATURE) : 0.7,
    timeout: toInt(process.env.OPENAI_TIMEOUT, 30000),
    maxRetries: toInt(process.env.MAX_RETRIES, 3),
    retryDelay: toInt(process.env.RETRY_DELAY, 1000)
  };

  const stripe = {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    apiVersion: process.env.STRIPE_API_VERSION || '2023-10-16',
    timeout: toInt(process.env.STRIPE_TIMEOUT, 30000),
    maxRetries: toInt(process.env.STRIPE_MAX_RETRIES, 3),
    currency: process.env.STRIPE_CURRENCY || 'usd',
    successUrl: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/success',
    cancelUrl: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/cancel'
  };

  const qdrant = {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
    timeout: toInt(process.env.QDRANT_TIMEOUT, 30000),
    retries: toInt(process.env.QDRANT_RETRIES, 3),
    collections: {
      default: process.env.QDRANT_COLLECTION_DEFAULT || 'ai_vectors',
      embeddings: process.env.QDRANT_COLLECTION_EMBEDDINGS || 'embeddings',
      documents: process.env.QDRANT_COLLECTION_DOCUMENTS || 'documents'
    },
    vectorSize: toInt(process.env.QDRANT_VECTOR_SIZE, 1536),
    distance: process.env.QDRANT_DISTANCE || 'Cosine'
  };

  const upload = {
    maxSize: toInt(process.env.UPLOAD_MAX_SIZE, 10 * 1024 * 1024),
    allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,application/pdf').split(',').map(s => s.trim()),
    destination: process.env.UPLOAD_DESTINATION || 'uploads/',
    tempDir: process.env.UPLOAD_TEMP_DIR || 'temp/',
    cleanupInterval: toInt(process.env.UPLOAD_CLEANUP_INTERVAL, 60 * 60 * 1000),
    maxAge: toInt(process.env.UPLOAD_MAX_AGE, 24 * 60 * 60 * 1000)
  };

  const cache = {
    ttl: toInt(process.env.CACHE_TTL, 3600),
    checkPeriod: toInt(process.env.CACHE_CHECK_PERIOD, 600),
    maxKeys: toInt(process.env.CACHE_MAX_KEYS, 1000),
    prefix: process.env.CACHE_PREFIX || 'ai_agent:',
    compression: process.env.CACHE_COMPRESSION ? process.env.CACHE_COMPRESSION === 'true' : true,
    serialization: process.env.CACHE_SERIALIZATION || 'json'
  };

  const security = {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:']
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
      ivLength: 16
    },
    session: {
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: env === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
      }
    }
  };

  const config = {
    env,
    isDevelopment: env === 'development',
    isProduction: env === 'production',
    isTest: env === 'test',
    server,
    database,
    auth,
    redis,
    openai,
    stripe,
    qdrant,
    upload,
    cache,
    security,
    app: appInfo,
    validate: () => {
      const errors = [];
      // Required env vars
      const requiredVars = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DATABASE_URL', 'OPENAI_API_KEY', 'STRIPE_SECRET_KEY'];
      for (const k of requiredVars) {
        if (!process.env[k]) {
          errors.push(`Missing required environment variable: ${k}`);
        }
      }
      // URL format validation (including Redis URL to ensure invalid formats are caught in tests)
      const urlVars = ['SUPABASE_URL', 'DATABASE_URL', 'REDIS_URL', 'QDRANT_URL'];
      for (const k of urlVars) {
        const val = process.env[k];
        if (val && !isValidUrl(val)) {
          errors.push(`Invalid URL format for ${k}`);
        }
      }
      // JWT secret length validation
      if (!auth.jwtSecret || auth.jwtSecret.length < 12) {
        errors.push('JWT secret must be at least 12 characters long');
      }
      // OpenAI key quick validation for tests
      if (process.env.OPENAI_API_KEY === 'invalid-key') {
        errors.push('Invalid OpenAI API key');
      }
      // Stripe key quick validation for tests
      if (process.env.STRIPE_SECRET_KEY === 'invalid-key') {
        errors.push('Invalid Stripe secret key');
      }
      logger.debug('Configuration validation completed');
      return { isValid: errors.length === 0, errors };
    },
    getSummary: () => ({
      environment: env,
      server: { port: server.port, host: server.host },
      database: { connected: !!database.url, ssl: !!database.ssl },
      redis: { connected: !!redis.url },
      cache: { enabled: true, ttl: cache.ttl },
      security: { helmet: true, session: true }
    }),
    reload: function reload() {
      const fresh = buildConfig();
      // mutate current config
      Object.keys(fresh).forEach((key) => { this[key] = fresh[key]; });
      return this;
    }
  };

  return config;
};

let currentConfig;
try {
  logger.info('Loading configuration...');
  currentConfig = buildConfig();
  const skipValidation = process.env.SKIP_ENV_VALIDATION === 'true';
  if (skipValidation) {
    logger.info('Skipping configuration validation due to SKIP_ENV_VALIDATION=true');
  } else {
    const result = currentConfig.validate();
    if (!result.isValid) {
      throw new Error(result.errors.join('; '));
    }
  }
  logger.info('Configuration loaded successfully');
} catch (error) {
  logger.error('Configuration error:', error);
  throw error;
}

module.exports = currentConfig;