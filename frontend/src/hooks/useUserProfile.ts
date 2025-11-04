/**
 * SWR hook for user profile management
 * Instant localStorage display + update-only refresh
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore, cacheInvalidationEmitter } from '../stores/authStore';
import { apiClient } from '../utils/apiClient';
import {
  getCachedUserProfile,
  setCachedUserProfile,
  clearCachedUserProfile,
  CachedUserProfile,
} from '../lib/localStorageUtils';

interface UseUserProfileReturn {
  profile: CachedUserProfile | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  updateProfile: (updates: Partial<CachedUserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function useUserProfile(): UseUserProfileReturn {
  const [profile, setProfile] = useState<CachedUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { session } = useAuthStore();

  /**
   * Fetch profile from backend
   */
  const fetchProfileFromBackend = useCallback(async (): Promise<CachedUserProfile | null> => {
    if (!session?.access_token) return null;
    
    try {
      const response = await apiClient.get('/api/auth/profile');
      
      if (response.user) {
        // Extract the user property from the response
        return response.user;
      } else {
        throw new Error('Failed to fetch profile');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  }, [session]);

  /**
   * Load profile: Show cached immediately, no background sync unless requested
   */
  const loadProfile = useCallback(async (forceRefresh = false) => {
    try {
      setError(null);
      
      // Always show cached data first
      const cachedProfile = getCachedUserProfile();
      if (cachedProfile) {
        setProfile(cachedProfile);
        setIsLoading(false);
        
        // Don't background sync unless forced
        if (!forceRefresh) {
          return;
        }
      } else {
        setIsLoading(true);
      }
      
      // This should only run if no cache OR forceRefresh is true
      if (session?.access_token && (forceRefresh || !cachedProfile)) {
        const freshProfile = await fetchProfileFromBackend();
        if (freshProfile) {
          setProfile(freshProfile);
          setCachedUserProfile(freshProfile);
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      
      // Fallback to cache
      const cachedProfile = getCachedUserProfile();
      if (cachedProfile) {
        setProfile(cachedProfile);
      }
    } finally {
      setIsLoading(false);
    }
  }, [session, fetchProfileFromBackend]);

  /**
   * Update profile: Optimistic update + backend sync
   */
  const updateProfile = useCallback(async (updates: Partial<CachedUserProfile>) => {
    if (!profile || !session?.access_token) return;
    
    const updatedProfile = { ...profile, ...updates, updated_at: new Date().toISOString() };
    
    // Optimistic update
    setProfile(updatedProfile);
    setCachedUserProfile(updatedProfile);
    
    setIsUpdating(true);
    setError(null);
    
    try {
      const response = await apiClient.put('/api/auth/profile', updates);
      
      if (response.user) {
        // Update with server response
        const serverProfile = response.user;
        setProfile(serverProfile);
        setCachedUserProfile(serverProfile);
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
      
      // Revert optimistic update
      setProfile(profile);
      setCachedUserProfile(profile);
    } finally {
      setIsUpdating(false);
    }
  }, [profile, session]);

  /**
   * Force refresh profile from backend
   */
  const refreshProfile = useCallback(async () => {
    await loadProfile(true);
  }, [loadProfile]);

  // Initial load: Show cached data immediately
  useEffect(() => {
    const cachedProfile = getCachedUserProfile();
    if (cachedProfile) {
      setProfile(cachedProfile);
    } else if (session?.access_token) {
      loadProfile();
    }
  }, [session]);

  // Clear profile when user logs out
  useEffect(() => {
    if (!session?.access_token) {
      setProfile(null);
      setError(null);
      clearCachedUserProfile();
    }
  }, [session]);

  // Listen for cache invalidation events from authStore
  useEffect(() => {
    const unsubscribe = cacheInvalidationEmitter.subscribe((event) => {
      if (event === 'profile' || event === 'all') {
        console.log('useUserProfile: Cache invalidation event received, forcing refresh');
        loadProfile(true); // Force refresh
      }
    });

    return unsubscribe;
  }, [loadProfile]);

  return {
    profile,
    isLoading,
    isUpdating,
    error,
    updateProfile,
    refreshProfile,
  };
}