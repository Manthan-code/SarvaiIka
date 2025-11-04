/**
 * Enhanced Mock Supabase client for backend testing
 * Provides comprehensive mocking for all Supabase methods used in the codebase
 */

class EnhancedMockSupabaseClient {
  constructor() {
    this.auth = {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
        error: null
      }),
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { user: { id: 'mock-user-id', email: 'test@example.com' }, session: { access_token: 'mock-token' } },
        error: null
      }),
      signUp: jest.fn().mockResolvedValue({
        data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
        error: null
      }),
      signOut: jest.fn().mockResolvedValue({ error: null })
    };

    this.from = jest.fn().mockImplementation((table) => {
      return {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
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
        match: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        containedBy: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 1, name: 'Mock Data' },
          error: null
        }),
        single: jest.fn().mockResolvedValue({
          data: { id: 1, name: 'Mock Data' },
          error: null
        }),
        then: jest.fn().mockResolvedValue({
          data: [{ id: 1, name: 'Mock Data' }],
          error: null
        })
      };
    });

    this.rpc = jest.fn().mockResolvedValue({
      data: { result: 'mock-rpc-result' },
      error: null
    });

    this.storage = {
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
    };

    this.realtime = {
      channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
        unsubscribe: jest.fn().mockReturnThis()
      })
    };
  }

  static mockReset() {
    jest.clearAllMocks();
  }
}

const createClient = jest.fn().mockImplementation(() => new EnhancedMockSupabaseClient());

module.exports = {
  createClient,
  EnhancedMockSupabaseClient
};