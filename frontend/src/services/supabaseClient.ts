import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error("Supabase env missing: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  console.log("Available env vars:", {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing',
    VITE_BASE_URL: import.meta.env.VITE_BASE_URL,
    BASE_URL: import.meta.env.BASE_URL
  });
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Reduce frequency of automatic token refreshes to minimize
    // unnecessary auth state changes when switching tabs
    flowType: 'pkce',
  },
  global: {
    headers: {
      'X-Client-Info': 'ai-agent-platform',
    },
  },
});

export default supabase;
