import { renderHook, act } from '@testing-library/react';
import { useRecentChats } from '../../src/hooks/useRecentChats';
import chatsService from '../../src/services/chatsService';
import {
  getCachedRecentChats,
  setCachedRecentChats,
  updateCachedChat,
  removeCachedChat,
  addNewChatToRecent,
  clearCachedRecentChats,
  CachedChat,
} from '../../src/lib/localStorageUtils';
import { useAuthStore } from '../../src/stores/authStore';

jest.mock('../../src/services/chatsService');
jest.mock('../../src/lib/localStorageUtils');
jest.mock('../../src/stores/authStore');

const mockChatsService = chatsService as jest.Mocked<typeof chatsService>;
const mockUseAuthStore = useAuthStore as unknown as jest.MockedFunction<typeof useAuthStore>;
const mockGetCachedRecentChats = getCachedRecentChats as jest.MockedFunction<typeof getCachedRecentChats>;
const mockSetCachedRecentChats = setCachedRecentChats as jest.MockedFunction<typeof setCachedRecentChats>;
const mockUpdateCachedChat = updateCachedChat as jest.MockedFunction<typeof updateCachedChat>;
const mockRemoveCachedChat = removeCachedChat as jest.MockedFunction<typeof removeCachedChat>;
const mockAddNewChatToRecent = addNewChatToRecent as jest.MockedFunction<typeof addNewChatToRecent>;
const mockClearCachedRecentChats = clearCachedRecentChats as jest.MockedFunction<typeof clearCachedRecentChats>;

describe('useRecentChats', () => {
  const defaultSession = { access_token: 'token-123' } as any;
  const chatA: CachedChat = { id: 'a', title: 'A', created_at: 't', updated_at: 't', last_message_at: 't', last_message: 'm', unread_count: 0 };
  const chatB: CachedChat = { id: 'b', title: 'B', created_at: 't', updated_at: 't', last_message_at: 't', last_message: 'm2', unread_count: 1 };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({ session: defaultSession } as any);
  });

  it('shows cached chats immediately and performs background refresh', async () => {
    mockGetCachedRecentChats.mockReturnValue([chatA]);

    const serverChats = [chatA, chatB];
    mockChatsService.getChatSessions.mockResolvedValue({ data: serverChats });

    const { result } = renderHook(() => useRecentChats());

    expect(result.current.chats).toEqual([chatA]);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {});

    expect(result.current.chats).toEqual([chatA, chatB]);
    expect(mockSetCachedRecentChats).toHaveBeenCalledWith([chatA, chatB]);
  });

  it('handles add/update/remove and clear cache operations', () => {
    mockGetCachedRecentChats.mockReturnValue([chatA]);
    const { result } = renderHook(() => useRecentChats());

    act(() => {
      result.current.addChat(chatB);
    });
    expect(result.current.chats[0]).toEqual(chatB);
    expect(mockAddNewChatToRecent).toHaveBeenCalledWith(chatB);

    const updatedB = { ...chatB, title: 'B2' };
    act(() => {
      result.current.updateChat(updatedB);
    });
    expect(result.current.chats.find(c => c.id === 'b')?.title).toBe('B2');
    expect(mockUpdateCachedChat).toHaveBeenCalledWith(updatedB);

    act(() => {
      result.current.removeChat('a');
    });
    expect(result.current.chats.find(c => c.id === 'a')).toBeUndefined();
    expect(mockRemoveCachedChat).toHaveBeenCalledWith('a');

    act(() => {
      result.current.clearCache();
    });
    expect(result.current.chats).toEqual([]);
    expect(mockClearCachedRecentChats).toHaveBeenCalled();
  });

  it('refreshChats(force) triggers backend fetch when session exists', async () => {
    mockGetCachedRecentChats.mockReturnValue([]);

    const serverChats = [chatA];
    mockChatsService.getChatSessions.mockResolvedValue({ data: serverChats });

    const { result } = renderHook(() => useRecentChats());

    await act(async () => {
      await result.current.refreshChats(true);
    });

    expect(result.current.chats).toEqual(serverChats);
    expect(mockSetCachedRecentChats).toHaveBeenCalledWith(serverChats);
  });

  it('handles unexpected response formats gracefully', async () => {
    mockGetCachedRecentChats.mockReturnValue([]);
    mockChatsService.getChatSessions.mockResolvedValue({ data: null });

    const { result } = renderHook(() => useRecentChats());
    await act(async () => {});

    expect(result.current.chats).toEqual([]);
    expect(result.current.error === null || typeof result.current.error === 'string').toBe(true);
  });
});