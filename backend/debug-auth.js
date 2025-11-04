const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

// Use built-in fetch (Node.js 18+) or fallback
const fetch = globalThis.fetch || require('node-fetch');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugAuth() {
  console.log('🔍 Debugging Authentication Issues...');
  console.log('=====================================\n');

  // Test 1: Check if backend is running
  console.log('1. Testing backend connectivity...');
  try {
    const response = await fetch('http://localhost:5000/api/plans');
    const data = await response.json();
    console.log('✅ Backend is running:', response.status);
  } catch (error) {
    console.log('❌ Backend connection failed:', error.message);
    return;
  }

  // Test 2: Check profile endpoint without auth
  console.log('\n2. Testing profile endpoint without auth...');
  try {
    const response = await fetch('http://localhost:5000/api/auth/profile');
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', data);
  } catch (error) {
    console.log('❌ Profile endpoint test failed:', error.message);
  }

  // Test 3: Check what happens with invalid token
  console.log('\n3. Testing profile endpoint with invalid token...');
  try {
    const response = await fetch('http://localhost:5000/api/auth/profile', {
      headers: {
        'Authorization': 'Bearer invalid-token',
        'Origin': 'http://localhost:8080'
      }
    });
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', data);
  } catch (error) {
    console.log('❌ Invalid token test failed:', error.message);
  }

  // Test 4: Check Supabase connection
  console.log('\n4. Testing Supabase connection...');
  try {
    const { data: { user }, error } = await supabase.auth.getUser('test-token');
    if (error) {
      console.log('Expected Supabase auth error:', error.message);
    } else {
      console.log('Unexpected success with test token');
    }
  } catch (error) {
    console.log('Supabase connection error:', error.message);
  }

  // Test 5: Check profiles table structure
  console.log('\n5. Checking profiles table...');
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role')
      .limit(1);
    
    if (error) {
      console.log('❌ Profiles table error:', error.message);
    } else {
      console.log('✅ Profiles table accessible, sample data:', data);
    }
  } catch (error) {
    console.log('❌ Profiles table check failed:', error.message);
  }

  console.log('\n=====================================');
  console.log('🔍 Debug complete. Check the results above.');
}

debugAuth().catch(console.error);