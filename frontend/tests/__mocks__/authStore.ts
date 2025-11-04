// Jest mock for the auth store used across tests
// Provides both the hook and a getState accessor similar to Zustand's store

const store = {
  user: { email: 'test@example.com', id: 'user-1' },
  session: { access_token: 'token' },
  loading: false,
  isAuthenticated: () => true,
  setUser: jest.fn(),
  setSession: jest.fn(),
  setLoading: jest.fn(),
  signOut: jest.fn(),
  initializeAuth: jest.fn(),
  clearAuthState: jest.fn(),
  resyncCacheSelectively: jest.fn(),
  cacheUserSubscriptionOnLogin: jest.fn(),
};

export const useAuthStore = jest.fn(() => store);
// Provide getState and subscribe similar to Zustand
(useAuthStore as any).getState = () => store;
// Ensure subscribers are shared across any duplicate module instances via global registry
const globalSubscribersKey = '__AUTH_STORE_SUBSCRIBERS__';
const subscribers: Set<(state: any) => void> = (globalThis as any)[globalSubscribersKey] || new Set();
(globalThis as any)[globalSubscribersKey] = subscribers;
(useAuthStore as any).subscribe = (cb: (state: any) => void) => {
  console.log('[mock authStore] subscribe called, current subscriber count =', subscribers.size);
  subscribers.add(cb);
  console.log('[mock authStore] subscriber added, new count =', subscribers.size);
  return () => {
    subscribers.delete(cb);
    console.log('[mock authStore] subscriber removed, new count =', subscribers.size);
  };
};
// Helper for tests to emit auth changes
(useAuthStore as any).__emit = (state: any) => {
  console.log('[mock authStore] __emit called with state =', state);
  console.log('[mock authStore] notifying', subscribers.size, 'subscribers');
  subscribers.forEach((cb) => cb(state));
  // Emit a cache invalidation logout event for hooks that listen via emitter
  if (!state?.user || !state?.session) {
    console.log('[mock authStore] emitting auth-logout via cacheInvalidationEmitter');
    cacheInvalidationEmitter.emit('auth-logout');
  }
};

// Functional stub for cacheInvalidationEmitter used by hooks
class DummyEmitter {
  private listeners = new Set<(event: string) => void>();
  subscribe(listener: (event: string) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(event: string) {
    this.listeners.forEach((l) => l(event));
  }
}

// Share emitter across potential duplicate module instances
const globalEmitterKey = '__AUTH_CACHE_INVALIDATION_EMITTER__';
const sharedEmitter: DummyEmitter = (globalThis as any)[globalEmitterKey] || new DummyEmitter();
(globalThis as any)[globalEmitterKey] = sharedEmitter;

export const cacheInvalidationEmitter = sharedEmitter;