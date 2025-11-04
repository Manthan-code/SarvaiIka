import React from 'react';
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useIsMobile } from '../../src/hooks/use-mobile';

describe('useIsMobile', () => {
  const originalMatchMedia = window.matchMedia;
  const originalInnerWidth = window.innerWidth;
  let listeners: Array<(e?: any) => void> = [];

  beforeEach(() => {
    listeners = [];
    // Mock matchMedia
    window.matchMedia = jest.fn().mockImplementation((query: string) => {
      return {
        matches: /max-width:\s*767px/.test(query) && window.innerWidth < 768,
        media: query,
        addEventListener: (_: string, cb: (e: any) => void) => listeners.push(cb),
        removeEventListener: (_: string, cb: (e: any) => void) => {
          listeners = listeners.filter((l) => l !== cb);
        },
        onchange: null,
        dispatchEvent: jest.fn(),
      } as any;
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    // Reset width
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
  });

  it('returns false initially on desktop width (>=768)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('returns true initially on mobile width (<768)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('updates when matchMedia change event fires (desktop -> mobile)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });
      listeners.forEach((cb) => cb({ matches: true }));
    });

    expect(result.current).toBe(true);
  });

  it('updates when matchMedia change event fires (mobile -> desktop)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
      listeners.forEach((cb) => cb({ matches: false }));
    });

    expect(result.current).toBe(false);
  });

  it('cleans up event listeners on unmount', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    const { unmount } = renderHook(() => useIsMobile());

    expect(listeners.length).toBeGreaterThan(0);

    act(() => {
      unmount();
    });

    // After unmount, listeners should be removable and list ends up empty
    expect(listeners.length).toBe(0);
  });
});