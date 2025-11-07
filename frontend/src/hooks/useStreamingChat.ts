import { useState, useCallback, useRef } from 'react';
import StreamMarkdownCleaner from '@/utils/StreamMarkdownCleaner';
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
    // Initialize stream cleaner per stream
    const cleanerRef = { current: new StreamMarkdownCleaner() };
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
      
      // Start streaming with adaptive proxy-bypass fallback
      const attemptFetch = async (url: string, controller?: AbortController) => {
        return await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ message, sessionId }),
          cache: 'no-cache',
          mode: 'cors',
          signal: controller?.signal
        });
      };

      let usedUrl = primaryStreamingUrl;
      let controller = new AbortController();
      let response = await attemptFetch(usedUrl, controller);
      // If initial attempt fails, try alternate immediately
      if (!response.ok) {
        controller.abort();
        controller = new AbortController();
        usedUrl = altStreamingUrl;
        response = await attemptFetch(usedUrl, controller);
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
      let receivedAnyEvent = false;

      // If using dev proxy and no events arrive quickly, bypass proxy
      let fallbackTimer: number | undefined;
      const shouldSetBypassTimer = useProxy && usedUrl === primaryStreamingUrl;
      if (shouldSetBypassTimer) {
        // If nothing arrives within ~1.2s, retry against absolute URL
        fallbackTimer = setTimeout(async () => {
          if (!receivedAnyEvent) {
            try {
              controller.abort();
            } catch {}
          }
        }, 1200) as unknown as number;
      }
      
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            receivedAnyEvent = true;
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
              handleStreamEvent(parsed, assistantMessageId, cleanerRef.current);
            } catch (e) {
              console.warn('Failed to parse stream data:', data);
            }
          }
        }
      }
      // If we aborted due to no events, try alt URL once
      if (!receivedAnyEvent && shouldSetBypassTimer) {
        try { clearTimeout(fallbackTimer!); } catch {}
        controller = new AbortController();
        usedUrl = altStreamingUrl;
        const retryResp = await attemptFetch(usedUrl, controller);
        if (!retryResp.ok) {
          throw new Error(`Failed to start streaming (${retryResp.status})`);
        }
        const retryReader = retryResp.body?.getReader();
        while (true) {
          const { done, value } = await retryReader!.read();
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
                    try { refreshSidebar(); } catch {}
                  }
                } catch {}
                return;
              }
              try {
              const parsed = JSON.parse(data);
              handleStreamEvent(parsed, assistantMessageId, cleanerRef.current);
              } catch (e) {
                console.warn('Failed to parse stream data:', data);
              }
            }
          }
        }
      }
      try { if (fallbackTimer) clearTimeout(fallbackTimer); } catch {}
      
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

  const handleStreamEvent = useCallback((event: { type: string; data?: unknown; [key: string]: unknown }, messageId: string, cleaner?: StreamMarkdownCleaner) => {
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
        const ts = (eventData as any)?.ts as number | undefined;
        if (typeof ts === 'number') {
          try {
            const iso = new Date(ts).toISOString();
            // Lightweight timestamp logging to validate throughput
            console.debug('[stream] token at', iso);
          } catch {}
        }
        // Prefer fullResponse if provided; otherwise accumulate deltas/content
        let nextContent: string | null = null;
        if (typeof fullResponse === 'string') {
          const processed = cleaner ? cleaner.processChunk(fullResponse) : fullResponse;
          nextContent = processed;
          currentMessageRef.current = processed;
        } else {
          const piece = (eventData?.delta
            ?? eventData?.content
            ?? eventData?.text
            ?? eventData?.token);
          if (typeof piece === 'string') {
            const processedPiece = cleaner ? cleaner.processChunk(piece) : piece;
            currentMessageRef.current = (currentMessageRef.current || '') + processedPiece;
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