/**
 * Mock Supabase Client for Testing
 * Provides mock implementation of Supabase authentication
 */

const mockSupabaseClient = {
  auth: {
    getSession: jest.fn().mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: {
              full_name: 'Test User'
            }
          },
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token'
        }
      },
      error: null
    }),
    
    signOut: jest.fn().mockResolvedValue({
      error: null
    }),
    
    signInWithPassword: jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          user_metadata: {
            full_name: 'Test User'
          }
        },
        session: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token'
        }
      },
      error: null
    }),
    
    signUp: jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          user_metadata: {
            full_name: 'Test User'
          }
        },
        session: null
      },
      error: null
    }),
    
    onAuthStateChange: jest.fn().mockImplementation((callback) => {
      // Simulate auth state change listener
      return {
        data: {
          subscription: {
            unsubscribe: jest.fn()
          }
        }
      };
    }),
    
    refreshSession: jest.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'new-mock-access-token',
          refresh_token: 'new-mock-refresh-token'
        }
      },
      error: null
    })
  },
  
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: 1, name: 'Mock Data' },
      error: null
    }),
    then: jest.fn().mockResolvedValue({
      data: [{ id: 1, name: 'Mock Data' }],
      error: null
    })
  }),

  rpc: jest.fn().mockResolvedValue({
    data: { result: 'mock-rpc-result' },
    error: null
  }),

  storage: {
    from: jest.fn().mockReturnValue({
      upload: jest.fn().mockResolvedValue({
        data: { path: 'mock-file-path' },
        error: null
      }),
      download: jest.fn().mockResolvedValue({
        data: new Blob(['mock file content']),
        error: null
      }),
      remove: jest.fn().mockResolvedValue({
        data: [],
        error: null
      }),
      getPublicUrl: jest.fn().mockReturnValue({
        data: { publicUrl: 'https://mock-storage-url.com/file' }
      })
    })
  },

  realtime: {
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      unsubscribe: jest.fn().mockReturnThis()
    })
  }
};

export default mockSupabaseClient;