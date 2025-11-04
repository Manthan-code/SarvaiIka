import { renderHook, act } from '@testing-library/react';
import { useActiveChat } from '../../src/hooks/useActiveChat';
import { useAuthStore } from '../../src/stores/authStore';
import { apiClient } from '../../src/utils/apiClient';
import { getCachedActiveMessages, switchToActiveChat, clearAllCachedActiveMessages } from '../../src/lib/localStorageUtils';

// Mock dependencies
jest.mock('../../src/stores/authStore');
jest.mock('../../src/utils/apiClient');
jest.mock('../../src/lib/localStorageUtils');

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockGetCachedActiveMessages = getCachedActiveMessages as jest.MockedFunction<typeof getCachedActiveMessages>;
const mockSwitchToActiveChat = switchToActiveChat as jest.MockedFunction<typeof switchToActiveChat>;
const mockClearAllCachedActiveMessages = clearAllCachedActiveMessages as jest.MockedFunction<typeof clearAllCachedActiveMessages>;

describe('useActiveChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      session: {
        user: { id: 'user-123' }
      }
    } as any);
    mockGetCachedActiveMessages.mockReturnValue([]);
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useActiveChat());
    
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.currentChatId).toBeNull();
    expect(result.current.currentChat).toBeNull();
  });

  it('provides all expected methods', () => {
    const { result } = renderHook(() => useActiveChat());
    
    expect(typeof result.current.loadMessages).toBe('function');
    expect(typeof result.current.addMessage).toBe('function');
    expect(typeof result.current.clearMessages).toBe('function');
    expect(typeof result.current.sendMessage).toBe('function');
    expect(typeof result.current.switchChat).toBe('function');
    expect(typeof result.current.refreshMessages).toBe('function');
  });

  it('adds a message to the state', () => {
    const { result } = renderHook(() => useActiveChat());
    
    const testMessage = {
      id: 'msg-1',
      content: 'Test message',
      role: 'user' as const,
      timestamp: new Date().toISOString(),
      chat_id: 'chat-1',
      user_id: 'user-123'
    };
    
    act(() => {
      result.current.addMessage(testMessage);
    });
    
    expect(result.current.messages).toContain(testMessage);
  });

  it('clears messages', () => {
    const { result } = renderHook(() => useActiveChat());
    
    const testMessage = {
      id: 'msg-1',
      content: 'Test message',
      role: 'user' as const,
      timestamp: new Date().toISOString(),
      chat_id: 'chat-1',
      user_id: 'user-123'
    };
    
    act(() => {
      result.current.addMessage(testMessage);
    });
    
    expect(result.current.messages.length).toBe(1);
    
    act(() => {
      result.current.clearMessages();
    });
    
    expect(result.current.messages).toEqual([]);
  });

  it('switches chat and loads messages', async () => {
    const mockResponse = {
      data: {
        id: 'chat-123',
        title: 'Test Chat',
        messages: [{
          id: 'msg-1',
          content: 'Hello',
          role: 'user',
          timestamp: new Date().toISOString(),
          chat_id: 'chat-123',
          user_id: 'user-123'
        }]
      }
    };
    
    mockApiClient.get.mockResolvedValue(mockResponse);
    
    const { result } = renderHook(() => useActiveChat());
    
    await act(async () => {
      await result.current.switchChat('chat-123');
    });
    
    expect(mockApiClient.get).toHaveBeenCalledWith('/api/chat/chat-123', expect.objectContaining({
      signal: expect.any(Object)
    }));
    expect(result.current.currentChatId).toBe('chat-123');
  });

  it('refreshes messages by calling loadMessages with current chat ID', () => {
    const { result } = renderHook(() => useActiveChat());
    
    // Set a current chat ID first
    act(() => {
      result.current.switchChat('chat-123');
    });
    
    act(() => {
      result.current.refreshMessages();
    });
    
    // Should call getCachedActiveMessages when refreshing
    expect(mockGetCachedActiveMessages).toHaveBeenCalled();
  });

  it('maintains stable function references across re-renders', () => {
    const { result, rerender } = renderHook(() => useActiveChat());
    
    const firstRender = {
      loadMessages: result.current.loadMessages,
      addMessage: result.current.addMessage,
      clearMessages: result.current.clearMessages,
      sendMessage: result.current.sendMessage,
      switchChat: result.current.switchChat,
      refreshMessages: result.current.refreshMessages
    };
    
    rerender();
    
    const secondRender = {
      loadMessages: result.current.loadMessages,
      addMessage: result.current.addMessage,
      clearMessages: result.current.clearMessages,
      sendMessage: result.current.sendMessage,
      switchChat: result.current.switchChat,
      refreshMessages: result.current.refreshMessages
    };
    
    expect(firstRender.loadMessages).toBe(secondRender.loadMessages);
    expect(firstRender.addMessage).toBe(secondRender.addMessage);
    expect(firstRender.clearMessages).toBe(secondRender.clearMessages);
    expect(firstRender.sendMessage).toBe(secondRender.sendMessage);
    expect(firstRender.switchChat).toBe(secondRender.switchChat);
    expect(firstRender.refreshMessages).toBe(secondRender.refreshMessages);
  });
});