import { renderHook } from '@testing-library/react';
import { useChats } from '../../src/hooks/useChats';
jest.mock('react-query', () => ({ useQuery: jest.fn() }));
import { useQuery } from 'react-query';

jest.mock('../../src/services/chatsService', () => ({
  __esModule: true,
  default: { getChats: jest.fn() }
}));

describe('useChats', () => {
  test('returns chats on success', () => {
    const params = { limit: 10 };
    useQuery.mockReturnValue({ data: [{ id: 'c1' }], isLoading: false, error: null });
    const { result } = renderHook(() => useChats(params));
    expect(result.current.chats[0].id).toBe('c1');
    expect(result.current.isLoading).toBe(false);
  });

  test('handles error path', () => {
    useQuery.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') });
    const { result } = renderHook(() => useChats({}));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.chats).toBeUndefined();
  });
});