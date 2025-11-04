/**
 * Frontend Test Setup
 * Global configuration for React component testing
 */

import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Configure testing library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.VITE_API_BASE_URL = 'http://localhost:8080';
process.env.VITE_USE_MOCK_AI = 'true';
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    reload: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
  }),
}));

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt || ''} />;
  },
}));

// Mock next/head
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}));

// Mock import.meta.env for Vite
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key',
        VITE_API_BASE_URL: 'http://localhost:8080',
        VITE_USE_MOCK_AI: 'true',
        MODE: 'test',
        DEV: true,
        PROD: false,
        NODE_ENV: 'test'
      }
    }
  },
  configurable: true,
  writable: true
});

// Also set process.env for compatibility
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.VITE_API_BASE_URL = 'http://localhost:8080';
process.env.VITE_USE_MOCK_AI = 'true';
process.env.MODE = 'test';
process.env.DEV = 'true';
process.env.PROD = 'false';

// Mock API client
jest.mock('../src/utils/apiClient', () => {
  const mockModule = require('./__mocks__/apiClient');
  return {
    __esModule: true,
    ...mockModule
  };
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn()
});

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock localStorage
const createStorageMock = () => {
  let store = new Map();
  const storageObj = {
    getItem: jest.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: jest.fn((key, value) => {
      const val = String(value);
      store.set(key, val);
      Object.defineProperty(storageObj, key, { value: val, enumerable: true, configurable: true });
      storageObj.length = store.size;
    }),
    removeItem: jest.fn((key) => {
      if (store.has(key)) {
        store.delete(key);
        delete storageObj[key];
        storageObj.length = store.size;
      }
    }),
    clear: jest.fn(() => {
      Array.from(store.keys()).forEach((k) => {
        delete storageObj[k];
      });
      store.clear();
      storageObj.length = 0;
    }),
    key: jest.fn((index) => Array.from(store.keys())[index] ?? null),
    length: 0,
  };
  return storageObj;
};

const localStorageMock = createStorageMock();
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true
});

// Mock sessionStorage
const sessionStorageMock = createStorageMock();
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  configurable: true
});

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    headers: new Headers()
  })
);

// Mock EventSource for SSE
global.EventSource = class EventSource {
  constructor(url) {
    this.url = url;
    this.readyState = 1;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
  }
  
  addEventListener(type, listener) {
    this[`on${type}`] = listener;
  }
  
  removeEventListener() {}
  
  close() {
    this.readyState = 2;
  }
  
  // Helper method for tests to simulate events
  _simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
  
  _simulateError(error) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
};

// Mock URL.createObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: jest.fn(() => 'mocked-url')
});

// Mock URL.revokeObjectURL
Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: jest.fn()
});

// Mock Supabase client
// Mock errorApiService to avoid import.meta issues
jest.mock('../src/services/errorApiService', () => ({
  errorApiService: {
    reportError: jest.fn().mockResolvedValue({ success: true }),
    getErrorStats: jest.fn().mockResolvedValue({ total: 0, recent: [] }),
    clearErrors: jest.fn().mockResolvedValue({ success: true })
  }
}));

// Mock sentry config to avoid import.meta issues
jest.mock('../src/config/sentry', () => ({
  sentryErrorTracker: {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    setUser: jest.fn(),
    setTag: jest.fn(),
    setContext: jest.fn()
  }
}));

jest.mock('../src/services/supabaseClient', () => {
  return {
    __esModule: true,
    default: {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: 'test-user-id',
                email: 'test@example.com',
                user_metadata: { full_name: 'Test User' }
              },
              access_token: 'mock-access-token',
              refresh_token: 'mock-refresh-token'
            }
          },
          error: null
        }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: jest.fn().mockImplementation(() => ({
          data: { subscription: { unsubscribe: jest.fn() } }
        }))
      }
    }
  };
});

// Mock authStore (unified with manual mock to ensure consistent __emit and emitter behavior)
jest.mock('../src/stores/authStore', () => {
  const mockModule = require('./__mocks__/authStore');
  return {
    __esModule: true,
    ...mockModule
  };
});
 
 // Global test utilities for frontend
