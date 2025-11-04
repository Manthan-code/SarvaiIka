const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testLoginCredentials() {
  try {
    console.log('🔐 Testing login credentials...');
    
    // Test admin@test.com with admin123456
    console.log('Testing admin@test.com with admin123456...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'admin123456'
    });

    if (authError) {
      console.error('❌ Login failed:', authError.message);
      
      // Try with different password
      console.log('\nTrying with different password...');
      const { data: authData2, error: authError2 } = await supabase.auth.signInWithPassword({
        email: 'admin@test.com',
        password: 'password123'
      });
      
      if (authError2) {
        console.error('❌ Second attempt failed:', authError2.message);
      } else {
        console.log('✅ Login successful with password123!');
      }
      return;
    }

    console.log('✅ Login successful with admin123456!');
    console.log('👤 User:', authData.user.email);
    console.log('🔑 Session exists:', !!authData.session);

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testLoginCredentials();