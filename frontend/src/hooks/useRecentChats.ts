/**
 * React hook for managing recent chats with SWR caching strategy
 * Implements: Instant localStorage display + background DB sync
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import chatsService from '../services/chatsService';
import {
  getCachedRecentChats,
  setCachedRecentChats,
  updateCachedChat,
  removeCachedChat,
  addNewChatToRecent,
  clearCachedRecentChats,
  CachedChat,
} from '../lib/localStorageUtils';
import { useAuthStore } from '../stores/authStore';

interface UseRecentChatsReturn {
  chats: CachedChat[];
  isLoading: boolean;
  isBackgroundRefreshing: boolean;
  error: string | null;
  refreshChats: (force?: boolean) => Promise<void>;
  addChat: (chat: CachedChat) => void;
  updateChat: (chat: CachedChat) => void;
  removeChat: (chatId: string) => void;
  clearCache: () => void;
}

/**
 * Transform API response to cached chat format
 */
const transformApiResponse = (apiChats: Array<{ id: string; title?: string; last_message_at?: string; updated_at?: string; created_at?: string; last_message?: string; unread_count?: number; [key: string]: unknown }>): CachedChat[] => {
  const isPlaceholder = (t?: string) => !t || /^(new chat|untitled chat)$/i.test(t.trim());
  const deriveTitle = (t?: string) => {
    const src = (t || '').trim();
    if (!src) return 'Untitled Chat';
    return src.replace(/\s+/g, ' ').slice(0, 48);
  };
  return apiChats.map(chat => ({
    id: chat.id,
    title: isPlaceholder(chat.title) ? deriveTitle(chat.last_message) : (chat.title || 'Untitled Chat'),
    last_message_at: chat.last_message_at || chat.updated_at,
    created_at: chat.created_at,
    updated_at: chat.updated_at,
    last_message: typeof chat.last_message === 'string' ? chat.last_message : undefined,
    unread_count: typeof chat.unread_count === 'number' ? chat.unread_count : 0,
  }));
};

