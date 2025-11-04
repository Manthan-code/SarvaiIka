const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabaseStructure() {
  console.log('🔍 Checking background_images database structure...\n');

  try {
    // Get all background images with all fields
    console.log('1️⃣ Fetching all background images...');
    const { data: allImages, error: allError } = await supabase
      .from('background_images')
      .select('*')
      .order('created_at', { ascending: true });

    if (allError) {
      console.error('❌ Error fetching all images:', allError);
      return;
    }

    console.log(`✅ Found ${allImages.length} total images in database`);
    
    if (allImages.length > 0) {
      console.log('\n📋 Database columns found:');
      console.log('  Fields:', Object.keys(allImages[0]).join(', '));
      
      console.log('\n📊 Image breakdown by tier:');
      const tierCounts = {};
      allImages.forEach(img => {
        const tier = img.tier_required || img.tier || 'undefined';
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      });
      
      Object.entries(tierCounts).forEach(([tier, count]) => {
        console.log(`  ${tier}: ${count} images`);
      });

      console.log('\n🎯 Sample images:');
      allImages.slice(0, 5).forEach(img => {
        console.log(`  - ${img.name || img.id}: tier_required="${img.tier_required}", tier="${img.tier}", is_active=${img.is_active}`);
      });
    }

    // Test the exact query used by the API
    console.log('\n2️⃣ Testing API query for plus tier...');
    const allowedTiers = ['free', 'plus'];
    const { data: apiImages, error: apiError } = await supabase
      .from('background_images')
      .select('id, name, description, url, thumbnail_url, category, tier_required')
      .eq('is_active', true)
      .in('tier_required', allowedTiers)
      .order('tier_required', { ascending: true })
      .order('name', { ascending: true });

    if (apiError) {
      console.error('❌ API query error:', apiError);
    } else {
      console.log(`✅ API query returned ${apiImages.length} images`);
      apiImages.forEach(img => {
        console.log(`  - ${img.name}: tier_required="${img.tier_required}"`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkDatabaseStructure();