import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../utils/apiClient';
import { 
  getCachedActiveMessages, 
  switchToActiveChat, 
  clearAllCachedActiveMessages,
  getCachedRecentChats,
  updateCachedChat
} from '../lib/localStorageUtils';

interface CachedMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  chat_id: string;
  user_id: string;
  tokens?: number;
  model_used?: string;
  parent_message_id?: string;
  metadata?: Record<string, unknown>;
}

interface Chat {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

interface UseActiveChatReturn {
  messages: CachedMessage[];
  isLoading: boolean;
  error: string | null;
  currentChatId: string | null;
  currentChat: Chat | null;
  loadMessages: (chatId: string, forceRefresh?: boolean) => Promise<void>;
  addMessage: (message: CachedMessage) => void;
  clearMessages: () => void;
  sendMessage: (content: string, chatId: string) => Promise<string | null>;
  switchChat: (chatId: string) => void;
  refreshMessages: () => void;
}

export function useActiveChat(): UseActiveChatReturn {
  const { session } = useAuthStore();
  const [messages, setMessages] = useState<CachedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  
  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Normalize various possible API response shapes to a string output
  const normalizeOutput = useCallback((raw: any): string | null => {
    if (raw == null) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
    if (typeof raw === 'object') {
      // Common shapes
      if (typeof raw.output === 'string') return raw.output;
      if (typeof raw.text === 'string') return raw.text;
      // Fallback: stringify minimally to avoid rendering objects
      try {
        const json = JSON.stringify(raw);
        return json;
      } catch {
        return String(raw);
      }
    }
    return null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const transformMessage = useCallback((message: {
    id?: string;
    content?: any;
    role?: 'user' | 'assistant' | string;
    timestamp?: string;
    created_at?: string;
    chat_id?: string;
    user_id?: string;
    tokens?: number;
    model_used?: string;
    parent_message_id?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  }): CachedMessage => {
    // Ensure content is a string to avoid React rendering objects
    const normalizedContent = normalizeOutput((message as any).content);
    return {
      id: message.id || `${Date.now()}-${Math.random()}`,
      content: typeof normalizedContent === 'string' ? normalizedContent : '',
      role: (message.role === 'user' || message.role === 'assistant') ? message.role : 'user',
      timestamp: message.timestamp || message.created_at || new Date().toISOString(),
      chat_id: message.chat_id || currentChatId || '',
      user_id: message.user_id || session?.user?.id || 'unknown',
      tokens: message.tokens,
      model_used: message.model_used,
      parent_message_id: message.parent_message_id,
      metadata: message.metadata,
    };
  }, [currentChatId, session?.user?.id]);

  const loadMessages = useCallback(async (chatId: string, forceRefresh = false) => {
    if (!chatId || loadingRef.current) return;
    
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    try {
      loadingRef.current = true;
      setIsLoading(true);
      setError(null);
      setCurrentChatId(chatId);
      
      // Try to load from localStorage cache first
      let shouldFetchFromServer = forceRefresh;
      let cachedMessages: any[] = [];
      
      if (!forceRefresh) {
        const cachedData = getCachedActiveMessages();
        if (cachedData && cachedData.chatId === chatId && cachedData.messages.length > 0) {
          // Validate that cached messages belong to current user
          const currentUserId = session?.user?.id;
          const validMessages = cachedData.messages.filter(msg => 
            !currentUserId || msg.user_id === currentUserId || msg.user_id === 'unknown'
          );
          
          if (validMessages.length > 0) {
            setMessages(validMessages);
            cachedMessages = validMessages;
            setIsLoading(false); // Stop loading since we have cached data
            loadingRef.current = false;
            console.log('✅ Loaded messages from cache:', validMessages.length);
            
            // Check if we need to resync (optional background fetch)
            // Only resync if cache is older than 2 minutes for better performance
            const cacheAge = Date.now() - (cachedData.timestamp || 0);
            const shouldResync = cacheAge > 2 * 60 * 1000; // 2 minutes
            
            if (shouldResync) {
              console.log('🔄 Cache is older than 2 minutes, background sync initiated');
              shouldFetchFromServer = true;
            } else {
              console.log('✨ Using fresh cache, skipping server fetch');
              return; // Exit early, no need to fetch from server
            }
          } else {
            console.log('Cached messages belong to different user, clearing cache');
            clearAllCachedActiveMessages();
            shouldFetchFromServer = true;
          }
        } else {
          console.log('No valid cache found, fetching from server');
          shouldFetchFromServer = true;
        }
      }
      
      // Fetch from server only when necessary
      if (shouldFetchFromServer) {
        const isBackgroundSync = cachedMessages.length > 0;
        if (!isBackgroundSync) {
          setIsLoading(true);
          loadingRef.current = true;
        }
        
        console.log(isBackgroundSync ? '🔄 [Background Sync]' : '🔍 [Initial Fetch]', 'Fetching messages for chat:', chatId);
        const response = await apiClient.get(`/api/chat/${chatId}`, {
          signal: abortController.signal
        });
        console.log('🔍 [useActiveChat] API Response received:', {
          responseType: typeof response,
          responseKeys: response ? Object.keys(response) : 'null',
          hasData: 'data' in (response || {}),
          hasMessages: 'messages' in (response || {}),
          directResponseId: response?.id,
          directResponseTitle: response?.title,
          messagesLength: response?.messages?.length || 'no messages'
        });
        
        // Handle direct response format (server returns chat object directly)
        const chatData = response?.data || response; // Support both wrapped and direct formats
        
        if (chatData) {
          const transformedMessages = chatData.messages?.map(transformMessage) || [];
          console.log('🔄 [useActiveChat] Transformed messages:', {
            originalCount: chatData.messages?.length || 0,
            transformedCount: transformedMessages.length,
            firstMessage: transformedMessages[0],
            lastMessage: transformedMessages[transformedMessages.length - 1],
            isBackgroundSync
          });
          
          // Only update messages if request wasn't aborted
          if (!abortController.signal.aborted) {
            // For background sync, only update if server has newer/different messages
            if (isBackgroundSync) {
              const hasNewMessages = transformedMessages.length !== cachedMessages.length ||
                transformedMessages.some((msg, index) => 
                  !cachedMessages[index] || msg.id !== cachedMessages[index].id
                );
              
              if (hasNewMessages) {
                setMessages(transformedMessages);
                console.log('📝 [Background Sync] Updated with newer messages:', transformedMessages.length);
              } else {
                console.log('✅ [Background Sync] No new messages, keeping cache');
              }
            } else {
              setMessages(transformedMessages);
              console.log('📝 [Initial Fetch] Setting messages state:', transformedMessages.length);
            }
          }
          
          // Update chat info only if request wasn't aborted
          if (!abortController.signal.aborted) {
            const chatInfo = {
              id: chatData.id || chatId,
              title: chatData.title || 'Untitled Chat',
              created_at: chatData.created_at,
            last_message_at: chatData.last_message_at,
            total_messages: chatData.total_messages
          };
          setCurrentChat(chatInfo);
          
          // Update recent chats cache with latest title and info
          updateCachedChat({
            id: chatData.id || chatId,
            title: chatData.title || 'Untitled Chat',
            last_message_at: chatData.last_message_at || chatData.updated_at || new Date().toISOString(),
            created_at: chatData.created_at || new Date().toISOString(),
            updated_at: chatData.updated_at || new Date().toISOString()
          });
          
          console.log('💬 [useActiveChat] Setting active chat:', {
            id: chatData.id,
            title: chatData.title || 'Untitled Chat'
          });
        }
        
          // Update localStorage cache with latest messages (keep last 40 for quick access)
          if (transformedMessages.length > 0) {
            const latestForCache = transformedMessages.slice(-40);
            switchToActiveChat(chatId, latestForCache);
          }
          
          console.log('✅ [DEBUG] Successfully loaded chat:', { chatId, messagesCount: transformedMessages.length, title: chatData.title || 'Untitled Chat' });
        } else {
          console.log('🔍 [DEBUG] No data in response or invalid response format:', response);
          if (!abortController.signal.aborted) {
            setMessages([]);
            setCurrentChat({ id: chatId, title: 'Untitled Chat' });
            console.log('🔍 [DEBUG] Set empty state for chat:', chatId);
          }
        }
      } // Close the shouldFetchFromServer if block
      
    } catch (err) {
      // Don't handle aborted requests as errors
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        console.log('🔍 [DEBUG] Request aborted for chat:', chatId);
        return;
      }
      
      let errorMessage = err.message || 'Failed to load messages';
      
      if (err.code === 'NOT_FOUND') {
        // Use console.warn for expected 404 errors to avoid triggering error tracking
        console.warn('Chat not found:', err);
        errorMessage = 'Chat not found';
        setMessages([]);
        setCurrentChat(null);
        // Clear stale cache for this chat
        clearAllCachedActiveMessages();
      } else if (err.code === 'INTERNAL_SERVER_ERROR') {
        console.error('Server error loading messages:', err);
        errorMessage = 'Server error - please try again later';
      } else if (err.code === 'UNAUTHORIZED' || err.code === 'FORBIDDEN') {
        console.error('Authentication error loading messages:', err);
        errorMessage = 'Authentication required - please log in again';
      } else if (err.name === 'NetworkError' || err.code === 'NETWORK_ERROR') {
        console.error('Network error loading messages:', err);
        errorMessage = 'Network error - please check your connection';
      } else {
        // Log unexpected errors
        console.error('Error loading messages:', err);
      }
      
      // Only set error if request wasn't aborted
      if (!abortController.signal.aborted) {
        setError(errorMessage);
      }
    } finally {
      // Only update loading state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        loadingRef.current = false;
        setIsLoading(false);
      }
      
      // Clear the abort controller reference if it's the current one
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [transformMessage]);

  const addMessage = useCallback((newMessage: CachedMessage) => {
    setMessages(prevMessages => {
      // Avoid duplicate entries that cause React key collisions
      if (prevMessages.some(msg => msg.id === newMessage.id)) {
        return prevMessages;
      }

      // Sanitize content to be a string
      const safeContent = normalizeOutput((newMessage as any).content);
      const safeMessage: CachedMessage = {
        ...newMessage,
        content: typeof safeContent === 'string' ? safeContent : '',
      };

      const updatedMessages = [...prevMessages, safeMessage];
      
      // Update localStorage cache
      if (currentChatId) {
        const cacheMessages = updatedMessages.slice(-10);
        switchToActiveChat(currentChatId, cacheMessages);
      }
      
      return updatedMessages;
    });
  }, [currentChatId, normalizeOutput]);

  const sendMessage = useCallback(async (content: string, chatId: string): Promise<string | null> => {
    if (!content.trim() || !session) return null;
    
    // Helper to generate stable unique IDs to avoid React key collisions
    const makeId = (prefix: string) => {
      const rand = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
        ? globalThis.crypto.randomUUID()
        : Math.random().toString(36).slice(2);
      return `${prefix}-${Date.now()}-${rand}`;
    };
    
    const userMessage: CachedMessage = {
      id: makeId('user'),
      content: content.trim(),
      role: 'user',
      timestamp: new Date().toISOString(),
      chat_id: chatId,
      user_id: session.user?.id || 'unknown',
    };
    
    // Optimistic update
    addMessage(userMessage);
    
    try {
      const response = await apiClient.post(`/api/chat`, {
        message: content.trim(),
        sessionId: chatId
      });
      // Support both wrapped responses ({ success, data }) and direct responses ({ output, sessionId, ... })
      const parsed = (response && (response as any).success && (response as any).data) ? (response as any).data : response;
      const outputStr = normalizeOutput((parsed as any)?.output ?? parsed);
      const nextChatId = (parsed as any)?.sessionId || chatId;
      const modelUsed = (parsed as any)?.model;

      if (typeof outputStr === 'string' && outputStr.length > 0) {
        const assistantMessage: CachedMessage = {
          id: makeId('assistant'),
          content: outputStr,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          chat_id: nextChatId,
          user_id: session.user?.id || 'unknown',
          model_used: modelUsed,
        };

        addMessage(assistantMessage);

        // Update current chat ID if it changed (e.g., new chat created from fork or first send)
        if (nextChatId && nextChatId !== chatId) {
          setCurrentChatId(nextChatId);
        }

        // Update recent chats cache optimistically for instant sidebar update
        try {
          const nowIso = new Date().toISOString();
          const deriveTitle = (text: string | undefined) => {
            const src = (text || '').trim();
            if (!src) return 'Untitled Chat';
            return src.replace(/\s+/g, ' ').slice(0, 48);
          };
          const isPlaceholder = (t?: string) => !t || /^(new chat|untitled chat)$/i.test(t.trim());
          updateCachedChat({
            id: nextChatId,
            title: isPlaceholder(currentChat?.title) ? deriveTitle(userMessage.content) : (currentChat?.title || 'Untitled Chat'),
            last_message_at: nowIso,
            created_at: currentChat?.created_at || nowIso,
            updated_at: nowIso,
            last_message: outputStr,
            unread_count: 0,
          } as any);
          // Move active messages cache under the real chatId when starting from a placeholder
          try {
            const cached = getCachedActiveMessages();
            const cachedMessages = cached?.messages || [];
            // Add the assistant message to cached array and rebind to nextChatId
            const forCache = [...cachedMessages, assistantMessage].slice(-40);
            switchToActiveChat(nextChatId, forCache);
          } catch {}
          // Trigger sidebar refresh if registered
          try {
            const { refreshSidebar } = await import('./useRecentChats');
            refreshSidebar();
          } catch {}
        } catch {}
      }

      // Return the effective chat ID so callers can navigate without racing state
      return nextChatId || null;
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
      return null;
    }
  }, [session, addMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentChatId(null);
    setCurrentChat(null);
    setError(null);
    clearAllCachedActiveMessages();
  }, []);

  const switchChat = useCallback(async (chatId: string) => {
    if (chatId !== currentChatId) {
      console.log('🔍 [DEBUG] Switching to chat:', { from: currentChatId, to: chatId });
      
      // Clear any previous errors
      setError(null);
      
      // Update current chat ID immediately
      setCurrentChatId(chatId);
      
      // Try to get chat title from recent chats cache first
      const recentChats = getCachedRecentChats();
      const cachedChat = recentChats?.find(chat => chat.id === chatId);
      const chatTitle = cachedChat?.title || 'Loading...';
      
      // Try to load cached messages first for instant display
      const cachedData = getCachedActiveMessages();
      if (cachedData && cachedData.chatId === chatId && cachedData.messages.length > 0) {
        // Validate cached messages belong to current user
        const currentUserId = session?.user?.id;
        const validMessages = cachedData.messages.filter(msg => 
          !currentUserId || msg.user_id === currentUserId || msg.user_id === 'unknown'
        );
        
        if (validMessages.length > 0) {
          console.log('🔍 [DEBUG] Loading cached messages for instant display:', validMessages.length);
          setMessages(validMessages);
          setCurrentChat({ id: chatId, title: chatTitle }); // Use cached title if available
          // Set loading state after showing cached content to prevent flicker
          setIsLoading(true);
        } else {
          console.log('🔍 [DEBUG] Cached messages belong to different user, clearing cache');
          clearAllCachedActiveMessages();
          setMessages([]);
          setCurrentChat({ id: chatId, title: chatTitle });
          setIsLoading(true);
        }
      } else {
        // No cache available - show loading state immediately
        setIsLoading(true);
        setMessages([]);
        setCurrentChat({ id: chatId, title: chatTitle });
      }
      
      // Load fresh messages from server
      await loadMessages(chatId);
    }
  }, [currentChatId, loadMessages, session?.user?.id]);

  const refreshMessages = useCallback(() => {
    if (currentChatId) {
      loadMessages(currentChatId, true);
    }
  }, [currentChatId, loadMessages]);

  return {
    messages,
    isLoading,
    error,
    currentChatId,
    currentChat,
    loadMessages,
    addMessage,
    clearMessages,
    sendMessage,
    switchChat,
    refreshMessages,
  };
}
