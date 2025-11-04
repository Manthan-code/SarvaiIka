/**
 * LocalStorage utility functions for SWR caching strategy
 * Implements instant UI with background sync
 */

// Types for cached data
export interface CachedChat {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
  unread_count?: number;
}

export interface CachedMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  chat_id: string;
  user_id: string; // Add this required field
  tokens?: number;
  model_used?: string;
  parent_message_id?: string; // Add for compatibility
  metadata?: Record<string, unknown>; // Add for compatibility
}

export interface CachedUserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  website?: string;
  subscription_plan: string;
  updated_at: string;
}

export interface CachedSubscription {
  id: string;
  plan_details: {
    name: string;
    features: string[];
    price: number;
  };
  status: string;
  current_period_end?: string;
  updated_at: string;
}

export interface CachedPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  price_display: string;
  period: string;
  features: string[];
  icon?: string | React.ComponentType;
  popular?: boolean;
  is_active: boolean;
}



// To this (add export):
export const CACHE_KEYS = {
  RECENT_CHATS: 'ai_agent_recent_chats',
  ACTIVE_MESSAGES: 'ai_agent_active_messages',
  USER_PROFILE: 'ai_agent_user_profile',
  SUBSCRIPTION: 'ai_agent_subscription',
  PLANS: 'ai_agent_plans',
} as const;

// SWR Cache expiry times
// Change the CACHE_EXPIRY configuration (around line 77):
const CACHE_EXPIRY = {
  RECENT_CHATS: Infinity, // Never expire - persist until logout
  ACTIVE_MESSAGES: Infinity, // Changed from 10 * 60 * 1000 to Infinity - persist until logout
  USER_PROFILE: Infinity, // Never expire - persist until logout
  SUBSCRIPTION: Infinity, // Never expire - persist until logout
  PLANS: Infinity, // Never expire - persist until logout
} as const;

// Cache limits
const CACHE_LIMITS = {
  RECENT_CHATS: 20, // Max 20 recent chats
  ACTIVE_MESSAGES: 40, // Max 40 latest messages per chat
} as const;

// Generic cache interface
interface CacheData<T> {
  data: T;
  timestamp: number;
  // null indicates no expiry (persistent cache)
  expires_at: number | null;
}

/**
 * Generic function to get cached data from LocalStorage with expiry check
 */
