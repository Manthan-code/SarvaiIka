const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBackgroundImages() {
  try {
    console.log('🎨 Checking background images database...');
    
    const { data: images, error } = await supabase
      .from('background_images')
      .select('id, name, tier_required, is_active')
      .eq('is_active', true)
      .order('tier_required')
      .order('name');
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('📊 Current active background images:');
    const tierCounts = {};
    images.forEach(img => {
      tierCounts[img.tier_required] = (tierCounts[img.tier_required] || 0) + 1;
      console.log(`  - ${img.name} (${img.tier_required})`);
    });
    
    console.log('\n📈 Tier distribution:', tierCounts);
    
    // Test what a plus user should see
    const plusAllowedTiers = ['free', 'plus'];
    const plusImages = images.filter(img => plusAllowedTiers.includes(img.tier_required));
    console.log(`\n➕ Plus user should see ${plusImages.length} images:`);
    plusImages.forEach(img => {
      console.log(`  - ${img.name} (${img.tier_required})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkBackgroundImages();