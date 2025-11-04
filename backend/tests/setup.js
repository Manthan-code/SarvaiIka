/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

const path = require('path');
const dotenv = require('dotenv');

// Load test environment variables from .env.test
dotenv.config({ path: path.join(__dirname, '..', '.env.test') });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.USE_MOCK_AI = 'true';
process.env.PORT = '5002'; // Use different port for tests

// Override any environment validation for tests
process.env.SKIP_ENV_VALIDATION = 'true';

// Set additional required environment variables for tests
process.env.ENCRYPTION_KEY = 'test_encryption_key_32_characters_long_for_testing';
process.env.FRONTEND_URL = 'http://localhost:3000';

// Mock external services
jest.mock('openai');
jest.mock('@supabase/supabase-js');
jest.mock('ioredis');
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        type: 'customer.subscription.created',
        data: { object: { id: 'sub_test' } }
      }),
    },
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_test' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'cus_test' }),
    },
    subscriptions: {
      create: jest.fn().mockResolvedValue({ id: 'sub_test' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'sub_test' }),
      update: jest.fn().mockResolvedValue({ id: 'sub_test' }),
      cancel: jest.fn().mockResolvedValue({ id: 'sub_test' }),
    },
    prices: {
      list: jest.fn().mockResolvedValue({ data: [] }),
    },
    products: {
      list: jest.fn().mockResolvedValue({ data: [] }),
    },
  }));
});
jest.mock('@qdrant/js-client-rest');

// Set mock environment variables for external services
process.env.OPENAI_API_KEY = 'mock-openai-key';
process.env.SUPABASE_URL = 'https://mock-supabase-url.supabase.co';
process.env.SUPABASE_ANON_KEY = 'mock-supabase-anon-key';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_stripe_key';
process.env.QDRANT_URL = 'http://localhost:6333';

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

// Only show errors and warnings in tests
console.log = jest.fn();
console.info = jest.fn();
console.debug = jest.fn();
console.warn = originalConsole.warn;
console.error = originalConsole.error;

// Global test utilities
global.testUtils = {
  // Wait for a specified amount of time
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Generate random test data
  generateRandomString: (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
  
  // Generate random user ID
  generateUserId: () => `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  
  // Generate random query
  generateQuery: () => {
    const queries = [
      'What is artificial intelligence?',
      'How do I write a Python function?',
      'Explain quantum computing',
      'Generate an image of a sunset',
      'Create a web application',
      'Debug this JavaScript code',
      'What are the best practices for API design?',
      'How does machine learning work?'
    ];
    return queries[Math.floor(Math.random() * queries.length)];
  },
  
  // Create mock response object
  createMockResponse: () => ({
    writeHead: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis()
  }),
  
  // Create mock request object
  createMockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: { id: 'test-user', plan: 'pro' },
    ...overrides
  }),
  
  // Validate streaming response format
  validateStreamingResponse: (response) => {
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    
    // Check if it's a valid SSE format
    const lines = response.split('\n');
    lines.forEach(line => {
      if (line.startsWith('data: ')) {
        const data = line.substring(6);
        if (data !== '[DONE]') {
          expect(() => JSON.parse(data)).not.toThrow();
        }
      }
    });
  },
  
  // Validate routing result
  validateRoutingResult: (result) => {
    expect(result).toBeDefined();
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('reasoning');
    
    expect(['gpt-3.5-turbo', 'gpt-4', 'claude-3-sonnet', 'dall-e-3']).toContain(result.primaryModel);
    expect(['text', 'coding', 'image', 'video']).toContain(result.type);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(typeof result.reasoning).toBe('string');
  },
  
  // Validate cache entry
  validateCacheEntry: (entry, expectedType) => {
    expect(entry).toBeDefined();
    if (expectedType === 'query-analysis') {
      expect(entry).toHaveProperty('type');
      expect(entry).toHaveProperty('difficulty');
      expect(entry).toHaveProperty('confidence');
    } else if (expectedType === 'routing-decision') {
      expect(entry).toHaveProperty('model');
      expect(entry).toHaveProperty('reasoning');
    }
  },
  
  // Performance measurement utilities
  measurePerformance: async (fn) => {
    const startTime = process.hrtime.bigint();
    const result = await fn();
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    return {
      result,
      duration,
      memoryUsage: process.memoryUsage()
    };
  },
  
  // Memory leak detection
  checkMemoryLeak: (initialMemory, threshold = 50 * 1024 * 1024) => {
    const currentMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = currentMemory - initialMemory;
    
    if (memoryIncrease > threshold) {
      console.warn(`Potential memory leak detected: ${memoryIncrease / 1024 / 1024}MB increase`);
    }
    
    return memoryIncrease;
  }
};

// Global test constants
global.testConstants = {
  SUBSCRIPTION_PLANS: ['free', 'pro', 'enterprise'],
  MODEL_TYPES: ['gpt-3.5-turbo', 'gpt-4', 'claude-3-sonnet', 'dall-e-3'],
  QUERY_TYPES: ['text', 'coding', 'image', 'video'],
  DIFFICULTY_LEVELS: ['easy', 'hard'],
  
  // Test timeouts
  TIMEOUTS: {
    SHORT: 1000,
    MEDIUM: 5000,
    LONG: 10000
  },
  
  // Performance thresholds
  PERFORMANCE: {
    MAX_RESPONSE_TIME: 1000, // 1 second
    MAX_MEMORY_INCREASE: 50 * 1024 * 1024, // 50MB
    MIN_CACHE_HIT_RATE: 0.1 // 10%
  }
};

// Mock external dependencies
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    flushall: jest.fn()
  }))
}));

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn(() => ({
    getCollections: jest.fn(),
    createCollection: jest.fn(),
    upsert: jest.fn(),
    search: jest.fn(),
    delete: jest.fn()
  }))
}));

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Cleanup function (to be called manually if needed)
global.cleanupTests = async () => {
  // Restore console methods
  Object.assign(console, originalConsole);
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
};

// Export for use in tests
module.exports = {
  testUtils: global.testUtils,
  testConstants: global.testConstants
};