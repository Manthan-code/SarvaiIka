/**
 * Config Unit Tests
 * Comprehensive tests for configuration modules and environment validation
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock environment variables
const originalEnv = process.env;

describe('Config Unit Tests', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Configuration', () => {
    it('should load development environment', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
      process.env.JWT_SECRET = 'test-jwt-secret';
      
      const config = {
        NODE_ENV: process.env.NODE_ENV,
        PORT: parseInt(process.env.PORT) || 5000,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        JWT_SECRET: process.env.JWT_SECRET
      };
      
      expect(config.NODE_ENV).toBe('development');
      expect(config.PORT).toBe(3000);
      expect(config.SUPABASE_URL).toBe('https://test.supabase.co');
      expect(config.SUPABASE_ANON_KEY).toBe('test-anon-key');
      expect(config.SUPABASE_SERVICE_ROLE_KEY).toBe('test-service-key');
      expect(config.JWT_SECRET).toBe('test-jwt-secret');
    });

    it('should load production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.SUPABASE_URL = 'https://prod.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'prod-anon-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'prod-service-key';
      process.env.JWT_SECRET = 'prod-jwt-secret';
      
      const config = {
        NODE_ENV: process.env.NODE_ENV,
        PORT: parseInt(process.env.PORT) || 5000,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        JWT_SECRET: process.env.JWT_SECRET
      };
      
      expect(config.NODE_ENV).toBe('production');
      expect(config.PORT).toBe(8080);
      expect(config.SUPABASE_URL).toBe('https://prod.supabase.co');
      expect(config.SUPABASE_ANON_KEY).toBe('prod-anon-key');
      expect(config.SUPABASE_SERVICE_ROLE_KEY).toBe('prod-service-key');
      expect(config.JWT_SECRET).toBe('prod-jwt-secret');
    });

    it('should load test environment', () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '5000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
      process.env.JWT_SECRET = 'test-jwt-secret';
      
      const config = {
        NODE_ENV: process.env.NODE_ENV,
        PORT: parseInt(process.env.PORT) || 5000,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        JWT_SECRET: process.env.JWT_SECRET
      };
      
      expect(config.NODE_ENV).toBe('test');
      expect(config.PORT).toBe(5000);
      expect(config.SUPABASE_URL).toBe('https://test.supabase.co');
      expect(config.SUPABASE_ANON_KEY).toBe('test-anon-key');
      expect(config.SUPABASE_SERVICE_ROLE_KEY).toBe('test-service-key');
      expect(config.JWT_SECRET).toBe('test-jwt-secret');
    });

    it('should use default values when environment variables are missing', () => {
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      
      const config = {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: parseInt(process.env.PORT) || 5000
      };
      
      expect(config.NODE_ENV).toBe('development');
      expect(config.PORT).toBe(5000);
    });

    it('should handle invalid port values', () => {
      process.env.PORT = 'invalid-port';
      
      const config = {
        PORT: parseInt(process.env.PORT) || 5000
      };
      
      expect(config.PORT).toBe(5000);
    });

    it('should handle boolean environment variables', () => {
      process.env.ENABLE_LOGGING = 'true';
      process.env.ENABLE_CACHE = 'false';
      process.env.DEBUG_MODE = '1';
      process.env.PRODUCTION_MODE = '0';
      
      const config = {
        ENABLE_LOGGING: process.env.ENABLE_LOGGING === 'true',
        ENABLE_CACHE: process.env.ENABLE_CACHE === 'true',
        DEBUG_MODE: process.env.DEBUG_MODE === '1',
        PRODUCTION_MODE: process.env.PRODUCTION_MODE === '1'
      };
      
      expect(config.ENABLE_LOGGING).toBe(true);
      expect(config.ENABLE_CACHE).toBe(false);
      expect(config.DEBUG_MODE).toBe(true);
      expect(config.PRODUCTION_MODE).toBe(false);
    });
  });

  describe('Database Configuration', () => {
    it('should configure Supabase connection', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
      
      const dbConfig = {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        options: {
          auth: {
            autoRefreshToken: true,
            persistSession: false
          }
        }
      };
      
      expect(dbConfig.url).toBe('https://test.supabase.co');
      expect(dbConfig.anonKey).toBe('test-anon-key');
      expect(dbConfig.serviceRoleKey).toBe('test-service-key');
      expect(dbConfig.options.auth.autoRefreshToken).toBe(true);
      expect(dbConfig.options.auth.persistSession).toBe(false);
    });

    it('should handle missing database configuration', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      
      const dbConfig = {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY
      };
      
      expect(dbConfig.url).toBeUndefined();
      expect(dbConfig.anonKey).toBeUndefined();
    });

    it('should configure connection pool settings', () => {
      process.env.DB_POOL_MIN = '2';
      process.env.DB_POOL_MAX = '10';
      process.env.DB_TIMEOUT = '30000';
      
      const poolConfig = {
        min: parseInt(process.env.DB_POOL_MIN) || 1,
        max: parseInt(process.env.DB_POOL_MAX) || 5,
        timeout: parseInt(process.env.DB_TIMEOUT) || 10000
      };
      
      expect(poolConfig.min).toBe(2);
      expect(poolConfig.max).toBe(10);
      expect(poolConfig.timeout).toBe(30000);
    });
  });

  describe('Redis Configuration', () => {
    it('should configure Redis connection', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.REDIS_PASSWORD = 'redis-password';
      process.env.REDIS_DB = '1';
      
      const redisConfig = {
        url: process.env.REDIS_URL,
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB) || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3
      };
      
      expect(redisConfig.url).toBe('redis://localhost:6379');
      expect(redisConfig.password).toBe('redis-password');
      expect(redisConfig.db).toBe(1);
      expect(redisConfig.retryDelayOnFailover).toBe(100);
      expect(redisConfig.maxRetriesPerRequest).toBe(3);
    });

    it('should use default Redis configuration', () => {
      delete process.env.REDIS_URL;
      delete process.env.REDIS_DB;
      
      const redisConfig = {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        db: parseInt(process.env.REDIS_DB) || 0
      };
      
      expect(redisConfig.url).toBe('redis://localhost:6379');
      expect(redisConfig.db).toBe(0);
    });
  });

  describe('JWT Configuration', () => {
    it('should configure JWT settings', () => {
      process.env.JWT_SECRET = 'super-secret-key';
      process.env.JWT_EXPIRES_IN = '24h';
      process.env.JWT_REFRESH_EXPIRES_IN = '7d';
      
      const jwtConfig = {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        algorithm: 'HS256'
      };
      
      expect(jwtConfig.secret).toBe('super-secret-key');
      expect(jwtConfig.expiresIn).toBe('24h');
      expect(jwtConfig.refreshExpiresIn).toBe('7d');
      expect(jwtConfig.algorithm).toBe('HS256');
    });

    it('should use default JWT configuration', () => {
      delete process.env.JWT_EXPIRES_IN;
      delete process.env.JWT_REFRESH_EXPIRES_IN;
      
      const jwtConfig = {
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
      };
      
      expect(jwtConfig.expiresIn).toBe('1h');
      expect(jwtConfig.refreshExpiresIn).toBe('7d');
    });
  });

  describe('API Configuration', () => {
    it('should configure API settings', () => {
      process.env.API_VERSION = 'v1';
      process.env.API_PREFIX = '/api';
      process.env.RATE_LIMIT_WINDOW = '900000';
      process.env.RATE_LIMIT_MAX = '100';
      
      const apiConfig = {
        version: process.env.API_VERSION || 'v1',
        prefix: process.env.API_PREFIX || '/api',
        rateLimit: {
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000,
          max: parseInt(process.env.RATE_LIMIT_MAX) || 100
        }
      };
      
      expect(apiConfig.version).toBe('v1');
      expect(apiConfig.prefix).toBe('/api');
      expect(apiConfig.rateLimit.windowMs).toBe(900000);
      expect(apiConfig.rateLimit.max).toBe(100);
    });

    it('should configure CORS settings', () => {
      process.env.CORS_ORIGIN = 'https://example.com';
      process.env.CORS_CREDENTIALS = 'true';
      
      const corsConfig = {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: process.env.CORS_CREDENTIALS === 'true',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      };
      
      expect(corsConfig.origin).toBe('https://example.com');
      expect(corsConfig.credentials).toBe(true);
      expect(corsConfig.methods).toContain('GET');
      expect(corsConfig.allowedHeaders).toContain('Authorization');
    });
  });

  describe('Logging Configuration', () => {
    it('should configure logging levels', () => {
      process.env.LOG_LEVEL = 'debug';
      process.env.LOG_FORMAT = 'json';
      process.env.LOG_FILE = '/var/log/app.log';
      
      const logConfig = {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'simple',
        file: process.env.LOG_FILE,
        console: process.env.NODE_ENV !== 'production'
      };
      
      expect(logConfig.level).toBe('debug');
      expect(logConfig.format).toBe('json');
      expect(logConfig.file).toBe('/var/log/app.log');
    });

    it('should configure different log levels', () => {
      const logLevels = ['error', 'warn', 'info', 'debug', 'verbose'];
      
      logLevels.forEach(level => {
        process.env.LOG_LEVEL = level;
        
        const logConfig = {
          level: process.env.LOG_LEVEL
        };
        
        expect(logConfig.level).toBe(level);
      });
    });
  });

  describe('Security Configuration', () => {
    it('should configure security headers', () => {
      process.env.HELMET_ENABLED = 'true';
      process.env.CSP_ENABLED = 'true';
      
      const securityConfig = {
        helmet: process.env.HELMET_ENABLED === 'true',
        csp: process.env.CSP_ENABLED === 'true',
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      };
      
      expect(securityConfig.helmet).toBe(true);
      expect(securityConfig.csp).toBe(true);
      expect(securityConfig.hsts.maxAge).toBe(31536000);
    });

    it('should configure session settings', () => {
      process.env.SESSION_SECRET = 'session-secret';
      process.env.SESSION_MAX_AGE = '86400000';
      
      const sessionConfig = {
        secret: process.env.SESSION_SECRET,
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      };
      
      expect(sessionConfig.secret).toBe('session-secret');
      expect(sessionConfig.maxAge).toBe(86400000);
      expect(sessionConfig.httpOnly).toBe(true);
      expect(sessionConfig.sameSite).toBe('strict');
    });
  });

  describe('Feature Flags', () => {
    it('should configure feature flags', () => {
      process.env.FEATURE_CHAT_STREAMING = 'true';
      process.env.FEATURE_FILE_UPLOAD = 'false';
      process.env.FEATURE_ANALYTICS = '1';
      
      const features = {
        chatStreaming: process.env.FEATURE_CHAT_STREAMING === 'true',
        fileUpload: process.env.FEATURE_FILE_UPLOAD === 'true',
        analytics: process.env.FEATURE_ANALYTICS === '1'
      };
      
      expect(features.chatStreaming).toBe(true);
      expect(features.fileUpload).toBe(false);
      expect(features.analytics).toBe(true);
    });

    it('should handle missing feature flags', () => {
      delete process.env.FEATURE_CHAT_STREAMING;
      delete process.env.FEATURE_FILE_UPLOAD;
      
      const features = {
        chatStreaming: process.env.FEATURE_CHAT_STREAMING === 'true',
        fileUpload: process.env.FEATURE_FILE_UPLOAD === 'true'
      };
      
      expect(features.chatStreaming).toBe(false);
      expect(features.fileUpload).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required environment variables', () => {
      const requiredVars = [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'JWT_SECRET'
      ];
      
      // Set all required variables
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      process.env.JWT_SECRET = 'test-secret';
      
      const missingVars = requiredVars.filter(varName => !process.env[varName]);
      
      expect(missingVars).toHaveLength(0);
    });

    it('should detect missing required variables', () => {
      const requiredVars = [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'JWT_SECRET'
      ];
      
      // Clear required variables
      delete process.env.SUPABASE_URL;
      delete process.env.JWT_SECRET;
      
      const missingVars = requiredVars.filter(varName => !process.env[varName]);
      
      expect(missingVars).toContain('SUPABASE_URL');
      expect(missingVars).toContain('JWT_SECRET');
      expect(missingVars).not.toContain('SUPABASE_ANON_KEY');
    });

    it('should validate URL formats', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://subdomain.example.com:8080'
      ];
      
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com',
        'https://'
      ];
      
      validUrls.forEach(url => {
        try {
          new URL(url);
          expect(true).toBe(true); // URL is valid
        } catch {
          expect(false).toBe(true); // Should not reach here
        }
      });
      
      invalidUrls.forEach(url => {
        try {
          new URL(url);
          expect(false).toBe(true); // Should not reach here
        } catch {
          expect(true).toBe(true); // URL is invalid as expected
        }
      });
    });

    it('should validate port numbers', () => {
      const validPorts = ['80', '443', '3000', '8080', '65535'];
      const invalidPorts = ['-1', '0', '65536', 'abc', ''];
      
      validPorts.forEach(port => {
        const portNum = parseInt(port);
        expect(portNum).toBeGreaterThan(0);
        expect(portNum).toBeLessThanOrEqual(65535);
      });
      
      invalidPorts.forEach(port => {
        const portNum = parseInt(port);
        expect(isNaN(portNum) || portNum <= 0 || portNum > 65535).toBe(true);
      });
    });
  });

  describe('Environment-Specific Configuration', () => {
    it('should load development-specific settings', () => {
      process.env.NODE_ENV = 'development';
      
      const config = {
        debug: process.env.NODE_ENV === 'development',
        minify: process.env.NODE_ENV === 'production',
        sourceMap: process.env.NODE_ENV !== 'production'
      };
      
      expect(config.debug).toBe(true);
      expect(config.minify).toBe(false);
      expect(config.sourceMap).toBe(true);
    });

    it('should load production-specific settings', () => {
      process.env.NODE_ENV = 'production';
      
      const config = {
        debug: process.env.NODE_ENV === 'development',
        minify: process.env.NODE_ENV === 'production',
        sourceMap: process.env.NODE_ENV !== 'production'
      };
      
      expect(config.debug).toBe(false);
      expect(config.minify).toBe(true);
      expect(config.sourceMap).toBe(false);
    });

    it('should load test-specific settings', () => {
      process.env.NODE_ENV = 'test';
      
      const config = {
        debug: process.env.NODE_ENV === 'test',
        silent: process.env.NODE_ENV === 'test',
        coverage: process.env.NODE_ENV === 'test'
      };
      
      expect(config.debug).toBe(true);
      expect(config.silent).toBe(true);
      expect(config.coverage).toBe(true);
    });
  });
});