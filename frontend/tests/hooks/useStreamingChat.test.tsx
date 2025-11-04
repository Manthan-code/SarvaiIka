import { renderHook, act } from '@testing-library/react';
import { useStreamingChat } from '../../src/hooks/useStreamingChat';
import { useAuthStore } from '../../src/stores/authStore';

// Mock dependencies
jest.mock('../../src/stores/authStore');

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

// Polyfill TextDecoder and TextEncoder for Jest environment
const { TextDecoder, TextEncoder } = require('util');
(global as any).TextDecoder = TextDecoder;
(global as any).TextEncoder = TextEncoder;

// Helper to create a mock reader that yields provided chunks then completes
function createMockReaderFromChunks(chunks: Uint8Array[]) {
  let index = 0;
  return {
    read: jest.fn().mockImplementation(async () => {
      if (index < chunks.length) {
        const value = chunks[index++];
        return { done: false, value };
      }
      return { done: true, value: undefined };
    })
  };
}

function makeChunkFromJson(obj: unknown): Uint8Array {
  const enc = new TextEncoder();
  const payload = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return enc.encode(`data: ${payload}\n`);
}

// Global fetch mock
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('useStreamingChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      session: { access_token: 'test-token' }
    } as any);
  });

  test('streams token events, updates assistant message, and completes', async () => {
    const chunks = [
      makeChunkFromJson({ type: 'routing', data: { primaryModel: 'gpt-4o' } }),
      makeChunkFromJson({ type: 'model_selected', data: { model: 'gpt-4o' } }),
      makeChunkFromJson({ type: 'token', data: { fullResponse: 'Hello' } }),
      makeChunkFromJson({ type: 'token', data: { fullResponse: 'Hello, world!' } }),
      makeChunkFromJson('[DONE]')
    ];
    const reader = createMockReaderFromChunks(chunks);
    const response = {
      ok: true,
      status: 200,
      body: { getReader: () => reader }
    } as any;

    mockFetch.mockResolvedValue(response);

    const { result } = renderHook(() => useStreamingChat());

    await act(async () => {
      await result.current.sendMessage('Hi there!', 'session-123');
    });

    // Two messages should exist: user and assistant
    expect(result.current.messages.length).toBe(2);
    const userMsg = result.current.messages[0];
    const assistantMsg = result.current.messages[1];

    expect(userMsg.role).toBe('user');
    expect(assistantMsg.role).toBe('assistant');
    expect(assistantMsg.content).toBe('Hello, world!');
    expect(assistantMsg.isStreaming).toBe(false);

    // Streaming state should reflect selected model and not streaming
    expect(result.current.streamingState.isStreaming).toBe(false);
    expect(result.current.streamingState.currentModel).toBe('gpt-4o');
    expect(result.current.streamingState.error).toBeNull();

    // Ensure fetch was called with proper headers and body
    expect(mockFetch).toHaveBeenCalledWith('/api/streaming/stream', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'Authorization': expect.stringContaining('Bearer '),
      }),
      body: expect.any(String)
    }));
  });

  test('handles image event and ends streaming', async () => {
    const chunks = [
      makeChunkFromJson({ type: 'routing', data: { primaryModel: 'gpt-4o' } }),
      makeChunkFromJson({ type: 'image', data: { url: 'http://example.com/image.png' } }),
      makeChunkFromJson('[DONE]')
    ];
    const reader = createMockReaderFromChunks(chunks);
    mockFetch.mockResolvedValue({ ok: true, status: 200, body: { getReader: () => reader } } as any);

    const { result } = renderHook(() => useStreamingChat());

    await act(async () => {
      await result.current.sendMessage('Show image');
    });

    expect(result.current.messages.length).toBe(2);
    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.type).toBe('image');
    expect(assistantMsg.content).toBe('http://example.com/image.png');
    expect(assistantMsg.isStreaming).toBe(false);
    expect(result.current.streamingState.isStreaming).toBe(false);
  });

  test('handles error event and sets error state', async () => {
    const chunks = [
      makeChunkFromJson({ type: 'error', data: { message: 'Stream failed' } }),
      makeChunkFromJson('[DONE]')
    ];
    const reader = createMockReaderFromChunks(chunks);
    mockFetch.mockResolvedValue({ ok: true, status: 200, body: { getReader: () => reader } } as any);

    const { result } = renderHook(() => useStreamingChat());

    await act(async () => {
      await result.current.sendMessage('Trigger error');
    });

    expect(result.current.messages.length).toBe(2);
    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.type).toBe('error');
    expect(assistantMsg.content).toBe('Stream failed');
    expect(assistantMsg.isStreaming).toBe(false);
    expect(result.current.streamingState.isStreaming).toBe(false);
    expect(result.current.streamingState.error).toBe('Stream failed');
  });

  test('network error sets friendly error on assistant message', async () => {
    mockFetch.mockRejectedValue(new Error('Network down'));

    const { result } = renderHook(() => useStreamingChat());

    await act(async () => {
      await result.current.sendMessage('Hi');
    });

    expect(result.current.messages.length).toBe(2);
    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.isStreaming).toBe(false);
    expect(assistantMsg.type).toBe('error');
    expect(assistantMsg.content).toBe('Sorry, I encountered an error. Please try again.');
    expect(result.current.streamingState.isStreaming).toBe(false);
    expect(result.current.streamingState.error).toBe('Network down');
  });
});