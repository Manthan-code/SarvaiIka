import chatsService from '../../src/services/chatsService';
import apiClient from '../../src/utils/apiClient';

describe('chatsService', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockClear();
    (apiClient.delete as jest.Mock).mockClear();
  });

  it('getChatSessions builds URLSearchParams correctly', async () => {
    await chatsService.getChatSessions({ limit: 5, cursor: 'abc', direction: 'prev', force: true, _t: '1' });
    const called = (apiClient.get as jest.Mock).mock.calls[0][0];
    expect(called).toMatch('/api/chat/sessions?');
    expect(called).toContain('limit=5');
    expect(called).toContain('cursor=abc');
    expect(called).toContain('direction=prev');
    expect(called).toContain('force=true');
    expect(called).toContain('_t=1');
  });

  it('getChatSession requires sessionId and calls endpoint', async () => {
    await chatsService.getChatSession('sess-1');
    expect((apiClient.get as jest.Mock)).toHaveBeenCalledWith('/api/chat/sess-1', expect.any(Object));
  });

  it('deleteChatSession requires sessionId and calls endpoint', async () => {
    await chatsService.deleteChatSession('sess-2');
    expect((apiClient.delete as jest.Mock)).toHaveBeenCalledWith('/api/chat/sess-2', expect.any(Object));
  });

  it('getChatHistory builds params', async () => {
    await chatsService.getChatHistory({ limit: 7, cursor: 'c1', direction: 'next' });
    const called = (apiClient.get as jest.Mock).mock.calls[0][0];
    expect(called).toMatch('/api/chat/history?');
    expect(called).toContain('limit=7');
    expect(called).toContain('cursor=c1');
    expect(called).toContain('direction=next');
  });

  it('getChats builds params and optional query string', async () => {
    await chatsService.getChats({ limit: 3, cursor: 'c2', direction: 'prev' });
    const called = (apiClient.get as jest.Mock).mock.calls[0][0];
    expect(called).toMatch('/api/chats?');
    expect(called).toContain('limit=3');
    expect(called).toContain('cursor=c2');
    expect(called).toContain('direction=prev');
  });
});