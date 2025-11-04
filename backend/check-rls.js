import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Create client with service role key (bypasses RLS)
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

// Create client with anon key (subject to RLS)
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function checkRLS() {
  console.log('Testing with Service Role Key (bypasses RLS)...');
  try {
    const { data: serviceData, error: serviceError } = await supabaseService
      .from('plans')
      .select('*');
    console.log('Service role result:', { data: serviceData, error: serviceError });
  } catch (err) {
    console.error('Service role error:', err);
  }
  
  console.log('\nTesting with Anon Key (subject to RLS)...');
  try {
    const { data: anonData, error: anonError } = await supabaseAnon
      .from('plans')
      .select('*');
    console.log('Anon key result:', { data: anonData, error: anonError });
  } catch (err) {
    console.error('Anon key error:', err);
  }
}

checkRLS();