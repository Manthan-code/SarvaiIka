require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function getAuthToken() {
  try {
    const testEmail = 'testuser@example.com';
    const testPassword = 'TestPassword123!';
    
    console.log('🔑 Signing in to get auth token...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (error) {
      console.error('❌ Sign in error:', error.message);
      return;
    }

    console.log('✅ Successfully signed in!');
    console.log('🎫 Full Access Token:');
    console.log(data.session.access_token);
    console.log('\n👤 User ID:', data.user.id);
    console.log('📧 User Email:', data.user.email);
    
    return data.session.access_token;
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

getAuthToken();