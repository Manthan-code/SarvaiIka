import { refreshAuthToken, logout, isAuthenticated } from '../../src/lib/authUtils';
import { useAuthStore } from '../../src/stores/authStore';
import supabase from '../services/supabaseClient';

// Mock authRefreshManager
jest.mock('@/lib/authRefresh', () => ({
  authRefreshManager: {
    performSilentRefresh: jest.fn(),
    stopRefreshTimer: jest.fn(),
    startMonitoring: jest.fn(),
  },
}));

const { authRefreshManager } = require('@/lib/authRefresh');

describe('authUtils', () => {
  const originalLocation = window.location;

  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:3000',
        href: 'http://localhost:3000/',
        pathname: '/',
        search: '',
        hash: '',
      },
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', { value: originalLocation });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset href before each test
    window.location.href = 'http://localhost:3000/';
  });

  describe('refreshAuthToken', () => {
    it('returns true when silent refresh succeeds', async () => {
      (authRefreshManager.performSilentRefresh as jest.Mock).mockResolvedValue(true);

      const result = await refreshAuthToken();

      expect(authRefreshManager.performSilentRefresh).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('returns false when silent refresh indicates failure', async () => {
      (authRefreshManager.performSilentRefresh as jest.Mock).mockResolvedValue(false);

      const result = await refreshAuthToken();

      expect(authRefreshManager.performSilentRefresh).toHaveBeenCalledTimes(1);
      expect(result).toBe(false);
    });

    it('propagates errors from performSilentRefresh', async () => {
      (authRefreshManager.performSilentRefresh as jest.Mock).mockRejectedValue(new Error('network'));

      await expect(refreshAuthToken()).rejects.toThrow('network');
      expect(authRefreshManager.performSilentRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('logout', () => {
    it('stops refresh, signs out, clears auth state, and redirects to /login', async () => {
      // Ensure signOut resolves
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });

      const store = (useAuthStore as any).getState();

      await logout();

      expect(authRefreshManager.stopRefreshTimer).toHaveBeenCalledTimes(1);
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
      expect(store.clearAuthState).toHaveBeenCalledTimes(1);
      expect(window.location.href).toBe('/login');
    });

    it('clears auth state and redirects even if signOut throws', async () => {
      (supabase.auth.signOut as jest.Mock).mockRejectedValue(new Error('failed'));

      const store = (useAuthStore as any).getState();

      await logout();

      expect(authRefreshManager.stopRefreshTimer).toHaveBeenCalledTimes(1);
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
      expect(store.clearAuthState).toHaveBeenCalledTimes(1);
      expect(window.location.href).toBe('/login');
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when store isAuthenticated returns true', () => {
      const store = (useAuthStore as any).getState();
      store.isAuthenticated = () => true;

      expect(isAuthenticated()).toBe(true);
    });

    it('returns false when store isAuthenticated returns false', () => {
      const store = (useAuthStore as any).getState();
      store.isAuthenticated = () => false;

      expect(isAuthenticated()).toBe(false);
    });
  });
});