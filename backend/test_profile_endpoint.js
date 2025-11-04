const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dvhpkyixjggtdsmhgqao.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2aHBreWl4amdndGRzbWhncWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2NDA3NDAsImV4cCI6MjA3MTIxNjc0MH0.lkrPdk22G9H44JcWvmYnqIg4bqBv_sQ7P5e0xmU8W4k';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProfileEndpoint() {
  try {
    console.log('🔐 Attempting to sign in...');
    
    // Try to sign in with email/password
    let authResult = await supabase.auth.signInWithPassword({
      email: 'sunita@gmail.com',
      password: 'password123'
    });
    
    if (authResult.error) {
      console.log('❌ First password failed, trying second password...');
      authResult = await supabase.auth.signInWithPassword({
        email: 'sunita@gmail.com',
        password: 'sunita123'
      });
    }
    
    if (authResult.error) {
      console.error('❌ Authentication failed:', authResult.error.message);
      return;
    }
    
    console.log('✅ Authentication successful');
    const session = authResult.data.session;
    
    if (!session) {
      console.error('❌ No session available');
      return;
    }
    
    console.log('🔑 Access token:', session.access_token.substring(0, 50) + '...');
    
    // Call the profile endpoint (using correct port 5000)
    console.log('📞 Calling profile endpoint...');
    const response = await fetch('http://localhost:5000/api/auth/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Response status:', response.status);
    const responseBody = await response.text();
    console.log('📄 Response body:', responseBody);
    
    if (response.ok) {
      const profileData = JSON.parse(responseBody);
      console.log('👤 Profile data:');
      console.log('  - Role:', profileData.role);
      console.log('  - Subscription Plan:', profileData.subscription_plan);
      console.log('  - Updated At:', profileData.updated_at);
    }
    
    // Sign out
    console.log('🚪 Signing out...');
    await supabase.auth.signOut();
    console.log('✅ Signed out successfully');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testProfileEndpoint();