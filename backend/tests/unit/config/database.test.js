/**
 * Database Configuration Unit Tests
 * Comprehensive tests for database configuration and connection handling
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock environment variables
const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test_anon_key',
  SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_key',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
  NODE_ENV: 'test',
  DB_POOL_MIN: '2',
  DB_POOL_MAX: '10',
  DB_TIMEOUT: '30000',
  DB_SSL: 'false'
};

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    then: jest.fn().mockResolvedValue({ data: [], error: null })
  })),
  auth: {
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn()
  },
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      download: jest.fn(),
      remove: jest.fn()
    }))
  },
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn()
  })),
  removeChannel: jest.fn()
};

// Mock createClient function
const mockCreateClient = jest.fn(() => mockSupabaseClient);

// Mock pg Pool
const mockPool = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
  on: jest.fn(),
  totalCount: 0,
  idleCount: 0,
  waitingCount: 0
};

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
  on: jest.fn()
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Setup mocks
jest.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient
}));

jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPool),
  Client: jest.fn(() => mockClient)
}));

jest.mock('../../src/utils/logger', () => mockLogger);

// Mock process.env
const originalEnv = process.env;

describe('Database Configuration Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, ...mockEnv };
    
    // Reset mock implementations
    mockPool.connect.mockResolvedValue(mockClient);
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('Supabase Configuration', () => {
    let database;

    beforeEach(() => {
      // Clear module cache to get fresh instance
      delete require.cache[require.resolve('../../src/config/database')];
      database = require('../../src/config/database');
    });

    it('should create Supabase client with correct configuration', () => {
      expect(mockCreateClient).toHaveBeenCalledWith(
        mockEnv.SUPABASE_URL,
        mockEnv.SUPABASE_ANON_KEY,
        expect.objectContaining({
          auth: expect.objectContaining({
            autoRefreshToken: true,
            persistSession: false
          })
        })
      );
    });

    it('should create service role client with correct configuration', () => {
      expect(mockCreateClient).toHaveBeenCalledWith(
        mockEnv.SUPABASE_URL,
        mockEnv.SUPABASE_SERVICE_ROLE_KEY,
        expect.objectContaining({
          auth: expect.objectContaining({
            autoRefreshToken: false,
            persistSession: false
          })
        })
      );
    });

    it('should export supabase client', () => {
      expect(database.supabase).toBeDefined();
      expect(database.supabase).toBe(mockSupabaseClient);
    });

    it('should export service role client', () => {
      expect(database.supabaseServiceRole).toBeDefined();
      expect(database.supabaseServiceRole).toBe(mockSupabaseClient);
    });

    it('should handle missing Supabase URL', () => {
      delete process.env.SUPABASE_URL;
      delete require.cache[require.resolve('../../src/config/database')];
      
      expect(() => {
        require('../../src/config/database');
      }).toThrow();
    });

    it('should handle missing Supabase keys', () => {
      delete process.env.SUPABASE_ANON_KEY;
      delete require.cache[require.resolve('../../src/config/database')];
      
      expect(() => {
        require('../../src/config/database');
      }).toThrow();
    });

    it('should configure client options correctly', () => {
      const expectedOptions = expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: expect.any(Boolean),
          persistSession: expect.any(Boolean)
        }),
        realtime: expect.objectContaining({
          params: expect.objectContaining({
            eventsPerSecond: expect.any(Number)
          })
        })
      });

      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expectedOptions
      );
    });
  });

  describe('PostgreSQL Pool Configuration', () => {
    let database;

    beforeEach(() => {
      delete require.cache[require.resolve('../../src/config/database')];
      database = require('../../src/config/database');
    });

    it('should create PostgreSQL pool with correct configuration', () => {
      const { Pool } = require('pg');
      
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        connectionString: mockEnv.DATABASE_URL,
        min: parseInt(mockEnv.DB_POOL_MIN),
        max: parseInt(mockEnv.DB_POOL_MAX),
        idleTimeoutMillis: parseInt(mockEnv.DB_TIMEOUT),
        ssl: false
      }));
    });

    it('should export PostgreSQL pool', () => {
      expect(database.pool).toBeDefined();
      expect(database.pool).toBe(mockPool);
    });

    it('should handle SSL configuration', () => {
      process.env.DB_SSL = 'true';
      delete require.cache[require.resolve('../../src/config/database')];
      require('../../src/config/database');

      const { Pool } = require('pg');
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        ssl: { rejectUnauthorized: false }
      }));
    });

    it('should use default pool settings when env vars missing', () => {
      delete process.env.DB_POOL_MIN;
      delete process.env.DB_POOL_MAX;
      delete process.env.DB_TIMEOUT;
      delete require.cache[require.resolve('../../src/config/database')];
      require('../../src/config/database');

      const { Pool } = require('pg');
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000
      }));
    });

    it('should handle missing DATABASE_URL', () => {
      delete process.env.DATABASE_URL;
      delete require.cache[require.resolve('../../src/config/database')];
      
      expect(() => {
        require('../../src/config/database');
      }).toThrow();
    });
  });

  describe('Database Connection Management', () => {
    let database;

    beforeEach(() => {
      delete require.cache[require.resolve('../../src/config/database')];
      database = require('../../src/config/database');
    });

    it('should provide connection testing function', async () => {
      expect(database.testConnection).toBeDefined();
      expect(typeof database.testConnection).toBe('function');
    });

    it('should test Supabase connection successfully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });

      const result = await database.testConnection();
      expect(result.supabase).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Supabase connection test successful');
    });

    it('should handle Supabase connection errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ 
            data: null, 
            error: { message: 'Connection failed' }
          })
        })
      });

      const result = await database.testConnection();
      expect(result.supabase).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Supabase connection test failed:',
        expect.any(Object)
      );
    });

    it('should test PostgreSQL connection successfully', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ now: new Date() }] });

      const result = await database.testConnection();
      expect(result.postgresql).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('PostgreSQL connection test successful');
    });

    it('should handle PostgreSQL connection errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection failed'));

      const result = await database.testConnection();
      expect(result.postgresql).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PostgreSQL connection test failed:',
        expect.any(Error)
      );
    });

    it('should provide graceful shutdown function', async () => {
      expect(database.closeConnections).toBeDefined();
      expect(typeof database.closeConnections).toBe('function');
    });

    it('should close PostgreSQL pool gracefully', async () => {
      mockPool.end.mockResolvedValue();

      await database.closeConnections();
      expect(mockPool.end).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Database connections closed gracefully');
    });

    it('should handle pool closing errors', async () => {
      mockPool.end.mockRejectedValue(new Error('Failed to close pool'));

      await database.closeConnections();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error closing database connections:',
        expect.any(Error)
      );
    });
  });

  describe('Database Health Monitoring', () => {
    let database;

    beforeEach(() => {
      delete require.cache[require.resolve('../../src/config/database')];
      database = require('../../src/config/database');
    });

    it('should provide health check function', () => {
      expect(database.getHealthStatus).toBeDefined();
      expect(typeof database.getHealthStatus).toBe('function');
    });

    it('should return pool statistics', () => {
      mockPool.totalCount = 5;
      mockPool.idleCount = 3;
      mockPool.waitingCount = 1;

      const health = database.getHealthStatus();
      expect(health.postgresql).toEqual({
        totalConnections: 5,
        idleConnections: 3,
        waitingConnections: 1,
        status: 'healthy'
      });
    });

    it('should detect unhealthy pool state', () => {
      mockPool.totalCount = 10;
      mockPool.idleCount = 0;
      mockPool.waitingCount = 5;

      const health = database.getHealthStatus();
      expect(health.postgresql.status).toBe('warning');
    });

    it('should include Supabase health status', () => {
      const health = database.getHealthStatus();
      expect(health.supabase).toEqual({
        status: 'connected',
        clientType: 'supabase-js'
      });
    });
  });

  describe('Database Utilities', () => {
    let database;

    beforeEach(() => {
      delete require.cache[require.resolve('../../src/config/database')];
      database = require('../../src/config/database');
    });

    it('should provide query helper function', async () => {
      expect(database.query).toBeDefined();
      expect(typeof database.query).toBe('function');
    });

    it('should execute queries with pool', async () => {
      const mockResult = { rows: [{ id: 1, name: 'test' }], rowCount: 1 };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await database.query('SELECT * FROM users WHERE id = $1', [1]);
      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    });

    it('should handle query errors', async () => {
      const error = new Error('Query failed');
      mockPool.query.mockRejectedValue(error);

      await expect(database.query('INVALID SQL')).rejects.toThrow('Query failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Database query error:',
        expect.any(Error)
      );
    });

    it('should provide transaction helper', async () => {
      expect(database.transaction).toBeDefined();
      expect(typeof database.transaction).toBe('function');
    });

    it('should execute transaction successfully', async () => {
      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ command: 'COMMIT' });

      const callback = jest.fn(async (client) => {
        return await client.query('INSERT INTO users (name) VALUES ($1) RETURNING id', ['test']);
      });

      const result = await database.transaction(callback);
      expect(result.rows).toEqual([{ id: 1 }]);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' })
        .mockRejectedValueOnce(new Error('Query failed'))
        .mockResolvedValueOnce({ command: 'ROLLBACK' });

      const callback = jest.fn(async (client) => {
        throw new Error('Query failed');
      });

      await expect(database.transaction(callback)).rejects.toThrow('Query failed');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('Environment-Specific Configuration', () => {
    it('should configure for development environment', () => {
      process.env.NODE_ENV = 'development';
      delete require.cache[require.resolve('../../src/config/database')];
      require('../../src/config/database');

      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          auth: expect.objectContaining({
            debug: true
          })
        })
      );
    });

    it('should configure for production environment', () => {
      process.env.NODE_ENV = 'production';
      delete require.cache[require.resolve('../../src/config/database')];
      require('../../src/config/database');

      const { Pool } = require('pg');
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        ssl: expect.objectContaining({
          rejectUnauthorized: false
        })
      }));
    });

    it('should configure for test environment', () => {
      process.env.NODE_ENV = 'test';
      delete require.cache[require.resolve('../../src/config/database')];
      require('../../src/config/database');

      const { Pool } = require('pg');
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        min: 1,
        max: 5
      }));
    });
  });

  describe('Connection Pool Events', () => {
    let database;

    beforeEach(() => {
      delete require.cache[require.resolve('../../src/config/database')];
      database = require('../../src/config/database');
    });

    it('should setup pool event listeners', () => {
      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('acquire', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('remove', expect.any(Function));
    });

    it('should log pool connect events', () => {
      const connectHandler = mockPool.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler(mockClient);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('New client connected to PostgreSQL pool');
    });

    it('should log pool error events', () => {
      const errorHandler = mockPool.on.mock.calls.find(call => call[0] === 'error')[1];
      const error = new Error('Pool error');
      errorHandler(error);
      
      expect(mockLogger.error).toHaveBeenCalledWith('PostgreSQL pool error:', error);
    });

    it('should log client acquisition events', () => {
      const acquireHandler = mockPool.on.mock.calls.find(call => call[0] === 'acquire')[1];
      acquireHandler(mockClient);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Client acquired from PostgreSQL pool');
    });

    it('should log client removal events', () => {
      const removeHandler = mockPool.on.mock.calls.find(call => call[0] === 'remove')[1];
      removeHandler(mockClient);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Client removed from PostgreSQL pool');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required environment variables', () => {
      const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DATABASE_URL'];
      
      requiredVars.forEach(varName => {
        const originalValue = process.env[varName];
        delete process.env[varName];
        delete require.cache[require.resolve('../../src/config/database')];
        
        expect(() => {
          require('../../src/config/database');
        }).toThrow();
        
        process.env[varName] = originalValue;
      });
    });

    it('should validate URL formats', () => {
      process.env.SUPABASE_URL = 'invalid-url';
      delete require.cache[require.resolve('../../src/config/database')];
      
      expect(() => {
        require('../../src/config/database');
      }).toThrow();
    });

    it('should validate numeric configuration values', () => {
      process.env.DB_POOL_MAX = 'invalid-number';
      delete require.cache[require.resolve('../../src/config/database')];
      
      const database = require('../../src/config/database');
      const { Pool } = require('pg');
      
      // Should use default value when invalid number provided
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        max: 10 // default value
      }));
    });
  });

  describe('Error Recovery', () => {
    let database;

    beforeEach(() => {
      delete require.cache[require.resolve('../../src/config/database')];
      database = require('../../src/config/database');
    });

    it('should provide connection retry mechanism', async () => {
      expect(database.retryConnection).toBeDefined();
      expect(typeof database.retryConnection).toBe('function');
    });

    it('should retry failed connections', async () => {
      mockPool.query
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce({ rows: [{ now: new Date() }] });

      const result = await database.retryConnection(3, 100);
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection failed'));

      const result = await database.retryConnection(2, 100);
      expect(result).toBe(false);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should handle connection recovery', async () => {
      expect(database.handleConnectionLoss).toBeDefined();
      expect(typeof database.handleConnectionLoss).toBe('function');
    });
  });
});