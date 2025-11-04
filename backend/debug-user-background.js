const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'your-service-role-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUserBackground() {
  const userId = 'b7de34ed-8524-427d-b8e4-05bc47018942';
  const backgroundImageId = 'ebdc31c7-0091-4dbe-8c24-05fe7f9a2fcd';

  console.log('🔍 Debugging Background Image Issue');
  console.log('===================================');
  console.log(`User ID: ${userId}`);
  console.log(`Expected Background Image ID: ${backgroundImageId}`);

  try {
    // 1. Check user's current settings
    console.log('\n1. Checking user settings...');
    const { data: userSettings, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (settingsError) {
      console.error('❌ Error fetching user settings:', settingsError);
      return;
    }

    if (!userSettings) {
      console.log('❌ No settings found for this user');
      return;
    }

    console.log('✅ User settings found:');
    console.log('   - background_image_id:', userSettings.background_image_id);
    console.log('   - custom_background_url:', userSettings.custom_background_url);
    console.log('   - preferences:', JSON.stringify(userSettings.preferences, null, 2));

    // 2. Check the background image details
    console.log('\n2. Checking background image details...');
    const { data: backgroundImage, error: bgError } = await supabase
      .from('background_images')
      .select('*')
      .eq('id', backgroundImageId)
      .single();

    if (bgError) {
      console.error('❌ Error fetching background image:', bgError);
      return;
    }

    if (!backgroundImage) {
      console.log('❌ Background image not found');
      return;
    }

    console.log('✅ Background image found:');
    console.log('   - ID:', backgroundImage.id);
    console.log('   - Name:', backgroundImage.name);
    console.log('   - URL:', backgroundImage.url);
    console.log('   - Is Active:', backgroundImage.is_active);
    console.log('   - Tier Required:', backgroundImage.tier_required);

    // 3. Test the API response (simulate what frontend gets)
    console.log('\n3. Testing API response...');
    const { data: apiResponse, error: apiError } = await supabase
      .from('settings')
      .select('*, background_images(id, name, url)')
      .eq('user_id', userId)
      .single();

    if (apiError) {
      console.error('❌ Error testing API response:', apiError);
      return;
    }

    console.log('✅ API response:');
    console.log('   - background_image_id:', apiResponse.background_image_id);
    console.log('   - background_images:', apiResponse.background_images);
    console.log('   - preferences:', JSON.stringify(apiResponse.preferences, null, 2));

    // 4. Check what the frontend should receive
    console.log('\n4. Frontend data analysis...');
    
    if (apiResponse.background_images) {
      console.log('✅ Background image data will be available to frontend');
      console.log('   Frontend should see preferences.backgroundImage as:', apiResponse.background_images);
    } else {
      console.log('❌ No background image data in API response');
    }

    // 5. Check if there are any issues
    console.log('\n5. Issue analysis...');
    
    const issues = [];
    
    if (userSettings.background_image_id !== backgroundImageId) {
      issues.push(`Database has different background_image_id: ${userSettings.background_image_id}`);
    }
    
    if (!backgroundImage.is_active) {
      issues.push('Background image is not active');
    }
    
    if (!apiResponse.background_images) {
      issues.push('API response missing background_images join data');
    }
    
    if (userSettings.custom_background_url) {
      issues.push('custom_background_url is not null, might interfere');
    }

    if (issues.length === 0) {
      console.log('✅ No issues found! Background should be working.');
      console.log('\nNext steps:');
      console.log('1. Check if user is logged in correctly');
      console.log('2. Check browser console for errors');
      console.log('3. Verify BackgroundContext is loading data');
    } else {
      console.log('❌ Issues found:');
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

debugUserBackground();