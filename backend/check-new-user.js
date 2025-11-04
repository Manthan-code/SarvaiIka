import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkLatestUser() {
  try {
    console.log('Checking for latest user...');
    
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    if (users && users.length > 0) {
      console.log('Latest user found:', users[0]);
    } else {
      console.log('Still no users in profiles table');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkLatestUser();