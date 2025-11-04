/**
 * Comprehensive useUserProfile Hook Tests
 * Tests for user profile data fetching, updating, and error handling
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useUserProfile } from '../../src/hooks/useUserProfile';
import * as profileService from '../../src/services/profileService';

// Mock dependencies
jest.mock('../../src/services/profileService');

describe('useUserProfile Hook', () => {
  const mockUserId = 'user-123';
  const mockProfile = {
    id: mockUserId,
    name: 'Test User',
    email: 'test@example.com',
    avatar: 'https://example.com/avatar.jpg',
    preferences: {
      theme: 'dark',
      notifications: true
    }
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock implementations
    (profileService.getUserProfile as jest.Mock).mockResolvedValue(mockProfile);
    (profileService.updateUserProfile as jest.Mock).mockImplementation(
      (userId, updates) => Promise.resolve({ ...mockProfile, ...updates })
    );
  });
  
  it('should fetch user profile on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useUserProfile(mockUserId));
    
    // Initial state
    expect(result.current.isLoading).toBe(true);
    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBeNull();
    
    // Wait for profile to load
    await waitForNextUpdate();
    
    // Check loaded state
    expect(result.current.isLoading).toBe(false);
    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.error).toBeNull();
    expect(profileService.getUserProfile).toHaveBeenCalledWith(mockUserId);
  });
  
  it('should handle profile fetch errors', async () => {
    const mockError = new Error('Failed to fetch profile');
    (profileService.getUserProfile as jest.Mock).mockRejectedValue(mockError);
    
    const { result, waitForNextUpdate } = renderHook(() => useUserProfile(mockUserId));
    
    // Wait for error
    await waitForNextUpdate();
    
    // Check error state
    expect(result.current.isLoading).toBe(false);
    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBe(mockError);
  });
  
  it('should update user profile', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useUserProfile(mockUserId));
    
    // Wait for initial profile load
    await waitForNextUpdate();
    
    // Update profile
    const updates = { name: 'Updated Name', preferences: { theme: 'light' } };
    const updatedProfile = { ...mockProfile, ...updates };
    
    act(() => {
      result.current.updateProfile(updates);
    });
    
    // Check loading state during update
    expect(result.current.isUpdating).toBe(true);
    
    // Wait for update to complete
    await waitForNextUpdate();
    
    // Check updated state
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.profile).toEqual(updatedProfile);
    expect(result.current.error).toBeNull();
    expect(profileService.updateUserProfile).toHaveBeenCalledWith(mockUserId, updates);
  });
  
  it('should handle profile update errors', async () => {
    const mockError = new Error('Failed to update profile');
    (profileService.updateUserProfile as jest.Mock).mockRejectedValue(mockError);
    
    const { result, waitForNextUpdate } = renderHook(() => useUserProfile(mockUserId));
    
    // Wait for initial profile load
    await waitForNextUpdate();
    
    // Attempt update
    act(() => {
      result.current.updateProfile({ name: 'New Name' });
    });
    
    // Wait for update error
    await waitForNextUpdate();
    
    // Check error state
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.updateError).toBe(mockError);
    expect(result.current.profile).toEqual(mockProfile); // Original profile unchanged
  });
  
  it('should refetch profile data', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useUserProfile(mockUserId));
    
    // Wait for initial profile load
    await waitForNextUpdate();
    
    // Reset mock and setup new response
    (profileService.getUserProfile as jest.Mock).mockClear();
    const updatedMockProfile = { ...mockProfile, name: 'Refreshed Name' };
    (profileService.getUserProfile as jest.Mock).mockResolvedValue(updatedMockProfile);
    
    // Refetch profile
    act(() => {
      result.current.refetch();
    });
    
    // Check loading state during refetch
    expect(result.current.isLoading).toBe(true);
    
    // Wait for refetch to complete
    await waitForNextUpdate();
    
    // Check refetched state
    expect(result.current.isLoading).toBe(false);
    expect(result.current.profile).toEqual(updatedMockProfile);
    expect(profileService.getUserProfile).toHaveBeenCalledTimes(1);
  });
  
  it('should update userId when it changes', async () => {
    const newUserId = 'user-456';
    const { result, waitForNextUpdate, rerender } = renderHook(
      ({ userId }) => useUserProfile(userId),
      { initialProps: { userId: mockUserId } }
    );
    
    // Wait for initial profile load
    await waitForNextUpdate();
    
    // Reset mock and setup new response for new user
    (profileService.getUserProfile as jest.Mock).mockClear();
    const newUserProfile = { ...mockProfile, id: newUserId, name: 'New User' };
    (profileService.getUserProfile as jest.Mock).mockResolvedValue(newUserProfile);
    
    // Change userId
    rerender({ userId: newUserId });
    
    // Check loading state after userId change
    expect(result.current.isLoading).toBe(true);
    
    // Wait for new profile to load
    await waitForNextUpdate();
    
    // Check new profile loaded
    expect(result.current.profile).toEqual(newUserProfile);
    expect(profileService.getUserProfile).toHaveBeenCalledWith(newUserId);
  });
});