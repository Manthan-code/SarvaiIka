import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore, cacheInvalidationEmitter } from '@/stores/authStore';
import { apiClient } from '@/utils/apiClient';
import { profileCircuitBreaker, CircuitState } from '@/utils/circuitBreaker';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'moderator';
  subscription_plan: 'free' | 'plus' | 'pro';
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

interface UseUserRoleReturn {
  profile: UserProfile | null;
  role: 'user' | 'admin' | 'moderator' | null;
  isAdmin: boolean;
  isModerator: boolean;
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
}

const CACHE_KEY = 'ai_agent_user_profile_with_role';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache utilities
function getCachedProfile(): UserProfile | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    if (now - timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return data;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function setCachedProfile(profile: UserProfile): void {
  try {
    const cacheData = {
      data: profile,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to cache user profile:', error);
  }
}

function clearCachedProfile(): void {
  localStorage.removeItem(CACHE_KEY);
}

// Export function to clear cache from outside
export function clearUserRoleCache(): void {
  clearCachedProfile();
}

export function useUserRole(): UseUserRoleReturn {
  // Safely read from auth store state without invoking hooks inside nested functions
  const authState = (useAuthStore as any).getState?.() ?? useAuthStore.getState();
  const user = authState?.user || null;
  const session = authState?.session || null;
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    // Initialize with cached profile if available
    return getCachedProfile();
  });
  const [isLoading, setIsLoading] = useState(() => {
    // Only show loading if no cached profile is available
    return !getCachedProfile();
  });
  const [error, setError] = useState<string | null>(null);
  const isLoggedOutRef = useRef<boolean>(false);
  const fetchSeqRef = useRef<number>(0);

  const fetchProfile = useCallback(async (force = false, retryCount = 0) => {
    // Start a new fetch sequence
    const seq = ++fetchSeqRef.current;
    // Avoid work if logout has been triggered
    if (isLoggedOutRef.current) {
      setIsLoading(false);
      return;
    }
    // Read auth state via hook to align with test mocks
    const state = (useAuthStore as any).getState?.() ?? useAuthStore.getState();
    const currentUser = state?.user;
    const currentSession = state?.session;
    if (!currentUser || !currentSession) {
      isLoggedOutRef.current = true;
      setProfile(null);
      setIsLoading(false);
      setError(null);
      clearCachedProfile();
      return;
    }

    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    try {
      // Do not clear error preemptively; only clear on success
      
      // Check cache first unless force refresh
      if (!force) {
        const cachedProfile = getCachedProfile();
        if (cachedProfile) {
          setProfile(cachedProfile);
          setIsLoading(false);
          return;
        }
      }

      // Only set loading to true if we don't have a cached profile
      // This prevents loading screens when switching tabs with valid cache
      if (!profile || force) {
        setIsLoading(true);
      }
      
      // Fetch from backend with circuit breaker protection
      console.log('🔍 useUserRole: Fetching profile from /api/auth/profile');
      console.log('🔍 useUserRole: apiClient.get typeof =', typeof (apiClient as any).get, 'isMock?', !!(apiClient as any).get?.mock);
      const executed = await profileCircuitBreaker.execute(async () => {
        console.log('🔍 useUserRole: inside circuitBreaker.execute, calling apiClient.get("/api/auth/profile")');
        return apiClient.get('/api/auth/profile');
      });
      // Some tests mock execute to return the provided function without invoking it.
      // Handle both cases: either we received the response or a thunk that must be called.
      const response = typeof executed === 'function' ? await executed() : await executed;
      
      console.log('🔍 useUserRole: Profile response received:', response);

      // If logout occurred while fetching, do not update state
      const latest = (useAuthStore as any).getState?.() ?? useAuthStore.getState();
      if (!latest?.user || !latest?.session || isLoggedOutRef.current) {
        setIsLoading(false);
        return;
      }
      // Ensure only latest fetch sequence can update state
      if (seq !== fetchSeqRef.current) {
        setIsLoading(false);
        return;
      }
      
      if (response.user) {
        const userProfile = response.user;
        console.log('🔍 useUserRole: User profile data:', userProfile);
        console.log('🔍 useUserRole: User role:', userProfile.role);
        console.log('🔍 useUserRole: Is admin?', userProfile.role === 'admin');
        if (isLoggedOutRef.current || seq !== fetchSeqRef.current) {
          setIsLoading(false);
          return;
        }
        setProfile(userProfile);
        setCachedProfile(userProfile);
        // Clear any stale error only after successful update
        setError(null);
      } else {
        console.error('🔍 useUserRole: Invalid profile response - no user field');
        throw new Error('Invalid profile response');
      }
    } catch (err: any) {
      console.error('Failed to fetch user profile:', err);
      
      const statusCode = err.statusCode || err.response?.status;
      
      // Handle rate limiting with exponential backoff
      if (statusCode === 429 && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
        console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        // Surface a user-visible error immediately without clearing cache
        setError('Too many requests. Please wait a moment before trying again.');
        
        setTimeout(() => {
          fetchProfile(force, retryCount + 1);
        }, delay);
        return;
      }
      
      // Handle different types of errors
      if (err.message?.includes('Circuit breaker is OPEN')) {
        setError('Service temporarily unavailable. Please try again in a moment.');
      } else if (statusCode === 401) {
        setError('Authentication required. Please log in.');
      } else if (statusCode === 429) {
        setError('Too many requests. Please wait a moment before trying again.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to fetch profile');
      }
      
      // Clear cache on error (except for rate limiting)
      if (statusCode !== 429) {
        clearCachedProfile();
        setProfile(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Track the current user ID to avoid unnecessary fetches on token refresh
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    const state = (useAuthStore as any).getState?.() ?? useAuthStore.getState();
    return state?.user?.id || null;
  });

  // Initial fetch and user change handling
  useEffect(() => {
    // Re-read latest auth state at mount to avoid stale closure
    console.log('useUserRole: typeof subscribe at mount =', typeof (useAuthStore as any).subscribe);
    const state = (useAuthStore as any).getState?.() ?? useAuthStore.getState();
    console.log('useUserRole: initial auth state at mount =', state);
    const hasAuth = !!(state?.user && state?.session);
    console.log('useUserRole: hasAuth at mount =', hasAuth);

    if (!hasAuth) {
      // Ensure clean state when unauthenticated
      isLoggedOutRef.current = true;
      ++fetchSeqRef.current; // invalidate any in-flight fetches
      setProfile(null);
      setError(null);
      clearCachedProfile();
      setCurrentUserId(null);
      console.log('useUserRole: not authenticated at mount, exiting without fetch');
      return;
    }

    isLoggedOutRef.current = false;
    // Always attempt fetch on mount when authenticated.
    // fetchProfile will avoid setting loading when cached exists and may return cached immediately.
    console.log('useUserRole: authenticated at mount, calling fetchProfile');
    fetchProfile();
  }, [fetchProfile]);

  // Monitor auth store changes to detect user changes
  useEffect(() => {
    console.log('useUserRole: Subscribing to auth store changes');
    console.log('useUserRole: subscribe type =', typeof (useAuthStore as any).subscribe);
    const unsubscribe = (useAuthStore as any).subscribe?.((state: any) => {
      console.log('useUserRole: Subscription callback invoked with state =', state);
      const { user: currentUser, session: currentSession } = state || {};
      if (!currentUser || !currentSession) {
        // User logged out
        console.log('🔍 useUserRole: Logout detected, clearing profile');
        isLoggedOutRef.current = true;
        ++fetchSeqRef.current; // invalidate any in-flight fetches
        setProfile(null);
        clearCachedProfile();
        setCurrentUserId(null);
      } else if (currentUser.id !== currentUserId) {
        // User actually changed (not just token refresh)
        console.log('useUserRole: User ID changed, fetching profile');
        isLoggedOutRef.current = false;
        setCurrentUserId(currentUser.id);
        fetchProfile();
      }
    }) || (() => {});

    return unsubscribe;
  }, [currentUserId, fetchProfile]);

  // Listen for cache invalidation events from authStore
  useEffect(() => {
    const unsubscribe = cacheInvalidationEmitter.subscribe((event) => {
      if (event === 'profile' || event === 'all') {
        console.log('useUserRole: Cache invalidation event received, checking if refresh needed');
        // Only force refresh if we don't have a valid cached profile
        const cachedProfile = getCachedProfile();
        if (!cachedProfile) {
          console.log('useUserRole: No valid cache found, forcing refresh');
          fetchProfile(true); // Force refresh
        } else {
          console.log('useUserRole: Valid cache exists, skipping refresh');
        }
      }
      // Removed unsupported 'auth-logout' event case (not part of CacheInvalidationEvent union)
    });

    return unsubscribe;
  }, [fetchProfile]);

  // Add a public refresh function for consumers
  const refreshProfile = useCallback(async () => {
    await fetchProfile(true);
  }, [fetchProfile]);

  const role = profile?.role || null;
  const isAdmin = role === 'admin';
  const isModerator = role === 'moderator';

  return {
    profile,
    role,
    isAdmin,
    isModerator,
    isLoading,
    error,
    refreshProfile
  };
}