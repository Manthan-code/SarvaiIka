require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function testAPIEndpoints() {
  const userId = 'b7de34ed-8524-427d-b8e4-05bc47018942';
  
  try {
    console.log('🔍 Testing API endpoints for user:', userId);
    
    // Test 1: /api/background-images endpoint logic
    console.log('\n📡 Testing /api/background-images endpoint logic...');
    
    // Get user subscription plan
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription_plan')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      console.error('❌ Profile error:', profileError);
      return;
    }
    
    const userTier = profile.subscription_plan || 'free';
    console.log('👤 User tier:', userTier);
    
    // Define tier hierarchy (same as backend)
    const tierHierarchy = {
      'free': ['free'],
      'plus': ['free', 'plus'],
      'pro': ['free', 'plus', 'pro']
    };
    
    const allowedTiers = tierHierarchy[userTier] || ['free'];
    console.log('✅ Allowed tiers:', allowedTiers);
    
    // Get background images (same query as backend)
    const { data: images, error: imagesError } = await supabaseAdmin
      .from('background_images')
      .select('id, name, description, url, thumbnail_url, category, tier_required, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (imagesError) {
      console.error('❌ Images error:', imagesError);
      return;
    }
    
    // Filter images based on tier (same logic as backend)
    const filteredImages = images.filter(image => 
      allowedTiers.includes(image.tier_required)
    );
    
    console.log(`🎨 API would return ${filteredImages.length} images:`);
    filteredImages.forEach(img => {
      console.log(`  - ${img.name} (${img.tier_required})`);
    });
    
    // Test 2: /api/settings endpoint logic
    console.log('\n⚙️ Testing /api/settings endpoint logic...');
    
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('settings')
      .select(`
        preferences,
        background_image_id,
        background_images (
          id,
          name,
          url,
          category,
          tier_required
        )
      `)
      .eq('user_id', userId)
      .single();
    
    if (settingsError) {
      console.log('⚠️ No settings found:', settingsError.message);
    } else {
      console.log('📋 Settings response would be:');
      console.log('  - preferences:', settings.preferences);
      console.log('  - background_image_id:', settings.background_image_id);
      console.log('  - background_images:', settings.background_images);
      
      // Check if user can access their selected background
      if (settings.background_images && settings.background_images.tier_required) {
        const canAccess = allowedTiers.includes(settings.background_images.tier_required);
        console.log(`  - Can access selected background: ${canAccess ? '✅ YES' : '❌ NO'}`);
        
        if (!canAccess) {
          console.log('  ⚠️ User has a background selected that they cannot access!');
        }
      }
    }
    
    // Test 3: Check if there are any plus-tier images available
    console.log('\n🎯 Plus-tier images available:');
    const plusImages = images.filter(img => img.tier_required === 'plus');
    if (plusImages.length === 0) {
      console.log('❌ No plus-tier images found in database!');
    } else {
      plusImages.forEach(img => {
        console.log(`  - ${img.name}: ${img.url}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testAPIEndpoints();