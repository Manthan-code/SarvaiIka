const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testExistingUserBackground() {
  try {
    console.log('🔐 Signing in as existing test user...');
    
    // Sign in as the test user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'testpassword123'
    });
    
    if (authError) {
      console.error('❌ Auth error:', authError);
      return;
    }
    
    console.log('✅ Signed in successfully');
    console.log('User ID:', authData.user.id);
    
    // Test the settings API endpoint
    console.log('\n🧪 Testing Settings API...');
    
    const response = await fetch('http://localhost:5000/api/settings', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.session.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Settings API Response:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('📄 Settings Data:');
      console.log('  User ID:', data.user_id);
      console.log('  Background Image ID:', data.background_image_id);
      console.log('  Background Images:', data.background_images);
      console.log('  Theme:', data.theme);
      
      if (data.background_image_id) {
        console.log('\n🎨 Background Image Details:');
        console.log('  Name:', data.background_images?.name);
        console.log('  URL:', data.background_images?.url);
        console.log('  Category:', data.background_images?.category);
      } else {
        console.log('\n❌ No background image set for this user');
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Settings API Error:', response.status, errorText);
    }
    
    // Also test direct database query
    console.log('\n🔍 Direct database query...');
    const { data: dbSettings, error: dbError } = await supabase
      .from('settings')
      .select(`
        *,
        background_images (
          id,
          name,
          url,
          category,
          tier_required
        )
      `)
      .eq('user_id', authData.user.id)
      .single();
    
    if (dbError) {
      console.error('❌ Database error:', dbError);
    } else {
      console.log('✅ Database query successful:');
      console.log('  Background Image ID:', dbSettings.background_image_id);
      console.log('  Background Image:', dbSettings.background_images);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testExistingUserBackground();