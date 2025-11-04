const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testBackgroundAdmin() {
  try {
    const testEmail = 'backgroundtest@gmail.com';
    const testPassword = 'TestPass123!';
    
    console.log('🧪 Admin Background Test');
    console.log('========================\n');
    
    // Step 1: Get or create confirmed user using admin client
    console.log('1️⃣ Getting/creating confirmed user with admin client...');
    
    // First try to get existing user
    const { data: existingUsers, error: listError } = await adminSupabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === testEmail);
    
    if (existingUser) {
      console.log('✅ User exists, confirming email...');
      // Confirm the existing user's email
      const { data: updateData, error: updateError } = await adminSupabase.auth.admin.updateUserById(
        existingUser.id,
        { email_confirm: true }
      );
      if (updateError) {
        console.error('❌ Error confirming user:', updateError);
        return;
      }
    } else {
      console.log('✅ Creating new confirmed user...');
      const { data: adminUserData, error: adminUserError } = await adminSupabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
        user_metadata: {
          name: 'Background Test User'
        }
      });
      
      if (adminUserError) {
        console.error('❌ Admin user creation error:', adminUserError);
        return;
      }
    }
    
    console.log('✅ User ready for testing');
    
    // Step 2: Sign in as the user
    console.log('\n2️⃣ Signing in as user...');
    const { data: authData, error: authError } = await userSupabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (authError) {
      console.error('❌ Auth error:', authError);
      return;
    }
    
    console.log('✅ Signed in successfully');
    console.log('User ID:', authData.user.id);
    
    // Step 3: Get available background images
    console.log('\n3️⃣ Getting background images...');
    const { data: backgroundImages, error: bgError } = await adminSupabase
      .from('background_images')
      .select('*')
      .eq('is_active', true)
      .limit(3);
    
    if (bgError) {
      console.error('❌ Error fetching background images:', bgError);
      return;
    }
    
    console.log(`✅ Found ${backgroundImages.length} background images:`);
    backgroundImages.forEach((img, index) => {
      console.log(`  ${index + 1}. ${img.name} (${img.category})`);
    });
    
    // Step 4: Set background image for user
    if (backgroundImages.length > 0) {
      const selectedImage = backgroundImages[0];
      console.log(`\n4️⃣ Setting background: ${selectedImage.name}`);
      
      const { data: updatedSettings, error: updateError } = await adminSupabase
        .from('settings')
        .update({
          background_image_id: selectedImage.id,
          preferences: {
            background_image_id: selectedImage.id
          }
        })
        .eq('user_id', authData.user.id)
        .select();
      
      if (updateError) {
        console.error('❌ Error updating settings:', updateError);
        return;
      }
      
      console.log('✅ Background image set successfully');
    }
    
    // Step 5: Test settings API
    console.log('\n5️⃣ Testing Settings API...');
    
    const response = await fetch('http://localhost:5000/api/settings', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.session.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('API Response Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Settings API successful!');
      console.log('\n📄 Response Data:');
      console.log('  User ID:', data.user_id);
      console.log('  Background Image ID:', data.background_image_id);
      console.log('  Background Image Data:', data.background_images);
      
      if (data.background_images) {
        console.log('\n🎨 Background Details:');
        console.log('  Name:', data.background_images.name);
        console.log('  URL:', data.background_images.url);
        console.log('  Category:', data.background_images.category);
        
        console.log('\n✅ SUCCESS: Background image is properly configured!');
        console.log('🔗 The frontend should now load this background image.');
        
        // Step 6: Test frontend access
        console.log('\n6️⃣ Frontend Test Instructions:');
        console.log('================================');
        console.log('1. Go to http://localhost:8080/login');
        console.log(`2. Login with: ${testEmail} / ${testPassword}`);
        console.log('3. Navigate to the chat page');
        console.log('4. You should see the background image applied!');
        console.log(`5. Expected background: ${data.background_images.name}`);
        console.log(`6. Expected URL: ${data.background_images.url}`);
        
      } else {
        console.log('\n❌ No background image data returned');
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Settings API Error:', response.status, errorText);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testBackgroundAdmin();