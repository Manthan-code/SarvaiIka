const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use built-in fetch (Node.js 18+) or import dynamically
const fetch = globalThis.fetch || require('node-fetch');

// Initialize Supabase client (same as frontend)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testFrontendAuth() {
  console.log('🔍 Testing Frontend Authentication Flow...');
  console.log('=====================================\n');

  try {
    // Test 1: Check if we can get a session (simulating frontend)
    console.log('1. Checking current session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log('❌ Session error:', sessionError.message);
    } else if (!session) {
      console.log('❌ No active session found');
      console.log('\n💡 This explains the 404 error! The frontend has no valid session.');
      console.log('   The user needs to log in to get a valid access token.');
    } else {
      console.log('✅ Active session found');
      console.log('   User ID:', session.user.id);
      console.log('   Email:', session.user.email);
      
      // Test 2: Try to make authenticated request to profile endpoint
      console.log('\n2. Testing authenticated profile request...');
      const response = await fetch('http://localhost:5000/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('   Response status:', response.status);
      const responseData = await response.json();
      console.log('   Response body:', responseData);
      
      if (response.status === 200) {
        console.log('✅ Profile request successful!');
      } else {
        console.log('❌ Profile request failed');
      }
    }
    
    // Test 3: Check what happens with no auth header (simulating the current issue)
    console.log('\n3. Testing request without auth header (current frontend state)...');
    const noAuthResponse = await fetch('http://localhost:5000/api/auth/profile', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('   Response status:', noAuthResponse.status);
    const noAuthData = await noAuthResponse.json();
    console.log('   Response body:', noAuthData);
    
    if (noAuthResponse.status === 401) {
      console.log('✅ Correctly returns 401 for missing auth');
    } else {
      console.log('❌ Unexpected status code');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
  
  console.log('\n=====================================');
  console.log('🔍 Frontend auth test complete.');
}

testFrontendAuth();