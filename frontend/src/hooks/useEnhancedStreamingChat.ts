/**
 * Enhanced Streaming Chat Hook
 * Features: Performance optimization, intelligent caching, retry logic, and advanced state management
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import StreamMarkdownCleaner from '@/utils/StreamMarkdownCleaner';
import { useAuthStore } from '@/stores/authStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
  type?: 'text' | 'image' | 'error';
  isStreaming?: boolean;
  metadata?: {
    tokens?: number;
    processingTime?: number;
    confidence?: number;
    reasoning?: string;
  };
}

interface StreamingState {
  isStreaming: boolean;
  currentModel: string | null;
  error: string | null;
  stage: 'idle' | 'routing' | 'processing' | 'generating' | 'complete';
  progress: number;
  estimatedTimeRemaining?: number;
}

interface StreamingMetrics {
  totalMessages: number;
  averageResponseTime: number;
  successRate: number;
  totalTokens: number;
  preferredModels: Record<string, number>;
}

interface UseEnhancedStreamingChatOptions {
  maxRetries?: number;
  retryDelay?: number;
  enableCaching?: boolean;
  enableMetrics?: boolean;
  autoSave?: boolean;
  maxMessages?: number;
  // Optional short time-based throttle for token UI updates (ms)
  streamThrottleMs?: number;
}

interface CacheEntry {
  response: string;
  model: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

const DEFAULT_OPTIONS: UseEnhancedStreamingChatOptions = {
  maxRetries: 3,
  retryDelay: 1000,
  enableCaching: true,
  enableMetrics: true,
  autoSave: true,
  maxMessages: 100,
  streamThrottleMs: 0
};

export const useEnhancedStreamingChat = (options: UseEnhancedStreamingChatOptions = {}) => {
  const { user, session } = useAuthStore();
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  // Helper to generate stable unique IDs to avoid key collisions
  const makeId = (prefix: string) => {
    const rand = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    return `${prefix}-${Date.now()}-${rand}`;
  };
  
  // Core state
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    currentModel: null,
    error: null,
    stage: 'idle',
    progress: 0
  });
  
  // Performance and caching state
  const [metrics, setMetrics] = useState<StreamingMetrics>({
    totalMessages: 0,
    averageResponseTime: 0,
    successRate: 100,
    totalTokens: 0,
    preferredModels: {}
  });
  
  // Refs for performance
  const abortControllerRef = useRef<AbortController | null>(null);
  const responseTimeRef = useRef<number>(0);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const retryCountRef = useRef<number>(0);
  const metricsRef = useRef<StreamingMetrics>(metrics);
  const isStreamingRef = useRef<boolean>(false);
  const lastTokenFlushRef = useRef<number>(0);
  const rafYield = () => new Promise<void>(resolve => {
    try {
      requestAnimationFrame(() => resolve());
    } catch {
      setTimeout(() => resolve(), 0);
    }
  });
  
  // Update metrics ref when state changes
  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);
  
  // Load cached data on mount
  useEffect(() => {
    if (config.enableCaching && user) {
      loadCachedData();
    }
  }, [user, config.enableCaching]);
  
  // Auto-save messages with cleanup
  useEffect(() => {
    if (config.autoSave && user && messages.length > 0) {
      saveMessagesToStorage();
      
      // Limit message array size to prevent memory bloat
      if (messages.length > config.maxMessages!) {
        setMessages(prev => prev.slice(-config.maxMessages!));
      }
    }
  }, [messages, user, config.autoSave, config.maxMessages]);
  
  // Cache management
  const generateCacheKey = useCallback((message: string): string => {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `msg_${Math.abs(hash)}`;
  }, []);
  
  const getCachedResponse = useCallback((message: string): CacheEntry | null => {
    if (!config.enableCaching) return null;
    
    const cacheKey = generateCacheKey(message);
    const cached = cacheRef.current.get(cacheKey);
    
    if (cached) {
      // Check if cache is still valid (24 hours)
      const isValid = Date.now() - cached.timestamp < 24 * 60 * 60 * 1000;
      if (isValid) {
        return cached;
      } else {
        cacheRef.current.delete(cacheKey);
      }
    }
    
    return null;
  }, [config.enableCaching, generateCacheKey]);
  
  const setCachedResponse = useCallback((message: string, response: string, model: string, metadata: Record<string, unknown>) => {
    if (!config.enableCaching) return;
    
    const cacheKey = generateCacheKey(message);
    cacheRef.current.set(cacheKey, {
      response,
      model,
      timestamp: Date.now(),
      metadata
    });
    
    // Limit cache size
    if (cacheRef.current.size > 50) {
      const oldestKey = cacheRef.current.keys().next().value;
      cacheRef.current.delete(oldestKey);
    }
  }, [config.enableCaching, generateCacheKey]);
  
  // Storage functions
  const saveMessagesToStorage = useCallback(() => {
    try {
      const storageKey = `chat_messages_${user?.id || 'anonymous'}`;
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-config.maxMessages!)));
    } catch (error) {
      console.warn('Failed to save messages to storage:', error);
    }
  }, [messages, user, config.maxMessages]);
  
  const loadCachedData = useCallback(() => {
    try {
      const storageKey = `chat_messages_${user?.id || 'anonymous'}`;
      const cached = localStorage.getItem(storageKey);
      
      if (cached) {
        const parsedMessages = JSON.parse(cached);
        setMessages(parsedMessages.map((msg: {
          id: string;
          role: string;
          content: string;
          timestamp: string;
          [key: string]: unknown;
        }) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      }
      
      // Load metrics
      const metricsKey = `chat_metrics_${user?.id || 'anonymous'}`;
      const cachedMetrics = localStorage.getItem(metricsKey);
      
      if (cachedMetrics) {
        setMetrics(JSON.parse(cachedMetrics));
      }
    } catch (error) {
      console.warn('Failed to load cached data:', error);
    }
  }, [user]);
  
  // Metrics calculation
  const updateMetrics = useCallback((responseTime: number, success: boolean, model: string, tokens?: number) => {
    if (!config.enableMetrics) return;
    
    setMetrics(prev => {
      const newTotalMessages = prev.totalMessages + 1;
      const newAverageResponseTime = ((prev.averageResponseTime * prev.totalMessages) + responseTime) / newTotalMessages;
      const newSuccessRate = ((prev.successRate * prev.totalMessages) + (success ? 100 : 0)) / newTotalMessages;
      const newTotalTokens = prev.totalTokens + (tokens || 0);
      
      const newPreferredModels = { ...prev.preferredModels };
      newPreferredModels[model] = (newPreferredModels[model] || 0) + 1;
      
      const newMetrics = {
        totalMessages: newTotalMessages,
        averageResponseTime: newAverageResponseTime,
        successRate: newSuccessRate,
        totalTokens: newTotalTokens,
        preferredModels: newPreferredModels
      };
      
      // Save to storage
      try {
        const metricsKey = `chat_metrics_${user?.id || 'anonymous'}`;
        localStorage.setItem(metricsKey, JSON.stringify(newMetrics));
      } catch (error) {
        console.warn('Failed to save metrics:', error);
      }
      
      return newMetrics;
    });
  }, [config.enableMetrics, user]);
  
  // Progress estimation
  const estimateProgress = useCallback((stage: StreamingState['stage'], elapsedTime: number): number => {
    const stageProgress = {
      idle: 0,
      routing: 10,
      processing: 30,
      generating: 60,
      complete: 100
    };
    
    let baseProgress = stageProgress[stage];
    
    // Add time-based progress for generating stage
    if (stage === 'generating') {
      const estimatedGenerationTime = 3000; // 3 seconds
      const timeProgress = Math.min((elapsedTime / estimatedGenerationTime) * 40, 40);
      baseProgress += timeProgress;
    }
    
    return Math.min(baseProgress, 100);
  }, []);
  
  // Enhanced error handling with retry logic
  const handleStreamingError = useCallback(async (error: Error & { name?: string }, originalMessage: string): Promise<boolean> => {
    console.error('Streaming error:', error);
    
    if (retryCountRef.current < config.maxRetries!) {
      retryCountRef.current++;
      
      setStreamingState(prev => ({
        ...prev,
        error: `Retrying... (${retryCountRef.current}/${config.maxRetries})`,
        stage: 'processing'
      }));
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, config.retryDelay! * retryCountRef.current));
      
      // Retry the request
      return sendMessage(originalMessage, true);
    } else {
      // Max retries reached
      isStreamingRef.current = false;
      setStreamingState(prev => ({
        ...prev,
        error: 'Failed to get response after multiple attempts. Please try again.',
        isStreaming: false,
        stage: 'idle',
        progress: 0
      }));
      
      updateMetrics(Date.now() - responseTimeRef.current, false, 'unknown');
      return false;
    }
  }, [config.maxRetries, config.retryDelay, updateMetrics]);
  
  // Enhanced send message function with optimized state updates
  const sendMessage = useCallback(async (message: string, isRetry: boolean = false): Promise<boolean> => {
    if (!user) {
      setStreamingState(prev => ({ ...prev, error: 'Please log in to continue' }));
      return false;
    }
    
    if (!message.trim()) {
      return false;
    }
    
    if (isStreamingRef.current && !isRetry) {
      return false;
    }
    
    if (!isRetry) {
      retryCountRef.current = 0;
    }
    
    // Check cache first
    const cachedResponse = getCachedResponse(message);
    if (cachedResponse && !isRetry) {
      const userMessage: Message = {
        id: makeId('user'),
        role: 'user',
        content: message,
        timestamp: new Date()
      };
      
      const assistantMessage: Message = {
        id: makeId('assistant'),
        role: 'assistant',
        content: cachedResponse.response,
        timestamp: new Date(),
        model: cachedResponse.model,
        metadata: cachedResponse.metadata
      };
      
      setMessages(prev => [...prev, userMessage, assistantMessage]);
      updateMetrics(100, true, cachedResponse.model, typeof cachedResponse.metadata?.tokens === 'number' ? cachedResponse.metadata.tokens : undefined);
      
      return true;
    }
    
    // Start timing
    responseTimeRef.current = Date.now();
    
    // Add user message
    if (!isRetry) {
      const userMessage: Message = {
        id: makeId('user'),
        role: 'user',
        content: message,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
    }
    
    // Initialize streaming state
    isStreamingRef.current = true;
    setStreamingState({
      isStreaming: true,
      currentModel: null,
      error: null,
      stage: 'routing',
      progress: 10
    });
    
    // Create abort controller
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch('/api/streaming/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ message }),
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }
      
      const decoder = new TextDecoder();
      const assistantMessage: Message = {
        id: makeId('assistant'),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      };
      
      // Add initial assistant message
      setMessages(prev => [...prev, assistantMessage]);
      
      let buffer = '';
      let currentModel = '';
      let metadata: Record<string, unknown> = {};
      
      // Initialize stream markdown cleaner (per stream)
      const streamCleaner = new StreamMarkdownCleaner();

      // Optimized progress tracking with reduced update frequency
      const startTime = Date.now();
      let progressInterval: NodeJS.Timeout | null = null;
      let lastProgressUpdate = 0;
      
      progressInterval = setInterval(() => {
        if (!isStreamingRef.current) {
          if (progressInterval) clearInterval(progressInterval);
          return;
        }
        
        const elapsed = Date.now() - startTime;
        const progress = estimateProgress(streamingState.stage, elapsed);
        
        // Only update if progress changed significantly (reduce re-renders)
        if (Math.abs(progress - lastProgressUpdate) >= 5) {
          lastProgressUpdate = progress;
          setStreamingState(prev => ({
            ...prev,
            progress,
            estimatedTimeRemaining: progress > 0 ? Math.max(0, ((elapsed / progress) * (100 - progress))) : undefined
          }));
        }
      }, 250); // Reduced frequency from 100ms to 250ms
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                  if (progressInterval) clearInterval(progressInterval);
                  
                  isStreamingRef.current = false;
                  
                  // Batch final state updates to reduce re-renders
                  setStreamingState({
                    isStreaming: false,
                    currentModel,
                    error: null,
                    stage: 'complete',
                    progress: 100
                  });
                  
                  // Final message update with any remaining content
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { ...msg, content: assistantMessage.content, isStreaming: false, model: currentModel, metadata }
                      : msg
                  ));
                  
                  // Cache the response
                  setCachedResponse(message, assistantMessage.content, currentModel, metadata);
                  
                  // Update metrics
                  const responseTime = Date.now() - responseTimeRef.current;
                  updateMetrics(responseTime, true, currentModel, typeof metadata.tokens === 'number' ? metadata.tokens : undefined);
                  
                  return true;
                }
              
              try {
                const eventData = JSON.parse(data);
                
                switch (eventData.type) {
                  case 'routing':
                    setStreamingState(prev => ({ ...prev, stage: 'processing', progress: 30 }));
                    break;
                    
                  case 'model_selected':
                    currentModel = eventData.model;
                    setStreamingState(prev => ({ 
                      ...prev, 
                      currentModel,
                      stage: 'generating',
                      progress: 50
                    }));
                    break;
                    
                  case 'token': {
                    // Support multiple event shapes: {content}, {data:{content}}, {token}, and {fullResponse}
                    const content: string = (eventData.content ?? eventData.data?.content ?? eventData.token ?? '') as string;
                    const fullResponse: string | undefined = (eventData.fullResponse ?? eventData.data?.fullResponse) as string | undefined;

                    if (fullResponse && typeof fullResponse === 'string') {
                      assistantMessage.content = streamCleaner.processChunk(fullResponse);
                    } else if (typeof content === 'string' && content.length > 0) {
                      assistantMessage.content += streamCleaner.processChunk(content);
                    }

                    // Debug: log token arrival cadence (dev-only)
                    if (import.meta.env?.MODE !== 'production') {
                      try {
                        // eslint-disable-next-line no-console
                        console.debug('[EnhancedStream] token', { len: assistantMessage.content.length, contentSample: content?.slice?.(0, 20) });
                      } catch {}
                    }

                    // Immediate UI update per token, with optional short time-based throttle
                    if (!config.streamThrottleMs || config.streamThrottleMs <= 0) {
                      setMessages(prev => prev.map(msg =>
                        msg.id === assistantMessage.id
                          ? { ...msg, content: assistantMessage.content }
                          : msg
                      ));
                      // Yield to allow React to paint between tokens
                      await rafYield();
                    } else {
                      const now = Date.now();
                      if (now - lastTokenFlushRef.current >= config.streamThrottleMs) {
                        lastTokenFlushRef.current = now;
                        setMessages(prev => prev.map(msg =>
                          msg.id === assistantMessage.id
                            ? { ...msg, content: assistantMessage.content }
                            : msg
                        ));
                        await rafYield();
                      }
                    }
                    break;
                  }
                    
                  case 'image':
                    assistantMessage.content = eventData.url;
                    assistantMessage.type = 'image';
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMessage.id 
                        ? { ...msg, content: assistantMessage.content, type: 'image' }
                        : msg
                    ));
                    break;
                    
                  case 'metadata':
                    metadata = { ...metadata, ...eventData.data };
                    break;
                    
                  case 'error':
                    throw new Error(eventData.message || 'Streaming error occurred');
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      } finally {
        if (progressInterval) clearInterval(progressInterval);
        try {
          reader.releaseLock();
        } catch (error) {
          console.warn('Failed to release reader lock:', error);
        }
      }
      
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        isStreamingRef.current = false;
        setStreamingState({
          isStreaming: false,
          currentModel: null,
          error: null,
          stage: 'idle',
          progress: 0
        });
        return false;
      }
      
      return handleStreamingError(error as Error, message);
    }
    
    return true;
  }, [user, getCachedResponse, setCachedResponse, estimateProgress, handleStreamingError, updateMetrics]);
  
  // Cancel streaming
  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    isStreamingRef.current = false;
    setStreamingState({
      isStreaming: false,
      currentModel: null,
      error: null,
      stage: 'idle',
      progress: 0
    });
  }, []);
  
  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    if (config.autoSave && user) {
      const storageKey = `chat_messages_${user.id}`;
      localStorage.removeItem(storageKey);
    }
  }, [config.autoSave, user]);
  
  // Clear cache
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);
  
  // Memoized values for performance
  const memoizedMessages = useMemo(() => messages, [messages]);
  const memoizedStreamingState = useMemo(() => streamingState, [streamingState]);
  const memoizedMetrics = useMemo(() => metrics, [metrics]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any ongoing streaming
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Clear all refs to prevent memory leaks
      isStreamingRef.current = false;
      retryCountRef.current = 0;
      responseTimeRef.current = 0;
      
      // Clear cache if it gets too large
      if (cacheRef.current.size > 100) {
        cacheRef.current.clear();
      }
    };
  }, []);
  
  return {
    messages: memoizedMessages,
    streamingState: memoizedStreamingState,
    metrics: memoizedMetrics,
    sendMessage,
    cancelStreaming,
    clearMessages,
    clearCache,
    
    // Advanced features
    cacheSize: cacheRef.current.size,
    retryCount: retryCountRef.current,
    
    // Utility functions
    exportMessages: () => JSON.stringify(messages, null, 2),
    importMessages: (data: string) => {
      try {
        const imported = JSON.parse(data);
        setMessages(imported.map((msg: {
          id: string;
          role: string;
          content: string;
          timestamp: string;
          [key: string]: unknown;
        }) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
        return true;
      } catch {
        return false;
      }
    }
  };
};

export default useEnhancedStreamingChat;