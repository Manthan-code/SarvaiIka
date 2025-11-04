import { renderHook, act, waitFor } from '@testing-library/react';
import { useSubscriptions } from '../../src/hooks/useSubscriptions';
import { useAuthStore } from '../../src/stores/authStore';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
jest.mock('../../src/stores/authStore');
jest.mock('../../src/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('../../src/services/subscriptionsService', () => ({
  __esModule: true,
  default: {
    getCurrentUserSubscription: jest.fn(),
    getSubscriptions: jest.fn(),
    createSubscription: jest.fn(),
    deleteSubscription: jest.fn(),
    updateUserSubscription: jest.fn(),
  }
}));
jest.mock('../../src/services/plansService', () => ({
  __esModule: true,
  default: {
    getPlans: jest.fn(),
  }
}));
jest.mock('../../src/lib/localStorageUtils', () => ({
  __esModule: true,
  getSubscriptionCacheFirst: jest.fn(),
  cacheSubscriptionFromDB: jest.fn(),
  invalidateSubscriptionCache: jest.fn(),
  getCachedPlans: jest.fn(),
  setCachedPlans: jest.fn(),
}));

import subscriptionsService from '../../src/services/subscriptionsService';
import plansService from '../../src/services/plansService';
import { 
  getSubscriptionCacheFirst,
  cacheSubscriptionFromDB,
  invalidateSubscriptionCache,
  getCachedPlans,
  setCachedPlans,
} from '../../src/lib/localStorageUtils';

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

// Provide a React Query client wrapper for hooks using react-query
const queryClient = new QueryClient();
const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useSubscriptions', () => {
  const defaultAuthState = {
    session: { user: { id: 'user-1' } },
    isAuthenticated: () => true
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue(defaultAuthState);
    // Ensure getState is available for useAuthStore.getState() calls inside the hook
    (useAuthStore as any).getState = jest.fn(() => defaultAuthState);
  });

  test('loads user subscription from cache first without calling API', async () => {
    const cached = {
      id: 'user-subscription',
      plan: 'plus',
      plan_details: { name: 'plus', features: [], price: 10 },
      status: 'active',
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    };
    (getSubscriptionCacheFirst as jest.Mock).mockReturnValue(cached);

    const { result } = renderHook(() => useSubscriptions(), { wrapper });

    await waitFor(() => {
      expect(result.current.userSubscription).toEqual(cached);
    });

    expect((subscriptionsService as any).getCurrentUserSubscription).not.toHaveBeenCalled();
  });

  test('force refresh fetches from API and caches result', async () => {
    const cached = {
      id: 'user-subscription',
      plan: 'plus',
      plan_details: { name: 'plus', features: [], price: 10 },
      status: 'active',
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    };
    (getSubscriptionCacheFirst as jest.Mock).mockReturnValue(cached);

    const apiResponse = {
      id: 'sub-2',
      plan: 'pro',
      plan_details: { name: 'pro', features: ['x'], price: 25 },
      status: 'active',
      current_period_end: null,
      cancel_at_period_end: false,
    };
    (subscriptionsService as any).getCurrentUserSubscription.mockResolvedValue(apiResponse);

    const { result } = renderHook(() => useSubscriptions(), { wrapper });

    await act(async () => {
      await result.current.refetchUserSubscription();
    });

    await waitFor(() => {
      expect(result.current.userSubscription?.plan).toBe('pro');
    });

    expect(cacheSubscriptionFromDB).toHaveBeenCalled();
    expect((subscriptionsService as any).getCurrentUserSubscription).toHaveBeenCalled();
  });

  test('plans use cached first and fetch when empty', async () => {
    // Cached present case
    const cachedPlans = [{ name: 'Pro', features: [], price: 20 }];
    (getCachedPlans as jest.Mock).mockReturnValueOnce(cachedPlans);
    const { result: resultCached } = renderHook(() => useSubscriptions(), { wrapper });
    await waitFor(() => {
      expect(resultCached.current.plans).toEqual(cachedPlans);
    });

    // Empty cache triggers fetch
    (getCachedPlans as jest.Mock).mockReturnValueOnce([]);
    (plansService as any).getPlans.mockResolvedValue({ success: true, data: [{ name: 'Plus', features: [], price: 10 }] });
    const { result: resultFetch } = renderHook(() => useSubscriptions(), { wrapper });
    await waitFor(() => {
      expect(resultFetch.current.plans?.[0]?.name).toBe('Plus');
    });
    expect(setCachedPlans).toHaveBeenCalled();
  });

  test('subscription error falls back to cache and sets error', async () => {
    // First call -> no cache, second call -> cached
    const cached = {
      id: 'user-subscription',
      plan: 'plus',
      plan_details: { name: 'plus', features: [], price: 10 },
      status: 'active',
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    };
    (getSubscriptionCacheFirst as jest.Mock)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(cached);
    (subscriptionsService as any).getCurrentUserSubscription.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useSubscriptions(), { wrapper });

    await waitFor(() => {
      expect(result.current.userSubscription).toEqual(cached);
    });
    expect(result.current.error).toBe('boom');
  });

  test('updateUserSubscription triggers refetch and toast', async () => {
    (subscriptionsService as any).updateUserSubscription.mockResolvedValue({ message: 'Updated', plan: 'plus' });
    (subscriptionsService as any).getCurrentUserSubscription.mockResolvedValue({
      id: 'sub-2',
      plan: 'pro',
      plan_details: { name: 'pro', features: [], price: 25 },
      status: 'active',
      current_period_end: null,
      cancel_at_period_end: false,
    });

    const { result } = renderHook(() => useSubscriptions(), { wrapper });

    await act(async () => {
      await result.current.updateUserSubscription('plus');
    });

    expect((subscriptionsService as any).getCurrentUserSubscription).toHaveBeenCalled();
  });

  test('deleteSubscription invalidates cache and clears userSubscription', async () => {
    (subscriptionsService as any).deleteSubscription.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useSubscriptions(), { wrapper });

    await act(async () => {
      await result.current.deleteSubscription();
    });

    expect(invalidateSubscriptionCache).toHaveBeenCalled();
    expect(result.current.userSubscription).toBeNull();
  });

  test('createSubscription caches and sets userSubscription', async () => {
    (subscriptionsService as any).createSubscription.mockResolvedValue({
      subscription: {
        id: 'sub-1',
        status: 'active',
        current_period_end: null,
        plan_details: { name: 'plus', features: [], price: 10 }
      }
    });

    const { result } = renderHook(() => useSubscriptions(), { wrapper });

    await act(async () => {
      await result.current.createSubscription({} as any);
    });

    expect(cacheSubscriptionFromDB).toHaveBeenCalled();
    expect(result.current.userSubscription?.plan_details?.name).toBe('plus');
  });
});