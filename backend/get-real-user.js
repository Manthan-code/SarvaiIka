import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables FIRST
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function getRealUserId() {
  try {
    console.log('Fetching a real user ID from the database...');
    
    // Get any user from the profiles table
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, email, name')
      .limit(1);
    
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    
    if (users && users.length > 0) {
      const user = users[0];
      console.log('Found user:', user);
      console.log('\nUse this UUID for testing:');
      console.log(user.id);
      
      // Now test subscription creation with real UUID
      console.log('\nTesting subscription creation with real UUID...');
      const { createUserSubscription } = await import('./src/services/subscriptionService.js');
      
      const result = await createUserSubscription(user.id, 'Free');
      console.log('✅ Subscription created successfully:', result);
    } else {
      console.log('No users found in the database.');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

getRealUserId();