import { useState, useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { updateCachedChat } from '../lib/localStorageUtils';
import { refreshSidebar } from './useRecentChats';

interface StreamingMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  model?: string;
  type?: 'text' | 'image' | 'error';
  isStreaming?: boolean;
}

interface StreamingState {
  isStreaming: boolean;
  currentModel: string | null;
  error: string | null;
}

interface StreamEventData {
  primaryModel?: string;
  model?: string;
  fullResponse?: string;
  // Support various backend token shapes
  content?: string;
  delta?: string;
  text?: string;
  token?: string;
  url?: string;
  message?: string;
}

export const useStreamingChat = () => {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    currentModel: null,
    error: null
  });
  const [sessionIdFromStream, setSessionIdFromStream] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  // Prefer same-origin proxy in development to avoid CORS issues; allow opt-out
  const DEV = (import.meta as any).env?.DEV;
  const FORCE_ABSOLUTE = (import.meta as any).env?.VITE_FORCE_ABSOLUTE_API_BASE_URL;
  const API_BASE_URL: string = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000';
  const useProxy = DEV && !FORCE_ABSOLUTE;
  const primaryStreamingUrl = useProxy ? '/api/streaming/stream' : `${API_BASE_URL}/api/streaming/stream`;
  const altStreamingUrl = useProxy ? `${API_BASE_URL}/api/streaming/stream` : '/api/streaming/stream';
  
  const { session } = useAuthStore();
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentMessageRef = useRef<string>('');
  
  // Helper to generate stable unique IDs
  const makeId = (prefix: string) => {
    const rand = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    return `${prefix}-${Date.now()}-${rand}`;
  };
  
  const sendMessage = useCallback(async (message: string, sessionId?: string) => {
    // Add user message
    const userMessage: StreamingMessage = {
      id: makeId('user'),
      content: message,
      role: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Create assistant message placeholder
    const assistantMessageId = makeId('assistant');
    const assistantMessage: StreamingMessage = {
      id: assistantMessageId,
      content: '',
      role: 'assistant',
      timestamp: new Date(),
      isStreaming: true
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    setStreamingState({ isStreaming: true, currentModel: null, error: null });
    currentMessageRef.current = '';
    
    try {
      // Guard: require valid auth token before starting streaming
      const accessToken = session?.access_token;
      if (!accessToken || typeof accessToken !== 'string') {
        const authErrorMsg = 'You are not signed in or your session expired. Please sign in and try again.';
        setStreamingState({ isStreaming: false, currentModel: null, error: authErrorMsg });
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: authErrorMsg, type: 'error', isStreaming: false }
            : msg
        ));
        return;
      }
      
      // Start streaming (with simple fallback to alternate URL if first attempt fails)
    let response: Response | undefined;
    let lastError: unknown;
    const attemptFetch = async (url: string) => {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ message, sessionId }),
        cache: 'no-cache',
        mode: 'cors'
      });
    };
    try {
      response = await attemptFetch(primaryStreamingUrl);
    } catch (err) {
      lastError = err;
      try {
        response = await attemptFetch(altStreamingUrl);
      } catch (err2) {
        lastError = err2;
      }
    }
    if (!response) {
      throw lastError instanceof Error ? lastError : new Error('Failed to start streaming');
    }
      
      if (!response.ok) {
        // Try to surface server error details
        let serverErrorMsg = `Failed to start streaming (${response.status})`;
        try {
          const text = await response.text();
          if (text) {
            try {
              const json = JSON.parse(text);
              const errVal = (json && (json.error || json.message || json.data?.message));
              if (typeof errVal === 'string') {
                serverErrorMsg = errVal;
              } else if (errVal) {
                serverErrorMsg = JSON.stringify(errVal);
              } else {
                serverErrorMsg = text;
              }
            } catch {
              serverErrorMsg = text;
            }
          }
        } catch {}
        
        setStreamingState({ isStreaming: false, currentModel: null, error: serverErrorMsg });
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: serverErrorMsg, type: 'error', isStreaming: false }
            : msg
        ));
        return;
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setStreamingState(prev => ({ ...prev, isStreaming: false }));
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, isStreaming: false }
                  : msg
              ));

              // Persist recent chat entry and refresh sidebar (after generation)
              try {
                const effectiveChatId = sessionId || sessionIdRef.current || sessionIdFromStream;
                const finalContent = currentMessageRef.current || '';
                if (effectiveChatId && finalContent.trim()) {
                  const nowIso = new Date().toISOString();
                  const deriveTitle = (text: string) => {
                    const src = (text || '').trim();
                    if (!src) return 'Untitled Chat';
                    return src.replace(/\s+/g, ' ').slice(0, 48);
                  };
                  updateCachedChat({
                    id: effectiveChatId,
                    title: deriveTitle(message),
                    last_message_at: nowIso,
                    created_at: nowIso,
                    updated_at: nowIso,
                    last_message: finalContent,
                    unread_count: 0,
                  } as any);
                  // Trigger sidebar refresh
                  try {
                    refreshSidebar();
                  } catch {}
                }
              } catch {}
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              handleStreamEvent(parsed, assistantMessageId);
            } catch (e) {
              console.warn('Failed to parse stream data:', data);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Streaming error:', error);
      const errMsg = (error as Error)?.message || 'An error occurred';
      setStreamingState({ isStreaming: false, currentModel: null, error: errMsg });
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: 'Sorry, I encountered an error. Please try again.', type: 'error', isStreaming: false }
          : msg
      ));
    }
  }, [session]);

  const handleStreamEvent = useCallback((event: { type: string; data?: unknown; [key: string]: unknown }, messageId: string) => {
    const eventData = event.data as StreamEventData;
    
    switch (event.type) {
      case 'session': {
        const sid = (eventData as any)?.sessionId;
        if (typeof sid === 'string' && sid.length > 0) {
          setSessionIdFromStream(sid);
          sessionIdRef.current = sid;
        }
        break;
      }
      case 'routing': {
        setStreamingState(prev => ({ 
          ...prev, 
          currentModel: eventData?.primaryModel || null 
        }));
        break;
      }
        
      case 'model_selected': {
        setStreamingState(prev => ({ 
          ...prev, 
          currentModel: eventData?.model || null 
        }));
        break;
      }
        
      case 'token': {
        const fullResponse = eventData?.fullResponse;
        // Prefer fullResponse if provided; otherwise accumulate deltas/content
        let nextContent: string | null = null;
        if (typeof fullResponse === 'string') {
          nextContent = fullResponse;
          currentMessageRef.current = fullResponse;
        } else {
          const piece = (eventData?.delta
            ?? eventData?.content
            ?? eventData?.text
            ?? eventData?.token);
          if (typeof piece === 'string') {
            currentMessageRef.current = (currentMessageRef.current || '') + piece;
            nextContent = currentMessageRef.current;
          }
        }
        if (typeof nextContent === 'string') {
          setMessages(prev => prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: nextContent }
              : msg
          ));
        }
        break;
      }
        
      case 'image': {
        const imageUrl = eventData?.url;
        if (typeof imageUrl === 'string') {
          setMessages(prev => prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: imageUrl, type: 'image', isStreaming: false }
              : msg
          ));
          setStreamingState(prev => ({ ...prev, isStreaming: false }));
        }
        break;
      }
        
      case 'error': {
        const errorMessage = eventData?.message || 'An error occurred';
        setStreamingState(prev => ({ 
          ...prev, 
          error: typeof errorMessage === 'string' ? errorMessage : 'An error occurred',
          isStreaming: false 
        }));
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: typeof errorMessage === 'string' ? errorMessage : 'An error occurred', type: 'error', isStreaming: false }
            : msg
        ));
        break;
      }
    }
  }, []);
  
  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingState({ isStreaming: false, currentModel: null, error: null });
  }, []);
  
  return {
    messages,
    streamingState,
    sendMessage,
    sessionId: sessionIdFromStream,
    clearMessages
  };
};