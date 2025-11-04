const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testWithRealSession() {
  try {
    console.log('🔐 Testing with real Supabase session...');
    
    // First, let's sign in as admin user
    console.log('1. Signing in as admin user...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'admin123456'
    });

    if (authError) {
      console.error('❌ Login failed:', authError.message);
      
      // Try creating the user first
      console.log('2. Creating test user...');
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: 'test@example.com',
        password: 'TestPassword123!'
      });
      
      if (signupError) {
        console.error('❌ Signup failed:', signupError.message);
        return;
      }
      
      console.log('✅ User created, trying login again...');
      const { data: retryAuthData, error: retryAuthError } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'TestPassword123!'
      });
      
      if (retryAuthError) {
        console.error('❌ Retry login failed:', retryAuthError.message);
        return;
      }
      
      authData = retryAuthData;
    }
    
    console.log('✅ Login successful!');
    console.log('👤 User ID:', authData.user.id);
    console.log('📧 Email:', authData.user.email);
    
    // Now test the background images API
    console.log('\n3. Testing background images API...');
    const response = await fetch('http://localhost:5000/api/background-images', {
      headers: {
        'Authorization': `Bearer ${authData.session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API call successful!');
      console.log('📊 Response data:');
      console.log(JSON.stringify(data, null, 2));
      console.log('\n📊 Number of images:', data.images ? data.images.length : 0);
      
      if (data.images) {
        console.log('\n📊 Image details:');
        data.images.forEach((img, index) => {
          console.log(`${index + 1}. ${img.id} - ${img.name} (tier: ${img.tier})`);
        });
      }
    } else {
      const errorText = await response.text();
      console.error('❌ API call failed:', errorText);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testWithRealSession();