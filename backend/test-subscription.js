import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

// Now import the service after env vars are loaded
import { createUserSubscription } from './src/services/subscriptionService.js';

async function testSubscriptionCreation() {
  try {
    console.log('Testing subscription creation...');
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found' : 'Missing');
    console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Found' : 'Missing');
    
    // Use a test user ID (replace with an actual user ID from your auth.users table)
    const testUserId = 'test-user-id-here'; // Replace with real user ID
    
    const result = await createUserSubscription(testUserId, 'Free');
    console.log('✅ Subscription created successfully:', result);
  } catch (error) {
    console.error('❌ Subscription creation failed:', error);
    console.error('Error details:', error.message);
  }
}

testSubscriptionCreation();