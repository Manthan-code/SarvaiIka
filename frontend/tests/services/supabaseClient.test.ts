import supabaseClient from '../../src/services/supabaseClient';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({})) }));

describe('supabaseClient', () => {
  it('initializes with env vars and options', () => {
    expect(createClient).toHaveBeenCalledTimes(1);
    const args = (createClient as jest.Mock).mock.calls[0];
    const [url, key, options] = args;
    expect(url).toBe((import.meta as any).env.VITE_SUPABASE_URL);
    expect(key).toBe((import.meta as any).env.VITE_SUPABASE_ANON_KEY);
    expect(options?.auth?.autoRefreshToken).toBe(true);
    expect(options?.auth?.persistSession).toBe(true);
    expect(options?.auth?.detectSessionInUrl).toBe(true);
    expect(options?.global?.headers?.['X-Client-Info']).toBe('ai-agent-platform');
  });
});