global.testUtils = {
  // Wait for a specified amount of time
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Simulate user typing
  simulateTyping: async (element, text, delay = 50) => {
    const { fireEvent } = await import('@testing-library/react');
    
    for (let i = 0; i <= text.length; i++) {
      const value = text.slice(0, i);
      fireEvent.change(element, { target: { value } });
      await global.testUtils.wait(delay);
    }
  },
  
  // Create mock streaming response
  createMockStreamingResponse: (messages) => {
    return messages.map(msg => `data: ${JSON.stringify(msg)}\n\n`).join('') + 'data: [DONE]\n\n';
  },
  
  // Mock streaming service
  createMockStreamingService: () => ({
    getMetrics: jest.fn().mockResolvedValue({
      activeConnections: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
      throughput: 0,
      bufferUtilization: 0,
      connectionPoolStatus: {
        active: 0,
        idle: 0,
        total: 0
      },
      performanceScore: 100
    }),
    getHealthStatus: jest.fn().mockResolvedValue({
      status: 'healthy',
      uptime: 1000,
      memoryUsage: 50,
      cpuUsage: 30
    }),
    startStream: jest.fn(),
    cancelStream: jest.fn()
  }),
  
  // Mock chat hook
  createMockChatHook: () => ({
    messages: [],
    isStreaming: false,
    currentModel: 'gpt-3.5-turbo',
    streamingText: '',
    error: null,
    performance: {
      responseTime: 0,
      tokensPerSecond: 0,
      totalTokens: 0
    },
    sendMessage: jest.fn(),
    clearMessages: jest.fn(),
    retryLastMessage: jest.fn(),
    cancelStream: jest.fn()
  }),
  
  // Create mock message
  createMockMessage: (id, content, role, model = 'gpt-3.5-turbo') => ({
    id,
    content,
    role,
    timestamp: new Date(),
    ...(role === 'assistant' && { model })
  }),
  
  // Validate component accessibility
  validateAccessibility: async (container) => {
    const { axe, toHaveNoViolations } = await import('jest-axe');
    expect.extend(toHaveNoViolations);
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  },
  
  // Mock animation frame
  mockAnimationFrame: () => {
    let id = 0;
    const callbacks = new Map();
    
    global.requestAnimationFrame = jest.fn((callback) => {
      const currentId = ++id;
      callbacks.set(currentId, callback);
      return currentId;
    });
    
    global.cancelAnimationFrame = jest.fn((id) => {
      callbacks.delete(id);
    });
    
    return {
      flush: () => {
        callbacks.forEach(callback => callback(performance.now()));
        callbacks.clear();
      },
      clear: () => {
        callbacks.clear();
      }
    };
  },
  
  // Mock performance API
  mockPerformance: () => {
    const originalPerformance = global.performance;
    
    global.performance = {
      ...originalPerformance,
      now: jest.fn(() => Date.now()),
      mark: jest.fn(),
      measure: jest.fn(),
      getEntriesByName: jest.fn(() => []),
      getEntriesByType: jest.fn(() => [])
    };
    
    return () => {
      global.performance = originalPerformance;
    };
  }
};

// Global test constants for frontend
global.testConstants = {
  MOCK_USER: {
    id: 'test-user-123',
    email: 'test@example.com',
    plan: 'pro'
  },
  
  MOCK_MESSAGES: [
    {
      id: '1',
      content: 'Hello, how can I help you?',
      role: 'assistant',
      timestamp: new Date(),
      model: 'gpt-3.5-turbo'
    },
    {
      id: '2',
      content: 'What is artificial intelligence?',
      role: 'user',
      timestamp: new Date()
    }
  ],
  
  MOCK_PERFORMANCE_METRICS: {
    responseTime: 250,
    tokensPerSecond: 25,
    totalTokens: 150
  },
  
  TIMEOUTS: {
    SHORT: 1000,
    MEDIUM: 3000,
    LONG: 5000
  }
};

// Cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Clear localStorage and sessionStorage
  localStorageMock.clear();
  sessionStorageMock.clear();
  
  // Reset fetch mock
  fetch.mockClear();
});

// Global error handler
const originalError = console.error;
console.error = (...args) => {
  // Suppress specific React warnings in tests
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
     args[0].includes('Warning: An invalid form control'))
  ) {
    return;
  }
  originalError.call(console, ...args);
};

// Export for use in tests
export {
  localStorageMock,
  sessionStorageMock
};