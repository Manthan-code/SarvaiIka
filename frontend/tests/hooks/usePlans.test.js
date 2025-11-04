import { renderHook } from '@testing-library/react';
import { usePlans } from '../../src/hooks/usePlans';
jest.mock('react-query', () => ({ useQuery: jest.fn() }));
import { useQuery } from 'react-query';

jest.mock('../../src/services/plansService', () => ({
  __esModule: true,
  default: { getPlans: jest.fn() }
}));

describe('usePlans', () => {
  test('returns plans on success', () => {
    useQuery.mockReturnValue({ data: [{ name: 'Pro' }], isLoading: false, error: null });
    const { result } = renderHook(() => usePlans());
    expect(result.current.plans[0].name).toBe('Pro');
    expect(result.current.isLoading).toBe(false);
  });

  test('handles error path', () => {
    useQuery.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail') });
    const { result } = renderHook(() => usePlans());
    expect(result.current.error?.message).toBe('fail');
    expect(result.current.plans).toBeUndefined();
  });
});