function getCachedData<T>(key: string, skipExpiryCheck = false): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const parsedCache: CacheData<T> = JSON.parse(cached);
    
    // Perform expiry check only when expires_at is a finite number
    if (!skipExpiryCheck) {
      const exp = parsedCache.expires_at;
      if (exp != null && !Number.isNaN(exp) && Date.now() > exp) {
        localStorage.removeItem(key);
        return null;
      }
    }

    return parsedCache.data;
  } catch (error) {
    console.error(`Error reading cache for key ${key}:`, error);
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Generic function to set cached data in LocalStorage
 */
function setCachedData<T>(key: string, data: T, expiryMs: number): void {
  try {
    const cacheData: CacheData<T> = {
      data,
      timestamp: Date.now(),
      expires_at: expiryMs === Infinity ? null : Date.now() + expiryMs,
    };
    
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error(`Error setting cache for key ${key}:`, error);
  }
}

/**
 * Clear specific cache entry
 */
function clearCachedData(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error clearing cache for key ${key}:`, error);
  }
}

// ========== RECENT CHATS CACHE (SWR) ==========

/**
 * Get cached recent chats (max 20, persistent)
 */
export function getCachedRecentChats(): CachedChat[] | null {
  return getCachedData<CachedChat[]>(CACHE_KEYS.RECENT_CHATS, true); // Skip expiry check
}

/**
 * Cache recent chats with SWR strategy (max 20, persistent)
 */
export function setCachedRecentChats(chats: CachedChat[]): void {
  // Limit to 20 most recent chats
  const limitedChats = chats
    .sort((a, b) => new Date(b.last_message_at || b.updated_at).getTime() - new Date(a.last_message_at || a.updated_at).getTime())
    .slice(0, CACHE_LIMITS.RECENT_CHATS);
  
  setCachedData(CACHE_KEYS.RECENT_CHATS, limitedChats, CACHE_EXPIRY.RECENT_CHATS);
}

/**
 * Add new chat to the beginning of recent chats (SWR pattern)
 */
export function addNewChatToRecent(newChat: CachedChat): void {
  const cachedChats = getCachedRecentChats() || [];
  
  // Remove if already exists (to avoid duplicates)
  const filteredChats = cachedChats.filter(chat => chat.id !== newChat.id);
  
  // Add to beginning and limit to 20
  const updatedChats = [newChat, ...filteredChats].slice(0, CACHE_LIMITS.RECENT_CHATS);
  
  setCachedRecentChats(updatedChats);
}

/**
 * Update a single chat in recent chats cache
 */
export function updateCachedChat(updatedChat: CachedChat): void {
  const cachedChats = getCachedRecentChats() || [];
  const chatIndex = cachedChats.findIndex(chat => chat.id === updatedChat.id);
  
  if (chatIndex >= 0) {
    // Update existing chat
    cachedChats[chatIndex] = updatedChat;
    setCachedRecentChats(cachedChats);
  } else {
    // Add new chat if not found
    addNewChatToRecent(updatedChat);
  }
}

/**
 * Remove a chat from recent chats cache
 */
export function removeCachedChat(chatId: string): void {
  const cachedChats = getCachedRecentChats() || [];
  const filteredChats = cachedChats.filter(chat => chat.id !== chatId);
  setCachedRecentChats(filteredChats);
}

/**
 * Clear recent chats cache
 */
export function clearCachedRecentChats(): void {
  clearCachedData(CACHE_KEYS.RECENT_CHATS);
}

// ========== ACTIVE CHAT MESSAGES CACHE (SWR) ==========

/**
 * Get cached messages for active chat (max 5 latest, 10min expiry)
 */
export function getCachedActiveMessages(): { chatId: string; messages: CachedMessage[]; timestamp?: number } | null {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.ACTIVE_MESSAGES);
    if (!cached) return null;

    const parsedCache: CacheData<{ chatId: string; messages: CachedMessage[] }> = JSON.parse(cached);
    return {
      ...parsedCache.data,
      timestamp: parsedCache.timestamp
    };
  } catch {
    return null;
  }
}

/**
 * Cache active chat messages (max 5 latest, 10min expiry)
 */
export function setCachedActiveMessages(chatId: string, messages: CachedMessage[]): void {
  // Sort messages from oldest to newest and limit to 20 most recent messages
  const limitedMessages = messages
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-CACHE_LIMITS.ACTIVE_MESSAGES);
  
  const cacheData = {
    chatId,
    messages: limitedMessages
  };
  
  setCachedData(CACHE_KEYS.ACTIVE_MESSAGES, cacheData, CACHE_EXPIRY.ACTIVE_MESSAGES);
}

/**
 * Switch to a new active chat (clear old, cache new)
 */
export function switchToActiveChat(chatId: string, messages: CachedMessage[]): void {
  // Clear old active chat messages
  clearCachedData(CACHE_KEYS.ACTIVE_MESSAGES);
  
  // Cache new active chat messages
  if (messages && messages.length > 0) {
    setCachedActiveMessages(chatId, messages);
  }
}

/**
 * Add a new message to active chat cache
 */
export function addCachedActiveMessage(chatId: string, message: CachedMessage): void {
  const cached = getCachedActiveMessages();
  
  if (cached && cached.chatId === chatId) {
    // Add new message and maintain limit
    const updatedMessages = [message, ...cached.messages].slice(0, CACHE_LIMITS.ACTIVE_MESSAGES);
    setCachedActiveMessages(chatId, updatedMessages);
  } else {
    // Start new cache for this chat
    setCachedActiveMessages(chatId, [message]);
  }
}

/**
 * Check if a specific chat is currently cached as active
 */
export function isActiveChatCached(chatId: string): boolean {
  const cached = getCachedActiveMessages();
  return cached?.chatId === chatId;
}

/**
 * Clear all active messages cache
 */
export function clearAllCachedActiveMessages(): void {
  clearCachedData(CACHE_KEYS.ACTIVE_MESSAGES);
}

// ========== USER PROFILE CACHE (SWR) ==========

/**
 * Get cached user profile (persistent)
 */
// Option 1: Store directly, retrieve directly
export function getCachedUserProfile(): CachedUserProfile | null {
  return getCachedData<CachedUserProfile>(CACHE_KEYS.USER_PROFILE, true);
}

// Option 2: Or store with nested structure, retrieve with nested structure
export function setCachedUserProfile(profile: CachedUserProfile): void {
  setCachedData(CACHE_KEYS.USER_PROFILE, { user: profile }, CACHE_EXPIRY.USER_PROFILE);
}

/**
 * Clear user profile cache
 */
export function clearCachedUserProfile(): void {
  clearCachedData(CACHE_KEYS.USER_PROFILE);
}

// ========== SUBSCRIPTION CACHE (SWR) ==========

/**
 * Get cached subscription (persistent)
 */
export function getCachedSubscription(): CachedSubscription | null {
  return getCachedData<CachedSubscription>(CACHE_KEYS.SUBSCRIPTION, true); // Skip expiry check
}

/**
 * Cache subscription (persistent until logout)
 */
export function setCachedSubscription(subscription: CachedSubscription): void {
  setCachedData(CACHE_KEYS.SUBSCRIPTION, subscription, CACHE_EXPIRY.SUBSCRIPTION);
}

/**
 * Clear subscription cache
 */
export function clearCachedSubscription(): void {
  clearCachedData(CACHE_KEYS.SUBSCRIPTION);
}

/**
 * Check if subscription cache exists and is valid
 */
export function hasValidSubscriptionCache(): boolean {
  const cached = getCachedSubscription();
  return cached !== null && cached !== undefined;
}

/**
 * Force refresh subscription cache by clearing it
 * Use this when subscription is modified (upgrade/downgrade/cancel)
 */
export function invalidateSubscriptionCache(): void {
  clearCachedSubscription();
  console.log('Subscription cache invalidated - next request will fetch from DB');
}

/**
 * Get subscription with cache-first strategy
 * Returns cached data if available, null if cache miss (indicating DB fetch needed)
 */
export function getSubscriptionCacheFirst(): CachedSubscription | null {
  const cached = getCachedSubscription();
  if (cached) {
    console.log('Subscription served from cache');
    return cached;
  }
  console.log('Subscription cache miss - DB fetch required');
  return null;
}

/**
 * Set subscription cache after successful DB fetch
 * This should be called after login or subscription modification
 */
export function cacheSubscriptionFromDB(subscription: CachedSubscription): void {
  setCachedSubscription(subscription);
  console.log('Subscription cached from DB fetch');
}

// ========== PLANS CACHE (SWR) ==========

/**
 * Get cached plans (persistent)
 */
export function getCachedPlans(): CachedPlan[] | null {
  return getCachedData<CachedPlan[]>(CACHE_KEYS.PLANS, true); // Skip expiry check
}

/**
 * Cache plans (persistent until logout)
 */
export function setCachedPlans(plans: CachedPlan[]): void {
  setCachedData(CACHE_KEYS.PLANS, plans, CACHE_EXPIRY.PLANS);
}

/**
 * Clear plans cache
 */
export function clearCachedPlans(): void {
  clearCachedData(CACHE_KEYS.PLANS);
}

// ========== SELECTIVE CACHE MANAGEMENT ==========

/**
 * Resync only recent chats cache (when new chat is added)
 */
export function resyncRecentChatsOnly(): void {
  clearCachedRecentChats();
  console.log('Recent chats cache cleared for resync');
}

/**
 * Resync only subscription and plans cache (when subscription changes)
 */
export function resyncSubscriptionAndPlans(): void {
  clearCachedSubscription();
  clearCachedPlans();
  console.log('Subscription and plans cache cleared for resync');
}

/**
 * Resync only user profile cache (when profile is updated)
 */
export function resyncUserProfileOnly(): void {
  clearCachedUserProfile();
  console.log('User profile cache cleared for resync');
}

/**
 * Clear only auth-related cache (for logout)
 */
export function clearAuthCache(): void {
  clearCachedUserProfile();
  clearCachedSubscription();
  clearCachedPlans();
  clearCachedRecentChats();
  // Keep active messages cache as it expires automatically
  console.log('Auth-related cache cleared');
}

/**
 * Selective localStorage cleanup for signout
 * Preserves essential data while clearing session-specific data
 */
export function clearSessionDataOnSignout(): void {
  // Items to preserve (these should persist across sessions)
  const preservedItems = [
    'ai-agent-theme',           // User's theme preference
  ];

  // Get all preserved data before clearing
  const preservedData: Record<string, string | null> = {};
  preservedItems.forEach(key => {
    preservedData[key] = localStorage.getItem(key);
  });

  // Get all localStorage keys to process
  const allKeys = Object.keys(localStorage);
  
  // Clear all items except preserved ones
  allKeys.forEach(key => {
    // Skip preserved items
    if (preservedItems.includes(key)) {
      return;
    }
    
    // Clear all other items including:
    // - Chat data (ai_agent_recent_chats, ai_agent_messages_*, etc.)
    // - User profile and subscription data (ai_agent_user_profile, ai_agent_subscription, etc.)
    // - Plan data (ai_agent_plans, plans_data, etc.)
    // - Error tracking data (error_notification_*, error_tracking_data, etc.)
    // - Auth tokens (authToken, refreshToken, user, etc.)
    // - Supabase auth data (sb-*-auth-token, supabase.auth.*, etc.)
    // - Streaming metrics and other session data
    localStorage.removeItem(key);
  });

  // Restore preserved items
  preservedItems.forEach(key => {
    if (preservedData[key] !== null) {
      localStorage.setItem(key, preservedData[key]!);
    }
  });

  console.log('Session data cleared on signout, preserved essential data:', preservedItems);
  console.log('Cleared all localStorage except:', preservedItems);
}

/**
 * Check if cache needs refresh based on timestamp
 */
export function shouldRefreshCache(cacheKey: string, maxAgeMs: number = 5 * 60 * 1000): boolean {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return true;

    const parsedCache: CacheData<unknown> = JSON.parse(cached);
    return Date.now() - parsedCache.timestamp > maxAgeMs;
  } catch {
    return true;
  }
}

/**
 * Clear all cached data (useful for logout)
 */
export function clearAllCache(): void {
  Object.values(CACHE_KEYS).forEach(key => {
    clearCachedData(key);
  });
}

/**
 * Check if cache is expired for a specific key
 */
export function isCacheExpired(key: string): boolean {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return true;

    const parsedCache: CacheData<unknown> = JSON.parse(cached);
    const exp = parsedCache.expires_at;
    return exp != null && !Number.isNaN(exp) && Date.now() > exp;
  } catch {
    return true;
  }
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): Record<string, { exists: boolean; expired: boolean; size: number }> {
  const stats: Record<string, { exists: boolean; expired: boolean; size: number }> = {};
  
  Object.entries(CACHE_KEYS).forEach(([name, key]) => {
    const cached = localStorage.getItem(key);
    stats[name] = {
      exists: !!cached,
      expired: cached ? isCacheExpired(key) : true,
      size: cached ? cached.length : 0,
    };
  });
  
  return stats;
}