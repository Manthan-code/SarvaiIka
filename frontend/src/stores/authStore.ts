import { create } from 'zustand';
import supabase from '../services/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';
import { 
  clearAuthCache, 
  clearSessionDataOnSignout,
  resyncRecentChatsOnly, 
  resyncSubscriptionAndPlans,
  shouldRefreshCache,
  CACHE_KEYS,
  hasValidSubscriptionCache,
  cacheSubscriptionFromDB
} from '../lib/localStorageUtils';

// Event emitter for cache invalidation
type CacheInvalidationEvent = 'profile' | 'subscription' | 'all';
type CacheInvalidationListener = (event: CacheInvalidationEvent) => void;

class CacheInvalidationEmitter {
  private listeners: CacheInvalidationListener[] = [];

  subscribe(listener: CacheInvalidationListener) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  emit(event: CacheInvalidationEvent) {
    this.listeners.forEach(listener => listener(event));
  }
}

export const cacheInvalidationEmitter = new CacheInvalidationEmitter();

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  isAuthenticated: () => boolean;
  clearAuthState: () => void;
  resyncCacheSelectively: () => Promise<void>;
  cacheUserSubscriptionOnLogin: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,

  setUser: (user) => set({ user }),
  setSession: (session) => {
    const currentSession = get().session;
    // Only update if session actually changed (prevent unnecessary re-renders)
    if (currentSession?.access_token !== session?.access_token || 
        currentSession?.refresh_token !== session?.refresh_token ||
        (!currentSession && session) || 
        (currentSession && !session)) {
      set({ session });
    }
  },
  setLoading: (loading) => set({ loading }),

  isAuthenticated: () => {
    const { session } = get();
    return !!session;
  },

  clearAuthState: () => {
    // Use selective cleanup that preserves essential data (theme, plans)
    // while clearing all session-specific data
    clearSessionDataOnSignout();
    
    set({ user: null, session: null });
  },

  resyncCacheSelectively: async () => {
    // Only refresh cache if it's older than 15 minutes (increased from 5 minutes)
    // This prevents frequent cache invalidation during normal navigation
    const shouldRefreshProfile = shouldRefreshCache('ai_agent_user_profile_with_role', 15 * 60 * 1000);
    const shouldRefreshSubscription = shouldRefreshCache('ai_agent_subscription', 15 * 60 * 1000);
    
    let invalidatedSomething = false;
    
    if (shouldRefreshProfile) {
      console.log('User profile cache is stale (>15min), clearing and notifying hooks');
      // Clear the stale profile cache
      localStorage.removeItem('ai_agent_user_profile');
      localStorage.removeItem('ai_agent_user_profile_with_role');
      // Emit invalidation event for profile
      cacheInvalidationEmitter.emit('profile');
      invalidatedSomething = true;
    }
    
    if (shouldRefreshSubscription) {
      console.log('Subscription cache is stale (>15min), clearing and notifying hooks');
      // Clear the stale subscription cache
      localStorage.removeItem('ai_agent_subscription');
      // Emit invalidation event for subscription
      cacheInvalidationEmitter.emit('subscription');
      invalidatedSomething = true;
    }
    
    if (invalidatedSomething) {
      console.log('Cache invalidation completed - hooks should refresh');
    } else {
      console.log('All caches are fresh - no invalidation needed');
    }
  },

  cacheUserSubscriptionOnLogin: async () => {
    const { session } = get();
    
    // Only fetch if user is authenticated and no valid cache exists
    if (!session || hasValidSubscriptionCache()) {
      return;
    }

    try {
      console.log('Fetching user subscription on login for caching...');
      
      // Import subscriptionsService dynamically to avoid circular dependencies
      const { default: subscriptionsService } = await import('../services/subscriptionsService');
      
      const response = await subscriptionsService.getCurrentUserSubscription();
      
      if (response) {
        const subscriptionData = response;
        
        // Cache the subscription data
        const cacheData = {
          id: subscriptionData.id || 'user-subscription',
          plan_details: subscriptionData.plan_details || {
            name: subscriptionData.plan || 'free',
            features: [],
            price: 0,
          },
          status: subscriptionData.status || 'active',
          current_period_end: subscriptionData.current_period_end,
          updated_at: new Date().toISOString(),
        };
        
        cacheSubscriptionFromDB(cacheData);
        console.log('User subscription cached successfully on login');
      }
    } catch (error) {
      console.error('Failed to cache subscription on login:', error);
      // Don't throw - this is a background operation
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    get().clearAuthState();
  },

  initializeAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // User is logged in - set session without cache check
        // Cache checking is now handled in App component based on initial load detection
        set({ session, user: session?.user || null, loading: false });
      } else {
        // No session - clear auth cache only
        get().clearAuthState();
        set({ loading: false });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      get().clearAuthState();
      set({ loading: false });
    }
  },
}));

// Listen to auth changes
supabase.auth.onAuthStateChange(async (event, session) => {
  const { setUser, setSession, clearAuthState, resyncCacheSelectively, cacheUserSubscriptionOnLogin } = useAuthStore.getState();
  
  if (event === 'SIGNED_IN' && session) {
    // User signed in - set session but avoid cache resync to prevent profile reload
    // Cache will be checked only on initial app load via initializeAuth
    console.log('SIGNED_IN event - setting session and caching subscription');
    setSession(session);
    setUser(session.user);
    
    // Cache user subscription on login (background operation)
    cacheUserSubscriptionOnLogin();
  } else if (event === 'SIGNED_OUT') {
    // User signed out - clear auth cache only
    clearAuthState();
  } else if (event === 'TOKEN_REFRESHED' && session) {
    // Token refreshed - update session but keep all cache
    setSession(session);
    setUser(session.user);
  }
});