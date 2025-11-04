import axiosClient from '@/lib/axiosClient';
import supabase from '../services/supabaseClient';

// Helper to set a mock adapter so we don't hit real network
const setMockAdapter = (implementation: (config: any) => Promise<any>) => {
  (axiosClient.defaults as any).adapter = jest.fn(implementation);
};

describe('axiosClient', () => {
  let currentAccessToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    currentAccessToken = 'mock-access-token';

    // Ensure we have getUser available on supabase mock
    (supabase as any).auth.getUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user' } },
      error: null
    });
    (supabase as any).auth.getSession = jest.fn().mockImplementation(async () => ({
      data: { session: { access_token: currentAccessToken } },
      error: null
    }));
    (supabase as any).auth.refreshSession = jest.fn().mockImplementation(async () => {
      currentAccessToken = 'new-mock-access-token';
      return { data: { session: { access_token: currentAccessToken } }, error: null };
    });
    (supabase as any).auth.signOut = jest.fn().mockResolvedValue({ error: null });
  });

  describe('request interceptor', () => {
    it('attaches Authorization header when user present and session has token', async () => {
      setMockAdapter(async (config) => ({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      }));

      const res = await axiosClient.get('/test-endpoint');

      expect(res.status).toBe(200);
      // Adapter should have been called
      const adapterMock = (axiosClient.defaults as any).adapter as jest.Mock;
      expect(adapterMock).toHaveBeenCalled();
      const calledConfig = adapterMock.mock.calls[0][0];
      expect(calledConfig.headers.Authorization).toBe('Bearer mock-access-token');
      expect((supabase as any).auth.getUser).toHaveBeenCalled();
      expect((supabase as any).auth.getSession).toHaveBeenCalled();
    });

    it('does not attach Authorization if getUser returns error', async () => {
      (supabase as any).auth.getUser = jest.fn().mockResolvedValue({ data: { user: null }, error: new Error('auth error') });

      setMockAdapter(async (config) => ({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      }));

      const res = await axiosClient.get('/test-endpoint');
      expect(res.status).toBe(200);
      const adapterMock = (axiosClient.defaults as any).adapter as jest.Mock;
      const calledConfig = adapterMock.mock.calls[0][0];
      expect(calledConfig.headers.Authorization).toBeUndefined();
    });
  });

  describe('response interceptor (401 handling)', () => {
    it('refreshes session and retries request on 401, then succeeds', async () => {
      // Adapter: first call rejects with 401, second call resolves success
      setMockAdapter(async (config) => {
        if (!config._retry) {
          const error: any = new Error('Unauthorized');
          error.config = config;
          error.response = { status: 401 };
          error.isAxiosError = true;
          return Promise.reject(error);
        }
        return {
          data: { ok: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config
        };
      });

      const res = await axiosClient.get('/protected');
      expect(res.status).toBe(200);

      const adapterMock = (axiosClient.defaults as any).adapter as jest.Mock;
      expect(adapterMock).toHaveBeenCalledTimes(2);

      const secondCallConfig = adapterMock.mock.calls[1][0];
      expect(secondCallConfig.headers.Authorization).toBe('Bearer new-mock-access-token');
      expect((supabase as any).auth.refreshSession).toHaveBeenCalled();
    });

    it('signs out and redirects to /login if refresh fails', async () => {
      (supabase as any).auth.refreshSession = jest.fn().mockResolvedValue({ data: { session: null }, error: new Error('refresh failed') });
      const originalHref = window.location.href;

      // Override window.location to capture href setter behavior reliably in jsdom
      const originalLocation = window.location as any;
      const hrefCalls: string[] = [];
      delete (window as any).location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        enumerable: true,
        value: {
          ...originalLocation,
          _href: originalHref,
          set href(val) {
            hrefCalls.push(val);
            // Resolve relative path against originalHref base
            this._href = new URL(val, originalHref).href;
          },
          get href() {
            return this._href;
          },
          assign: jest.fn((val: string) => {
            hrefCalls.push(val);
            this._href = new URL(val, originalHref).href;
          })
        }
      });

      setMockAdapter(async (config) => {
        const error: any = new Error('Unauthorized');
        error.config = config;
        error.response = { status: 401 };
        error.isAxiosError = true;
        return Promise.reject(error);
      });

      await expect(axiosClient.get('/protected')).rejects.toBeInstanceOf(Error);
      // Allow microtasks to flush for location change
      await (global as any).testUtils.wait(0);
      expect((supabase as any).auth.signOut).toHaveBeenCalled();
      // Verify href setter was called with '/login' and resulting absolute URL
      expect(hrefCalls[hrefCalls.length - 1]).toBe('/login');
      expect(window.location.href).toBe('http://localhost:3000/login');

      // Restore location
      delete (window as any).location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        enumerable: true,
        value: originalLocation
      });
      window.location.href = originalHref;
    });
  });
});