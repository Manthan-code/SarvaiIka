import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role key to modify policies
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updatePlansPolicy() {
  console.log('Updating plans RLS policy...');
  
  try {
    // Drop existing policy
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'DROP POLICY IF EXISTS "Anyone can view plans" ON plans;'
    });
    
    if (dropError) {
      console.error('Error dropping policy:', dropError);
    } else {
      console.log('Existing policy dropped successfully');
    }
    
    // Create new policy that allows everyone to read plans
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE POLICY "Anyone can view plans" ON plans FOR SELECT USING (true);'
    });
    
    if (createError) {
      console.error('Error creating policy:', createError);
    } else {
      console.log('New policy created successfully');
    }
    
    // Test the policy
    console.log('\nTesting updated policy...');
    const supabaseAnon = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabaseAnon.from('plans').select('*');
    
    if (error) {
      console.error('Test failed:', error);
    } else {
      console.log('Test successful! Plans found:', data.length);
      console.log('Plan names:', data.map(p => p.name));
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

updatePlansPolicy();