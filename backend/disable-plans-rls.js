import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function disablePlansRLS() {
  console.log('Attempting to disable RLS on plans table...');
  
  try {
    // Try to execute SQL using the REST API directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        sql: 'ALTER TABLE plans DISABLE ROW LEVEL SECURITY;'
      })
    });
    
    if (!response.ok) {
      console.log('Direct SQL execution failed, trying alternative approach...');
      
      // Alternative: Let's just test if we can access plans with service key
      console.log('Testing plans access with service key...');
      const { data, error } = await supabase.from('plans').select('*');
      
      if (error) {
        console.error('Service key access failed:', error);
      } else {
        console.log('Service key can access plans:', data.length, 'plans found');
        
        // Now let's try to make the backend use service key for plans
        console.log('\nSuggestion: Update the backend to use service key for plans queries');
        console.log('Plans found with service key:');
        data.forEach(plan => {
          console.log(`- ${plan.name}: ${plan.description}`);
        });
      }
    } else {
      console.log('RLS disabled successfully');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

disablePlansRLS();