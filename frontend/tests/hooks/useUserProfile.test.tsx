import { renderHook, act } from '@testing-library/react';
import { useUserProfile } from '../../src/hooks/useUserProfile';
import { useAuthStore, cacheInvalidationEmitter } from '../../src/stores/authStore';
import { apiClient } from '../../src/utils/apiClient';
import {
  getCachedUserProfile,
  setCachedUserProfile,
  clearCachedUserProfile,
} from '../../src/lib/localStorageUtils';

// Rely on global setup mocks for authStore and apiClient
jest.mock('../../src/lib/localStorageUtils');

const mockUseAuthStore = useAuthStore as unknown as jest.MockedFunction<typeof useAuthStore> & {
  getState?: jest.Mock;
  subscribe?: jest.Mock;
};
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockGetCachedUserProfile = getCachedUserProfile as jest.MockedFunction<typeof getCachedUserProfile>;
const mockSetCachedUserProfile = setCachedUserProfile as jest.MockedFunction<typeof setCachedUserProfile>;
const mockClearCachedUserProfile = clearCachedUserProfile as jest.MockedFunction<typeof clearCachedUserProfile>;

describe('useUserProfile', () => {
  const defaultSession = { access_token: 'token-123' } as any;
  const defaultProfile = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    subscription_plan: 'free',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({ session: defaultSession } as any);
    mockApiClient.get.mockReset();
    mockApiClient.put.mockReset();
    mockGetCachedUserProfile.mockReset();
    mockSetCachedUserProfile.mockReset();
    mockClearCachedUserProfile.mockReset();
  });

  it('loads cached profile immediately and does not fetch unless forced', async () => {
    mockGetCachedUserProfile.mockReturnValue(defaultProfile);

    const { result } = renderHook(() => useUserProfile());

    expect(result.current.profile).toEqual(defaultProfile);
    expect(result.current.isLoading).toBe(false);
    expect(mockApiClient.get).not.toHaveBeenCalled();

    // Force refresh should fetch and update cache
    const serverProfile = { ...defaultProfile, name: 'Server User' };
    (mockApiClient.get as jest.Mock).mockResolvedValue({ user: serverProfile });

    await act(async () => {
      await result.current.refreshProfile();
    });

    expect(mockApiClient.get).toHaveBeenCalledWith('/api/auth/profile');
    expect(result.current.profile).toEqual(serverProfile);
    expect(mockSetCachedUserProfile).toHaveBeenCalledWith(serverProfile);
  });

  it('fetches profile when no cache and session present', async () => {
    mockGetCachedUserProfile.mockReturnValue(null);
    const serverProfile = { ...defaultProfile, name: 'Fetched User' };
    (mockApiClient.get as jest.Mock).mockResolvedValue({ user: serverProfile });

    const { result } = renderHook(() => useUserProfile());

    // loadProfile runs in effect: wait for it
    await act(async () => {});

    expect(mockApiClient.get).toHaveBeenCalledWith('/api/auth/profile');
    expect(result.current.profile).toEqual(serverProfile);
    expect(mockSetCachedUserProfile).toHaveBeenCalledWith(serverProfile);
  });

  it('handles updateProfile success with optimistic update then server response', async () => {
    mockGetCachedUserProfile.mockReturnValue(defaultProfile);
    const { result } = renderHook(() => useUserProfile());

    const updates = { name: 'Updated Name' };
    const serverProfile = { ...defaultProfile, name: 'Server Confirmed' };
    (mockApiClient.put as jest.Mock).mockResolvedValue({ user: serverProfile });

    await act(async () => {
      await result.current.updateProfile(updates);
    });

    expect(mockSetCachedUserProfile).toHaveBeenCalled();
    expect(result.current.profile).toEqual(serverProfile);
    expect(result.current.isUpdating).toBe(false);
  });

  it('handles updateProfile error by reverting optimistic update', async () => {
    mockGetCachedUserProfile.mockReturnValue(defaultProfile);
    const { result } = renderHook(() => useUserProfile());

    const updates = { name: 'Bad Update' };
    (mockApiClient.put as jest.Mock).mockRejectedValue(new Error('Failed to update profile'));

    await act(async () => {
      await result.current.updateProfile(updates);
    });

    expect(result.current.error).toMatch(/Failed to update profile/i);
    expect(result.current.profile).toEqual(defaultProfile);
    expect(mockSetCachedUserProfile).toHaveBeenLastCalledWith(defaultProfile);
  });

  it('clears profile on logout and responds to cache invalidation events', async () => {
    mockGetCachedUserProfile.mockReturnValue(defaultProfile);
    const { result, rerender } = renderHook(() => useUserProfile());
    expect(result.current.profile).toEqual(defaultProfile);

    // Simulate logout
    mockUseAuthStore.mockReturnValue({ session: null } as any);
    rerender();
    await act(async () => {});

    expect(result.current.profile).toBeNull();
    expect(mockClearCachedUserProfile).toHaveBeenCalled();

    // Simulate cache invalidation event forces refresh
    mockUseAuthStore.mockReturnValue({ session: defaultSession } as any);
    rerender();

    const serverProfile = { ...defaultProfile, name: 'Refreshed Profile' };
    (mockApiClient.get as jest.Mock).mockResolvedValue({ user: serverProfile });

    await act(async () => {
      cacheInvalidationEmitter.emit('profile');
    });

    expect(result.current.profile).toEqual(serverProfile);
    expect(mockSetCachedUserProfile).toHaveBeenCalledWith(serverProfile);
  });
});