export function useRecentChats(): UseRecentChatsReturn {
  const [chats, setChats] = useState<CachedChat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backgroundFetchRef = useRef<boolean>(false);
  
  // Add authentication state
  const { session } = useAuthStore();

  /**
   * Fetch chats from backend (Redis → Supabase) with cursor-based pagination
   */
  const fetchChatsFromBackend = useCallback(async (force = false, cursor?: string): Promise<CachedChat[]> => {
    try {
      const params: Record<string, any> = force ? { force: true, _t: Date.now() } : {};
      if (cursor) {
        params.cursor = cursor;
        params.direction = 'next';
      }
      
      const response = await chatsService.getChatSessions(params);
      
      // Check if response exists and has data
      if (!response) {
        console.warn('No response received from chatsService, returning empty array');
        return [];
      }
      
      // Handle cursor-based pagination response format
      if (response.data) {
        // New cursor-based format: { data: [...], pagination: { hasMore, nextCursor, ... } }
        if (Array.isArray(response.data)) {
          return transformApiResponse(response.data);
        }
        // Backend cached format: { data: { data: [...], timestamp: ..., userId: ... }, cached: true }
        else if (response.data.data && Array.isArray(response.data.data)) {
          return transformApiResponse(response.data.data);
        }
        // Redis cached format: { data: { output: [...] } }
        else if (response.data.output && Array.isArray(response.data.output)) {
          return transformApiResponse(response.data.output);
        }
        // Handle null/undefined data (no chats available)
        else if (response.data.data === null || response.data.data === undefined) {
          return [];
        }
      }
      
      console.warn('Unexpected response format, returning empty array:', response?.data);
      return [];
    } catch (error) {
      console.error('Error fetching chats from backend:', error);
      return [];
    }
  }, []);

  /**
   * SWR load chats: ALWAYS prioritize localStorage for instant display
   */
  const loadChats = useCallback(async (force = false) => {
    try {
      setError(null);
      
      // Step 1: ALWAYS show localStorage data first - NO CONDITIONS
      const cachedChats = getCachedRecentChats();
      
      if (cachedChats && cachedChats.length > 0) {
        setChats(cachedChats);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
      
      // Step 2: Background sync if authenticated (even when cache exists)
      // This keeps UI responsive with cached data while ensuring data freshness
      if (session?.access_token) {
        if (!backgroundFetchRef.current) {
          backgroundFetchRef.current = true;
          setIsBackgroundRefreshing(true);
          
          try {
            const freshChats = await fetchChatsFromBackend(force);
            
            // Merge fresh data with cached optimistic items to avoid flicker/removal
            const cachedChatsLatest = getCachedRecentChats() || [];
            const byId: Record<string, CachedChat> = {};
            for (const chat of freshChats || []) {
              byId[chat.id] = chat;
            }
            for (const localChat of cachedChatsLatest) {
              if (!byId[localChat.id]) {
                byId[localChat.id] = localChat;
              }
            }
            const merged = Object.values(byId);
            const sortedLimited = merged
              .sort((a, b) => new Date(b.last_message_at || b.updated_at).getTime() - new Date(a.last_message_at || a.updated_at).getTime())
              .slice(0, 20);
            
            setChats(sortedLimited);
            setCachedRecentChats(sortedLimited);
          } catch (bgError) {
            console.warn('Background sync failed, keeping cached data:', bgError);
            // Don't set error if we have cached data
            if (!cachedChats || cachedChats.length === 0) {
              setError(bgError instanceof Error ? bgError.message : 'Failed to load chats');
            }
          } finally {
            setIsBackgroundRefreshing(false);
            backgroundFetchRef.current = false;
          }
        }
      }
      
    } catch (err) {
      console.error('Error loading chats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chats');
      
      // ALWAYS fallback to cache on any error
      const cachedChats = getCachedRecentChats();
      if (cachedChats && cachedChats.length > 0) {
        setChats(cachedChats);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchChatsFromBackend, session]);

  // Initial load: ALWAYS show cached data immediately on mount
  useEffect(() => {
    // Step 1: Show cached data immediately, no conditions
    const cachedChats = getCachedRecentChats();
    if (cachedChats && cachedChats.length > 0) {
      setChats(cachedChats);
      setIsLoading(false);
    }
    
    // Step 2: Load fresh data if needed
    loadChats();
  }, []); // Remove session dependency to prevent re-runs

  /**
   * Refresh chats (public API)
   */
  const refreshChats = useCallback(async (force = false) => {
    backgroundFetchRef.current = false; // Reset background fetch flag
    await loadChats(force);
  }, [loadChats]);

  /**
   * Add a new chat (optimistic update with SWR)
   */
  const addChat = useCallback((newChat: CachedChat) => {
    // Optimistic update: add to UI immediately
    setChats(prevChats => {
      const updatedChats = [newChat, ...prevChats.filter(c => c.id !== newChat.id)].slice(0, 20);
      return updatedChats;
    });
    
    // Update localStorage
    addNewChatToRecent(newChat);
  }, []);

  /**
   * Update an existing chat (optimistic update with SWR)
   */
  const updateChat = useCallback((updatedChat: CachedChat) => {
    // Optimistic update: update UI immediately
    setChats(prevChats => {
      const chatIndex = prevChats.findIndex(chat => chat.id === updatedChat.id);
      if (chatIndex >= 0) {
        const updatedChats = [...prevChats];
        updatedChats[chatIndex] = updatedChat;
        return updatedChats;
      }
      return prevChats;
    });
    
    // Update localStorage
    updateCachedChat(updatedChat);
  }, []);

  /**
   * Remove a chat (optimistic update with SWR)
   */
  const removeChat = useCallback((chatId: string) => {
    // Optimistic update: remove from UI immediately
    setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    
    // Update localStorage
    removeCachedChat(chatId);
  }, []);

  /**
   * Clear all cached data
   */
  const clearCache = useCallback(() => {
    setChats([]);
    clearCachedRecentChats();
  }, []);

  return {
    chats,
    isLoading,
    isBackgroundRefreshing,
    error,
    refreshChats,
    addChat,
    updateChat,
    removeChat,
    clearCache,
  };
}

// Global refresh function for external use
let globalRefreshSidebar: (() => void) | null = null;

export const refreshSidebar = () => {
  if (globalRefreshSidebar) {
    globalRefreshSidebar();
  }
};

// Set global refresh function
export const setGlobalRefreshSidebar = (refreshFn: () => void) => {
  globalRefreshSidebar = refreshFn;
};