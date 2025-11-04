// Adjust imports to use alias paths for consistent mocking
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuthStore, cacheInvalidationEmitter } from '@/stores/authStore';
import { apiClient } from '@/utils/apiClient';
import { profileCircuitBreaker } from '@/utils/circuitBreaker';

// Use unified manual mocks via setup.js and moduleNameMapper
jest.mock('@/utils/apiClient');
jest.mock('@/utils/circuitBreaker', () => ({
  profileCircuitBreaker: {
    execute: jest.fn(async (fn: any) => fn()),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('useUserRole', () => {
  const user = { id: 'user-1' };
  const session = { access_token: 'token-123' };
  const serverProfile = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'admin',
    subscription_plan: 'pro',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Initialize auth state in shared store
    const store = (useAuthStore as any).getState?.() || {};
    if (store) {
      store.user = user;
      store.session = session;
    }
    mockApiClient.get.mockReset();
  });

  it('initializes from cache and reports role flags', async () => {
    const cached = { data: serverProfile, timestamp: Date.now() };
    localStorage.setItem('ai_agent_user_profile_with_role', JSON.stringify(cached));

    const { result } = renderHook(() => useUserRole());

    expect(result.current.profile).toEqual(serverProfile);
    expect(result.current.role).toBe('admin');
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isModerator).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches when no cache and auth present', async () => {
    (mockApiClient.get as jest.Mock).mockResolvedValue({ user: serverProfile });

    const { result } = renderHook(() => useUserRole());
    await act(async () => {});

    expect(mockApiClient.get).toHaveBeenCalledWith('/api/auth/profile');
    expect(result.current.profile).toEqual(serverProfile);
    expect(result.current.role).toBe('admin');
  });

  it('handles 429 with retry by setting error without clearing cache immediately', async () => {
    const err429 = { response: { status: 429 }, statusCode: 429 } as any;
    (mockApiClient.get as jest.Mock).mockRejectedValueOnce(err429);

    const { result } = renderHook(() => useUserRole());
    await act(async () => {});

    expect(result.current.error).toMatch(/Too many requests/i);
  });

  it('handles circuit breaker open error path', async () => {
    (profileCircuitBreaker.execute as jest.Mock).mockImplementationOnce(async () => {
      const err = new Error('Circuit breaker is OPEN');
      (err as any).message = 'Circuit breaker is OPEN';
      throw err;
    });

    const { result } = renderHook(() => useUserRole());
    await act(async () => {});

    expect(result.current.error).toMatch(/Service temporarily unavailable/i);
  });

  it('clears profile on logout via subscription', async () => {
    (mockApiClient.get as jest.Mock).mockResolvedValue({ user: serverProfile });
    const { result } = renderHook(() => useUserRole());
    await act(async () => {});

    await act(async () => {
      (useAuthStore as any).__emit({ user: null, session: null });
      // Also emit via cache invalidation emitter to ensure hooks listening there clear
      (cacheInvalidationEmitter as any).emit('auth-logout');
    });

    await waitFor(() => {
      expect(result.current.profile).toBeNull();
      expect(result.current.role).toBeNull();
    });
  });

  it('refreshProfile forces fetch', async () => {
    (mockApiClient.get as jest.Mock).mockResolvedValue({ user: serverProfile });
    const { result } = renderHook(() => useUserRole());

    await act(async () => {
      await result.current.refreshProfile();
    });

    expect(mockApiClient.get).toHaveBeenCalledWith('/api/auth/profile');
    expect(result.current.profile).toEqual(serverProfile);
  });
});