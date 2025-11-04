/**
 * Comprehensive useStreamingChat Hook Tests
 * Tests for streaming chat functionality, error handling, and state management
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useStreamingChat } from '../../src/hooks/useStreamingChat';
import chatsService from '../../src/services/chatsService';

// Mock dependencies
jest.mock('../../src/services/chatsService', () => ({
  __esModule: true,
  default: {
    streamMessage: jest.fn(),
    sendMessage: jest.fn()
  }
}));

describe('useStreamingChat Hook', () => {
  const mockChatId = 'chat-123';
  const mockMessage = 'Hello, AI assistant!';
  const mockStreamingResponse = 'I am an AI assistant. How can I help you?';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock implementations
    chatsService.streamMessage.mockImplementation(
      (chatId, message, onChunk) => {
        // Simulate streaming response with chunks
        setTimeout(() => onChunk({ content: 'I am ', done: false }), 10);
        setTimeout(() => onChunk({ content: 'an AI ', done: false }), 20);
        setTimeout(() => onChunk({ content: 'assistant. ', done: false }), 30);
        setTimeout(() => onChunk({ content: 'How can I ', done: false }), 40);
        setTimeout(() => onChunk({ content: 'help you?', done: true }), 50);
        
        return { cancel: jest.fn() }; // Cleanup function
      }
    );
  });
  
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useStreamingChat(mockChatId));
    
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamedResponse).toBe('');
    expect(result.current.error).toBeNull();
    expect(typeof result.current.sendMessage).toBe('function');
    expect(typeof result.current.stopStreaming).toBe('function');
    expect(typeof result.current.resetStream).toBe('function');
  });
  
  it('should send message and receive streaming response', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useStreamingChat(mockChatId));
    
    act(() => {
      result.current.sendMessage(mockMessage);
    });
    
    // Initial state after sending
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.streamedResponse).toBe('');
    
    // Wait for streaming to complete
    await waitForNextUpdate();
    await waitForNextUpdate();
    await waitForNextUpdate();
    await waitForNextUpdate();
    await waitForNextUpdate();
    
    // Final state after streaming completes
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamedResponse).toBe(mockStreamingResponse);
    expect(result.current.error).toBeNull();
    
    // Verify service was called correctly
    expect(chatsService.streamMessage).toHaveBeenCalledWith(
      mockChatId,
      { content: mockMessage, role: 'user' },
      expect.any(Function) // onChunk
    );
  });
  
  it('should handle errors during streaming', async () => {
    const mockError = new Error('Network error');
    
    // Override the mock for this specific test
    chatsService.streamMessage.mockImplementationOnce(() => {
      throw mockError;
    });
    
    const { result } = renderHook(() => useStreamingChat(mockChatId));
    
    act(() => {
      result.current.sendMessage(mockMessage);
    });
    
    // Check error state
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).not.toBeNull();
  });
  
  it('should stop streaming when requested', async () => {
    const mockCancel = jest.fn();
    chatsService.streamMessage.mockImplementationOnce(() => {
      return { cancel: mockCancel };
    });
    
    const { result } = renderHook(() => useStreamingChat(mockChatId));
    
    act(() => {
      result.current.sendMessage(mockMessage);
    });
    
    expect(result.current.isStreaming).toBe(true);
    
    act(() => {
      result.current.stopStreaming();
    });
    
    // Check that streaming was stopped
    expect(result.current.isStreaming).toBe(false);
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });
  
  it('should reset stream state', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useStreamingChat(mockChatId));
    
    // First send a message and get some response
    act(() => {
      result.current.sendMessage(mockMessage);
    });
    
    await waitForNextUpdate();
    await waitForNextUpdate();
    
    // Now reset the stream
    act(() => {
      result.current.resetStream();
    });
    
    // Check that state was reset
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamedResponse).toBe('');
    expect(result.current.error).toBeNull();
  });
  
  it('should update chatId when it changes', async () => {
    const newChatId = 'chat-456';
    const { result, rerender } = renderHook(
      ({ chatId }) => useStreamingChat(chatId),
      { initialProps: { chatId: mockChatId } }
    );
    
    // Send initial message
    act(() => {
      result.current.sendMessage(mockMessage);
    });
    
    // Change chatId
    rerender({ chatId: newChatId });
    
    // Send another message
    act(() => {
      result.current.sendMessage(mockMessage);
    });
    
    // Verify service was called with new chatId
    expect(chatsService.sendStreamingMessage).toHaveBeenCalledWith(
      newChatId,
      mockMessage,
      expect.any(Function),
      expect.any(Function),
      expect.any(Function)
    );
  });
});