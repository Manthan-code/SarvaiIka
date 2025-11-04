const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSetBackground() {
  try {
    console.log('🔍 Checking available background images...');
    
    // Get available background images
    const { data: backgroundImages, error: bgError } = await supabase
      .from('background_images')
      .select('*')
      .eq('is_active', true)
      .limit(5);
    
    if (bgError) {
      console.error('❌ Error fetching background images:', bgError);
      return;
    }
    
    console.log(`✅ Found ${backgroundImages.length} background images:`);
    backgroundImages.forEach((img, index) => {
      console.log(`  ${index + 1}. ${img.name} (${img.category}, ${img.tier_required})`);
    });
    
    if (backgroundImages.length === 0) {
      console.log('❌ No background images found. Creating default ones...');
      
      // Insert default background images
      const defaultImages = [
        {
          name: 'Default Dark',
          description: 'Elegant dark background for focused work',
          url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&h=1080&fit=crop',
          category: 'minimal',
          tier_required: 'free',
          is_active: true
        },
        {
          name: 'Ocean Waves',
          description: 'Calming ocean waves background',
          url: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1920&h=1080&fit=crop',
          category: 'nature',
          tier_required: 'free',
          is_active: true
        }
      ];
      
      const { data: insertedImages, error: insertError } = await supabase
        .from('background_images')
        .insert(defaultImages)
        .select();
      
      if (insertError) {
        console.error('❌ Error inserting default images:', insertError);
        return;
      }
      
      console.log(`✅ Created ${insertedImages.length} default background images`);
      backgroundImages.push(...insertedImages);
    }
    
    // Find test user
    console.log('\n🔍 Finding test user...');
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'test@example.com')
      .limit(1);
    
    if (userError) {
      console.error('❌ Error finding test user:', userError);
      return;
    }
    
    if (users.length === 0) {
      console.log('❌ Test user not found');
      return;
    }
    
    const testUser = users[0];
    console.log(`✅ Found test user: ${testUser.email} (ID: ${testUser.id})`);
    
    // Set background image for test user
    const selectedImage = backgroundImages[0]; // Use first available image
    console.log(`\n🎨 Setting background image: ${selectedImage.name}`);
    
    const { data: updatedSettings, error: updateError } = await supabase
      .from('settings')
      .update({ 
        background_image_id: selectedImage.id,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', testUser.id)
      .select();
    
    if (updateError) {
      console.error('❌ Error updating settings:', updateError);
      return;
    }
    
    console.log('✅ Background image set successfully!');
    console.log('Updated settings:', updatedSettings);
    
    // Verify the update
    console.log('\n🔍 Verifying settings update...');
    const { data: verifySettings, error: verifyError } = await supabase
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
      .eq('user_id', testUser.id)
      .single();
    
    if (verifyError) {
      console.error('❌ Error verifying settings:', verifyError);
      return;
    }
    
    console.log('✅ Verification successful:');
    console.log('  User ID:', verifySettings.user_id);
    console.log('  Background Image ID:', verifySettings.background_image_id);
    console.log('  Background Image:', verifySettings.background_images);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testSetBackground();