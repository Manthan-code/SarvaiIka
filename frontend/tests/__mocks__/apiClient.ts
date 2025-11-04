/**
 * Mock API Client for Frontend Testing
 * Provides mock HTTP responses for API calls
 */

// Use a shared singleton across module instances to ensure consistent mocking
const globalApiKey = '__SHARED_API_CLIENT__';
const sharedApi: any = (globalThis as any)[globalApiKey] || {};

if (!sharedApi.get) {
  sharedApi.get = jest.fn().mockImplementation((url: string) => {
    // Mock different responses based on URL patterns
    if (url.includes('/api/auth/user')) {
      return Promise.resolve({
        data: {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user'
        },
        status: 200
      });
    }
    
    if (url.includes('/api/chats')) {
      return Promise.resolve({
        data: [
          {
            id: 'chat-1',
            title: 'Test Chat 1',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          },
          {
            id: 'chat-2',
            title: 'Test Chat 2',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ],
        status: 200
      });
    }

    if (url.includes('/api/subscriptions')) {
      return Promise.resolve({
        data: {
          id: 'sub-1',
          status: 'active',
          plan: 'pro',
          current_period_end: '2024-12-31T23:59:59Z'
        },
        status: 200
      });
    }

    if (url.includes('/api/transactions')) {
      return Promise.resolve({
        data: [
          {
            id: 'txn-1',
            amount: 2000,
            currency: 'usd',
            status: 'succeeded',
            created_at: '2024-01-01T00:00:00Z'
          }
        ],
        status: 200
      });
    }

    // Admin users endpoint for ManageUsers page
    if (url.includes('/api/admin/users')) {
      return Promise.resolve({
        users: [
          {
            id: 'user-1',
            name: 'Alice Admin',
            email: 'alice@example.com',
            role: 'admin',
            subscription_plan: 'pro',
            email_verified: true,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z'
          },
          {
            id: 'user-2',
            name: 'Bob User',
            email: 'bob@example.com',
            role: 'user',
            subscription_plan: 'free',
            email_verified: false,
            is_active: true,
            created_at: '2024-01-03T00:00:00Z',
            updated_at: '2024-01-04T00:00:00Z'
          }
        ],
        status: 200
      });
    }

    // Default response
    return Promise.resolve({
      data: { message: 'Mock response' },
      status: 200
    });
  });
}

if (!sharedApi.post) {
  sharedApi.post = jest.fn().mockImplementation((url: string, data?: any) => {
    if (url.includes('/api/auth/login')) {
      return Promise.resolve({
        data: {
          user: {
            id: 'test-user-id',
            email: data?.email || 'test@example.com',
            name: 'Test User'
          },
          token: 'mock-jwt-token'
        },
        status: 200
      });
    }

    if (url.includes('/api/chats')) {
      return Promise.resolve({
        data: {
          id: 'new-chat-id',
          title: data?.title || 'New Chat',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        status: 201
      });
    }

    if (url.includes('/api/messages')) {
      return Promise.resolve({
        data: {
          id: 'new-message-id',
          content: data?.content || 'Test message',
          role: data?.role || 'user',
          created_at: new Date().toISOString()
        },
        status: 201
      });
    }

    // Default response
    return Promise.resolve({
      data: { message: 'Created successfully' },
      status: 201
    });
  });
}

if (!sharedApi.put) {
  sharedApi.put = jest.fn().mockImplementation((url: string, data?: any) => {
    return Promise.resolve({
      data: { message: 'Updated successfully', ...data },
      status: 200
    });
  });
}

if (!sharedApi.patch) {
  sharedApi.patch = jest.fn().mockImplementation((url: string, data?: any) => {
    return Promise.resolve({
      data: { message: 'Patched successfully', ...data },
      status: 200
    });
  });
}

if (!sharedApi.delete) {
  sharedApi.delete = jest.fn().mockImplementation((url: string) => {
    return Promise.resolve({
      data: { message: 'Deleted successfully' },
      status: 200
    });
  });
}

if (!sharedApi.mockError) {
  sharedApi.mockError = (status: number = 500, message: string = 'Mock error') => {
    const error = new Error(message) as any;
    error.response = {
      status,
      data: { error: message }
    };
    return Promise.reject(error);
  };
}

if (!sharedApi.mockReset) {
  sharedApi.mockReset = () => {
    jest.clearAllMocks();
  };
}

// Share globally
(globalThis as any)[globalApiKey] = sharedApi;

// Export both named and default to match the real apiClient
export const apiClient = sharedApi;
export default sharedApi;