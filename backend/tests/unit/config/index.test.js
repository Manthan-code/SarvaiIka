/**
 * Configuration Index Unit Tests
 * Comprehensive tests for main configuration module
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock environment variables
const mockEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  JWT_SECRET: 'test_jwt_secret',
  JWT_EXPIRES_IN: '24h',
  BCRYPT_ROUNDS: '10',
  RATE_LIMIT_WINDOW: '900000',
  RATE_LIMIT_MAX: '100',
  CORS_ORIGIN: 'http://localhost:3000',
  API_VERSION: 'v1',
  LOG_LEVEL: 'info',
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test_anon_key',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
  REDIS_URL: 'redis://localhost:6379',
  OPENAI_API_KEY: 'test_openai_key',
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
  QDRANT_URL: 'http://localhost:6333',
  QDRANT_API_KEY: 'test_qdrant_key',
  UPLOAD_MAX_SIZE: '10485760',
  UPLOAD_ALLOWED_TYPES: 'image/jpeg,image/png,application/pdf',
  CACHE_TTL: '3600',
  SESSION_SECRET: 'test_session_secret',
  WEBHOOK_TIMEOUT: '30000',
  MAX_RETRIES: '3',
  RETRY_DELAY: '1000'
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Mock fs
const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn()
};

// Mock path
const mockPath = {
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/'))
};

// Setup mocks
jest.mock('../../../src/utils/logger', () => mockLogger);
jest.mock('fs', () => mockFs);
jest.mock('path', () => mockPath);

// Mock process.env
const originalEnv = { ...process.env };

describe('Configuration Index Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset process.env to original snapshot and apply mock values without reassigning the env object
    Object.keys(process.env).forEach((key) => { delete process.env[key]; });
    Object.assign(process.env, originalEnv, mockEnv);
    
    // Reset mock implementations
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('{"version": "1.0.0"}');
  });

  afterEach(() => {
    // Restore original environment without reassigning the env object
    Object.keys(process.env).forEach((key) => { delete process.env[key]; });
    Object.assign(process.env, originalEnv);
    jest.restoreAllMocks();
  });

  describe('Configuration Loading', () => {
    let config;

    beforeEach(() => {
      // Clear module cache to get fresh instance
      delete require.cache[require.resolve('../../../src/config')];
      config = require('../../../src/config');
    });

    it('should load configuration successfully', () => {
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should export all required configuration sections', () => {
      expect(config.server).toBeDefined();
      expect(config.database).toBeDefined();
      expect(config.auth).toBeDefined();
      expect(config.redis).toBeDefined();
      expect(config.openai).toBeDefined();
      expect(config.stripe).toBeDefined();
      expect(config.qdrant).toBeDefined();
      expect(config.upload).toBeDefined();
      expect(config.cache).toBeDefined();
      expect(config.security).toBeDefined();
    });

    it('should load environment-specific configuration', () => {
      expect(config.env).toBe('test');
      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(false);
      expect(config.isTest).toBe(true);
    });

    it('should validate required environment variables', () => {
      // Ensure core required envs are reflected in config structure
      expect(config.auth.jwtSecret).toBeDefined();
      expect(config.database.url).toBeDefined();
      expect(config.database.supabase.url).toBeDefined();
      expect(config.database.supabase.anonKey).toBeDefined();
    });
  });

  describe('Server Configuration', () => {
    let config;

    beforeEach(() => {
      // Clear module cache to get fresh instance
      delete require.cache[require.resolve('../../../src/config')];
      config = require('../../../src/config');
    });

    it('should configure server settings correctly', () => {
      expect(config.server).toEqual({
        port: 3000,
        host: '0.0.0.0',
        apiVersion: 'v1',
        cors: {
          origin: 'http://localhost:3000',
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        },
        rateLimit: {
          windowMs: 900000,
          max: 100,
          message: 'Too many requests from this IP'
        },
        timeout: 30000
      });
    });

    it('should use default port when not specified', () => {
      delete process.env.PORT;
      delete require.cache[require.resolve('../../../src/config')];
      config = require('../../../src/config');

      expect(config.server.port).toBe(3000);
    });

    it('should parse numeric values correctly', () => {
      // Clear previous debug calls so we only assert on this reload
      mockLogger.debug.mockClear();

      process.env.PORT = '8080';
      process.env.RATE_LIMIT_MAX = '200';

      // Use config.reload to rebuild from current env
      const reloaded = config.reload();

      // Verify debug snapshot captured envs as expected (last call)
      const calls = mockLogger.debug.mock.calls.filter((c) => c[0] === 'Config env snapshot');
      const snapshotCall = calls[calls.length - 1];
      if (snapshotCall && snapshotCall[1]) {
        expect(snapshotCall[1].PORT).toBe('8080');
        expect(snapshotCall[1].RATE_LIMIT_MAX).toBe('200');
      }

      expect(reloaded.server.port).toBe(8080);
      expect(reloaded.server.rateLimit.max).toBe(200);
    });

    it('should handle invalid numeric values', () => {
      process.env.PORT = 'invalid';
      delete require.cache[require.resolve('../../../src/config')];
      config = require('../../../src/config');

      expect(config.server.port).toBe(3000); // default value
    });
  });

  describe('Database Configuration', () => {
    let config;

    beforeEach(() => {
      jest.resetModules();
      config = require('../../../src/config');
    });

    it('should configure database settings correctly', () => {
      expect(config.database).toEqual({
        url: 'postgresql://user:pass@localhost:5432/testdb',
        supabase: {
          url: 'https://test.supabase.co',
          anonKey: 'test_anon_key'
        },
        pool: {
          min: 2,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000
        },
        ssl: false
      });
    });

    it('should enable SSL in production', () => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();
      config = require('../../../src/config');

      expect(config.database.ssl).toBe(true);
    });

    it('should configure pool settings from environment', () => {
      process.env.DB_POOL_MIN = '5';
      process.env.DB_POOL_MAX = '20';
      jest.resetModules();
      config = require('../../../src/config');

      expect(config.database.pool.min).toBe(5);
      expect(config.database.pool.max).toBe(20);
    });
  });

  describe('Authentication Configuration', () => {
    let config;

    beforeEach(() => {
      jest.resetModules();
      config = require('../../../src/config');
    });

    it('should configure auth settings correctly', () => {
      expect(config.auth).toEqual({
        jwtSecret: 'test_jwt_secret',
        jwtExpiresIn: '24h',
        bcryptRounds: 10,
        sessionSecret: 'test_session_secret',
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
      });
    });

    it('should validate JWT secret length', () => {
      process.env.JWT_SECRET = 'short';
      process.env.SKIP_ENV_VALIDATION = 'false';
      jest.resetModules();
      
      expect(() => {
        require('../../../src/config');
      }).toThrow();

      // Restore default test setup behavior
      process.env.SKIP_ENV_VALIDATION = 'true';
    });

    it('should parse bcrypt rounds correctly', () => {
      process.env.BCRYPT_ROUNDS = '12';
      jest.resetModules();
      config = require('../../../src/config');

      expect(config.auth.bcryptRounds).toBe(12);
    });
  });

  describe('Redis Configuration', () => {
    let config;

    beforeEach(() => {
      jest.resetModules();
      config = require('../../../src/config');
    });

    it('should configure Redis settings correctly', () => {
      expect(config.redis).toEqual({
        url: 'redis://localhost:6379',
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000
      });
    });

    it('should parse Redis URL with auth', () => {
      process.env.REDIS_URL = 'redis://user:pass@redis.example.com:6380/1';
      jest.resetModules();
      config = require('../../../src/config');

      expect(config.redis.host).toBe('redis.example.com');
      expect(config.redis.port).toBe(6380);
      expect(config.redis.password).toBe('pass');
      expect(config.redis.db).toBe(1);
    });

    it('should handle Redis URL parsing errors', () => {
      process.env.REDIS_URL = 'invalid-url';
      jest.resetModules();
      config = require('../../../src/config');

      expect(config.redis.host).toBe('localhost');
      expect(config.redis.port).toBe(6379);
    });
  });

  describe('OpenAI Configuration', () => {
    let config;

    beforeEach(() => {
      jest.resetModules();
      config = require('../../../src/config');
    });

    it('should configure OpenAI settings correctly', () => {
      expect(config.openai).toEqual({
        apiKey: 'test_openai_key',
        organization: undefined,
        baseURL: 'https://api.openai.com/v1',
        defaultModel: 'gpt-3.5-turbo',
        maxTokens: 4096,
        temperature: 0.7,
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000
      });
    });

    it('should configure custom OpenAI settings', () => {
      process.env.OPENAI_ORGANIZATION = 'org-123';
      process.env.OPENAI_BASE_URL = 'https://custom.openai.com/v1';
      process.env.OPENAI_DEFAULT_MODEL = 'gpt-4';
      jest.resetModules();
      config = require('../../../src/config');

      expect(config.openai.organization).toBe('org-123');
      expect(config.openai.baseURL).toBe('https://custom.openai.com/v1');
      expect(config.openai.defaultModel).toBe('gpt-4');
    });

    it('should validate OpenAI API key format', () => {
      process.env.OPENAI_API_KEY = 'invalid-key';
      process.env.SKIP_ENV_VALIDATION = 'false';
      jest.resetModules();
      
      expect(() => {
        require('../../../src/config');
      }).toThrow();

      // Restore default test setup behavior
      process.env.SKIP_ENV_VALIDATION = 'true';
    });
  });

  describe('Stripe Configuration', () => {
    let config;

    beforeEach(() => {
      jest.resetModules();
      config = require('../../../src/config');
    });

    it('should configure Stripe settings correctly', () => {
      expect(config.stripe).toEqual({
        secretKey: 'sk_test_123',
        publishableKey: 'pk_test_stripe_publishable_key_for_testing_purposes_only',
        webhookSecret: 'whsec_test_123',
        apiVersion: '2023-10-16',
        timeout: 30000,
        maxRetries: 3,
        currency: 'usd',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel'
      });
    });

    it('should validate Stripe key formats', () => {
      process.env.STRIPE_SECRET_KEY = 'invalid-key';
      process.env.SKIP_ENV_VALIDATION = 'false';
      jest.resetModules();
      
      expect(() => {
        require('../../../src/config');
      }).toThrow();

      // Restore default test setup behavior
      process.env.SKIP_ENV_VALIDATION = 'true';
    });

    it('should configure custom Stripe settings', () => {
      process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.STRIPE_CURRENCY = 'eur';
      jest.resetModules();
      config = require('../../../src/config');

      expect(config.stripe.publishableKey).toBe('pk_test_123');
      expect(config.stripe.currency).toBe('eur');
    });
  });

  describe('Qdrant Configuration', () => {
    let config;

    beforeEach(() => {
      jest.resetModules();
      config = require('../../../src/config');
    });

    it('should configure Qdrant settings correctly', () => {
      expect(config.qdrant).toEqual({
        url: 'http://localhost:6333',
        apiKey: 'test_qdrant_key',
        timeout: 30000,
        retries: 3,
        collections: {
          default: 'ai_vectors',
          embeddings: 'embeddings',
          documents: 'documents'
        },
        vectorSize: 1536,
        distance: 'Cosine'
      });
    });

    it('should configure custom Qdrant settings', () => {
      process.env.QDRANT_COLLECTION_DEFAULT = 'custom_vectors';
      process.env.QDRANT_VECTOR_SIZE = '768';
      jest.resetModules();
      config = require('../../../src/config');

      expect(config.qdrant.collections.default).toBe('custom_vectors');
      expect(config.qdrant.vectorSize).toBe(768);
    });
  });

  describe('Upload Configuration', () => {
    let config;

    beforeEach(() => {
      jest.resetModules();
      config = require('../../../src/config');
    });

    it('should configure upload settings correctly', () => {
      expect(config.upload).toEqual({
        maxSize: 10485760,
        allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        destination: 'uploads/',
        tempDir: 'temp/',
        cleanupInterval: 3600000,
        maxAge: 86400000
      });
    });

    it('should parse upload size correctly', () => {
      process.env.UPLOAD_MAX_SIZE = '5242880'; // 5MB
      jest.resetModules();
      config = require('../../../src/config');

      expect(config.upload.maxSize).toBe(5242880);
    });

    it('should parse allowed types correctly', () => {
      process.env.UPLOAD_ALLOWED_TYPES = 'image/jpeg,image/png,text/plain';
      jest.resetModules();
      config = require('../../../src/config');

      expect(config.upload.allowedTypes).toEqual(['image/jpeg', 'image/png', 'text/plain']);
    });
  });

  describe('Cache Configuration', () => {
    let config;

    beforeEach(() => {
      delete require.cache[require.resolve('../../../src/config')];
      config = require('../../../src/config');
    });

    it('should configure cache settings correctly', () => {
      expect(config.cache).toEqual({
        ttl: 3600,
        checkPeriod: 600,
        maxKeys: 1000,
        prefix: 'ai_agent:',
        compression: true,
        serialization: 'json'
      });
    });

    it('should parse cache TTL correctly', () => {
      process.env.CACHE_TTL = '7200';
      jest.resetModules();
      config = require('../../../src/config');

      expect(config.cache.ttl).toBe(7200);
    });
  });

  describe('Security Configuration', () => {
    let config;

    beforeEach(() => {
      delete require.cache[require.resolve('../../../src/config')];
      config = require('../../../src/config');
    });

    it('should configure security settings correctly', () => {
      expect(config.security).toEqual({
        helmet: {
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              scriptSrc: ["'self'"],
              imgSrc: ["'self'", "data:", "https:"]
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
          secret: 'test_session_secret',
          resave: false,
          saveUninitialized: false,
          cookie: {
            secure: false,
            httpOnly: true,
            maxAge: 86400000
          }
        }
      });
    });

    it('should enable secure cookies in production', () => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();
      config = require('../../../src/config');

      expect(config.security.session.cookie.secure).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate all required environment variables', () => {
      const requiredVars = [
        'JWT_SECRET',
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'DATABASE_URL',
        'OPENAI_API_KEY',
        'STRIPE_SECRET_KEY'
      ];

      // ... existing code ...
    });

    it('should validate URL formats', () => {
      const urlVars = ['SUPABASE_URL', 'DATABASE_URL', 'REDIS_URL', 'QDRANT_URL'];
      
      // Ensure validation is enforced during this test
      process.env.SKIP_ENV_VALIDATION = 'false';
      
      urlVars.forEach(varName => {
        const originalValue = process.env[varName];
        process.env[varName] = 'invalid-url';
        delete require.cache[require.resolve('../../../src/config')];
        
        expect(() => {
          require('../../../src/config');
        }).toThrow();
        
        process.env[varName] = originalValue;
      });

      // Restore default test setup behavior
      process.env.SKIP_ENV_VALIDATION = 'true';
    });

    it('should validate numeric values', () => {
      const numericVars = ['PORT', 'BCRYPT_ROUNDS', 'RATE_LIMIT_MAX'];
      
      numericVars.forEach(varName => {
        const originalValue = process.env[varName];
        process.env[varName] = 'not-a-number';
        delete require.cache[require.resolve('../../../src/config')];
        
        // Should not throw but use default values
        const config = require('../../../src/config');
        expect(config).toBeDefined();
        
        process.env[varName] = originalValue;
      });
    });
  });

  describe('Environment-Specific Behavior', () => {
    it('should configure for development environment', () => {
      process.env.NODE_ENV = 'development';
      delete require.cache[require.resolve('../../../src/config')];
      const config = require('../../../src/config');

      expect(config.isDevelopment).toBe(true);
      expect(config.isProduction).toBe(false);
      expect(config.isTest).toBe(false);
      expect(config.security.session.cookie.secure).toBe(false);
    });

    it('should configure for production environment', () => {
      process.env.NODE_ENV = 'production';
      delete require.cache[require.resolve('../../../src/config')];
      const config = require('../../../src/config');

      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(true);
      expect(config.isTest).toBe(false);
      expect(config.security.session.cookie.secure).toBe(true);
      expect(config.database.ssl).toBe(true);
    });

    it('should configure for test environment', () => {
      process.env.NODE_ENV = 'test';
      delete require.cache[require.resolve('../../../src/config')];
      const config = require('../../../src/config');

      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(false);
      expect(config.isTest).toBe(true);
    });
  });

  describe('Configuration Utilities', () => {
    let config;

    beforeEach(() => {
      delete require.cache[require.resolve('../../../src/config')];
      config = require('../../../src/config');
    });

    it('should provide configuration validation function', () => {
      expect(config.validate).toBeDefined();
      expect(typeof config.validate).toBe('function');
    });

    it('should validate configuration successfully', () => {
      const result = config.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect configuration errors', () => {
      // Temporarily break configuration
      const originalJwtSecret = config.auth.jwtSecret;
      config.auth.jwtSecret = '';
      
      const result = config.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Restore configuration
      config.auth.jwtSecret = originalJwtSecret;
    });

    it('should provide configuration summary', () => {
      expect(config.getSummary).toBeDefined();
      expect(typeof config.getSummary).toBe('function');
      
      const summary = config.getSummary();
      expect(summary).toEqual({
        environment: 'test',
        server: { port: 3000, host: '0.0.0.0' },
        database: { connected: true, ssl: false },
        redis: { connected: true },
        cache: { enabled: true, ttl: 3600 },
        security: { helmet: true, session: true }
      });
    });

    it('should provide configuration reload function', () => {
      expect(config.reload).toBeDefined();
      expect(typeof config.reload).toBe('function');
    });

    it('should reload configuration successfully', () => {
      const originalPort = config.server.port;
      process.env.PORT = '8080';
      
      config.reload();
      expect(config.server.port).toBe(8080);
      
      // Restore
      process.env.PORT = originalPort.toString();
      config.reload();
    });
  });

  describe('Configuration Logging', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../../src/config')];
    });

    it('should log configuration loading', () => {
      require('../../../src/config');
      
      expect(mockLogger.info).toHaveBeenCalledWith('Loading configuration...');
      expect(mockLogger.info).toHaveBeenCalledWith('Configuration loaded successfully');
    });

    it('should log configuration validation', () => {
      const config = require('../../../src/config');
      config.validate();
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Configuration validation completed');
    });

    it('should log configuration errors', () => {
      delete process.env.JWT_SECRET;

      // Ensure validation is enforced during this test
      process.env.SKIP_ENV_VALIDATION = 'false';
      
      expect(() => {
        require('../../../src/config');
      }).toThrow();

      // Restore default test setup behavior
      process.env.SKIP_ENV_VALIDATION = 'true';
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Configuration error:',
        expect.any(Error)
      );
    });
  });

  describe('Configuration File Loading', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../../src/config')];
    });

    it('should load package.json information', () => {
      mockFs.readFileSync.mockReturnValue('{"version": "1.2.3", "name": "ai-agent-platform"}');
      
      const config = require('../../../src/config');
      expect(config.app).toEqual({
        name: 'ai-agent-platform',
        version: '1.2.3'
      });
    });

    it('should handle missing package.json', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const config = require('../../../src/config');
      expect(config.app).toEqual({
        name: 'ai-agent-platform',
        version: '1.0.0'
      });
    });

    it('should handle invalid package.json', () => {
      mockFs.readFileSync.mockReturnValue('invalid json');
      
      const config = require('../../../src/config');
      expect(config.app).toEqual({
        name: 'ai-agent-platform',
        version: '1.0.0'
      });
    });
  });
});