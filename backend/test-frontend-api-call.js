const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testFrontendApiCall() {
  try {
    console.log('🔐 Testing frontend API call simulation...');
    
    // Step 1: Login as admin@test.com (credentials we know work)
    console.log('1. Logging in as admin@test.com...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'admin123456'
    });

    if (authError) {
      console.error('❌ Login failed:', authError.message);
      return;
    }
    
    console.log('✅ Login successful!');

    console.log('👤 User:', authData.user.email);
    console.log('🔑 Access token exists:', !!authData.session.access_token);

    // Step 2: Test the admin users endpoint exactly like the frontend does
    console.log('\n2. Testing /api/admin/users endpoint...');
    const response = await fetch('http://localhost:5000/api/admin/users', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.session.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API call successful!');
      console.log('📊 Response data structure:', Object.keys(data));
      console.log('👥 Users count:', data.users ? data.users.length : 'No users array');
      
      if (data.users && data.users.length > 0) {
        console.log('👤 First user sample:', JSON.stringify(data.users[0], null, 2));
      }
    } else {
      console.error('❌ API call failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testFrontendApiCall();