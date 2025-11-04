import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSupabase() {
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key:', supabaseKey ? 'Present' : 'Missing');
  
  try {
    // Test basic connection
    console.log('\nTesting basic connection...');
    const { data, error } = await supabase.from('plans').select('*');
    console.log('Basic select result:', { data, error });
    
    // Test with single() - this is what's causing the PGRST116 error
    console.log('\nTesting single() query...');
    const { data: singleData, error: singleError } = await supabase
      .from('plans')
      .select('*')
      .ilike('name', 'plus')
      .single();
    console.log('Single query result:', { data: singleData, error: singleError });
    
    // Test without single()
    console.log('\nTesting without single()...');
    const { data: multiData, error: multiError } = await supabase
      .from('plans')
      .select('*')
      .ilike('name', 'plus');
    console.log('Multi query result:', { data: multiData, error: multiError });
    
    // Test exact match
    console.log('\nTesting exact match...');
    const { data: exactData, error: exactError } = await supabase
      .from('plans')
      .select('*')
      .eq('name', 'Plus');
    console.log('Exact match result:', { data: exactData, error: exactError });
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

debugSupabase();