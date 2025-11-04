const path = require('path');
const fs = require('fs');

// Load environment-specific configuration
const loadEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  // Base configuration
  const baseConfig = {
    app: {
      name: 'AI Agent Platform',
      version: process.env.npm_package_version || '1.0.0',
      port: parseInt(process.env.PORT) || 5000,
      host: process.env.HOST || '0.0.0.0'
    },
    
    database: {
      url: process.env.DATABASE_URL,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      name: process.env.POSTGRES_DB || 'aiagent',
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD,
      pool: {
        max: parseInt(process.env.DB_POOL_MAX) || 20,
        min: parseInt(process.env.DB_POOL_MIN) || 5,
        idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
        acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 60000
      }
    },
    
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB) || 0
    },
    
    qdrant: {
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      host: process.env.QDRANT_HOST || 'localhost',
      port: parseInt(process.env.QDRANT_PORT) || 6333,
      apiKey: process.env.QDRANT_API_KEY
    },
    
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
    },
    
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
      credentials: true
    },
    
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
    },
    
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'combined',
      file: process.env.LOG_FILE || './logs/app.log'
    },
    
    monitoring: {
      sentry: {
        dsn: process.env.SENTRY_DSN,
        environment: env,
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1
      }
    },
    
    upload: {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
      allowedTypes: process.env.ALLOWED_FILE_TYPES ? process.env.ALLOWED_FILE_TYPES.split(',') : ['image/jpeg', 'image/png', 'application/pdf'],
      path: process.env.UPLOAD_PATH || './uploads'
    },
    
    email: {
      smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      from: process.env.EMAIL_FROM || 'noreply@aiagent.com'
    },
    
    ai: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 2000
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229'
      }
    }
  };
  
  // Environment-specific overrides
  const environmentConfigs = {
    development: {
      database: {
        ssl: false,
        logging: true
      },
      logging: {
        level: 'debug'
      },
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:5000']
      },
      rateLimit: {
        max: 1000 // More lenient for development
      }
    },
    
    test: {
      database: {
        name: process.env.TEST_DB_NAME || 'aiagent_test',
        ssl: false,
        logging: false
      },
      logging: {
        level: 'error'
      },
      jwt: {
        secret: 'test-secret-key',
        expiresIn: '1h'
      },
      rateLimit: {
        max: 10000 // Very lenient for testing
      }
    },
    
    staging: {
      database: {
        ssl: {
          rejectUnauthorized: false
        },
        logging: false
      },
      logging: {
        level: 'info'
      },
      cors: {
        origin: [process.env.STAGING_FRONTEND_URL || 'https://staging.aiagent.com']
      },
      rateLimit: {
        max: 200
      }
    },
    
    production: {
      database: {
        ssl: {
          rejectUnauthorized: true
        },
        logging: false
      },
      logging: {
        level: 'warn'
      },
      cors: {
        origin: [process.env.PRODUCTION_FRONTEND_URL || 'https://aiagent.com']
      },
      rateLimit: {
        max: 100
      },
      monitoring: {
        sentry: {
          tracesSampleRate: 0.01 // Lower sampling in production
        }
      }
    }
  };
  
  // Deep merge base config with environment-specific config
  const envConfig = environmentConfigs[env] || {};
  const mergedConfig = deepMerge(baseConfig, envConfig);
  
  // Validate required configuration
  validateConfig(mergedConfig, env);
  
  return {
    ...mergedConfig,
    env,
    isDevelopment: env === 'development',
    isTest: env === 'test',
    isStaging: env === 'staging',
    isProduction: env === 'production'
  };
};

// Deep merge utility function
const deepMerge = (target, source) => {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
};

// Configuration validation
const validateConfig = (config, env) => {
  const requiredFields = {
    all: [
      'app.port',
      'database.name',
      'database.username'
    ],
    production: [
      'jwt.secret',
      'database.password'
    ],
    staging: [
      'jwt.secret',
      'database.password'
    ]
  };
  
  const fieldsToCheck = [
    ...requiredFields.all,
    ...(requiredFields[env] || [])
  ];
  
  const missingFields = [];
  
  fieldsToCheck.forEach(field => {
    const value = getNestedValue(config, field);
    if (value === undefined || value === null || value === '') {
      missingFields.push(field);
    }
  });
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required configuration fields for ${env} environment: ${missingFields.join(', ')}`);
  }
  
  // Additional validations
  if (config.app.port < 1 || config.app.port > 65535) {
    throw new Error('Invalid port number');
  }
  
  if (config.jwt.secret && config.jwt.secret.length < 32) {
    console.warn('JWT secret should be at least 32 characters long for security');
  }
};

// Get nested object value by dot notation
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current && current[key], obj);
};

// Load and export configuration
const config = loadEnvironmentConfig();

// Create logs directory if it doesn't exist
if (config.logging.file) {
  const logDir = path.dirname(config.logging.file);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

// Create upload directory if it doesn't exist
if (config.upload.path && !fs.existsSync(config.upload.path)) {
  fs.mkdirSync(config.upload.path, { recursive: true });
}

module.exports = config;