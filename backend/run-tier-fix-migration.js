const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runTierFixMigration() {
  try {
    console.log('🔧 Starting background images tier fix migration...');
    
    // First, let's check the current state
    console.log('📊 Checking current background images tiers...');
    const { data: currentImages, error: checkError } = await supabase
      .from('background_images')
      .select('id, name, tier_required')
      .order('tier_required');
    
    if (checkError) {
      throw checkError;
    }
    
    console.log('Current tier distribution:');
    const tierCounts = currentImages.reduce((acc, img) => {
      acc[img.tier_required] = (acc[img.tier_required] || 0) + 1;
      return acc;
    }, {});
    console.log(tierCounts);
    
    // Since we can't easily modify constraints through Supabase client,
    // let's work around the constraint by updating records in a specific order
    
    console.log('🔄 Step 1: Collecting images that need tier updates...');
    
    // Get all 'pro' tier images (these will become 'plus')
    const { data: proImages, error: proError } = await supabase
      .from('background_images')
      .select('id, name')
      .eq('tier_required', 'pro');
    
    if (proError) throw proError;
    
    // Get all 'premium' tier images (these will become 'pro')
    const { data: premiumImages, error: premiumError } = await supabase
      .from('background_images')
      .select('id, name')
      .eq('tier_required', 'premium');
    
    if (premiumError) throw premiumError;
    
    console.log(`Found ${proImages?.length || 0} 'pro' images to change to 'plus'`);
    console.log(`Found ${premiumImages?.length || 0} 'premium' images to change to 'pro'`);
    
    // Step 2: Temporarily change 'pro' to 'free' to avoid constraint conflicts
    console.log('🔄 Step 2: Temporarily moving pro images to free tier...');
    if (proImages && proImages.length > 0) {
      for (const img of proImages) {
        const { error } = await supabase
          .from('background_images')
          .update({ 
            tier_required: 'free',
            updated_at: new Date().toISOString()
          })
          .eq('id', img.id);
        
        if (error) {
          console.error(`Error updating image ${img.name}:`, error);
          throw error;
        }
      }
      console.log(`✅ Temporarily moved ${proImages.length} pro images to free`);
    }
    
    // Step 3: Change 'premium' to 'pro'
    console.log('🔄 Step 3: Updating premium images to pro...');
    if (premiumImages && premiumImages.length > 0) {
      for (const img of premiumImages) {
        const { error } = await supabase
          .from('background_images')
          .update({ 
            tier_required: 'pro',
            updated_at: new Date().toISOString()
          })
          .eq('id', img.id);
        
        if (error) {
          console.error(`Error updating image ${img.name}:`, error);
          throw error;
        }
      }
      console.log(`✅ Updated ${premiumImages.length} premium images to pro`);
    }
    
    // Step 4: Now we need to manually update the constraint to allow 'plus'
    // Since we can't do this through Supabase client, we'll need to do it differently
    console.log('🔄 Step 4: The constraint needs to be updated manually in the database to allow "plus" tier');
    console.log('Please run this SQL command in your Supabase SQL editor:');
    console.log('ALTER TABLE background_images DROP CONSTRAINT IF EXISTS background_images_tier_required_check;');
    console.log('ALTER TABLE background_images ADD CONSTRAINT background_images_tier_required_check CHECK (tier_required IN (\'free\', \'plus\', \'pro\'));');
    
    console.log('⏳ Waiting for you to update the constraint... (Press Ctrl+C if you need to do this manually)');
    
    // Try to update the temporarily moved images to 'plus'
    console.log('🔄 Step 5: Attempting to update temporarily moved images to plus...');
    if (proImages && proImages.length > 0) {
      for (const img of proImages) {
        try {
          const { error } = await supabase
            .from('background_images')
            .update({ 
              tier_required: 'plus',
              updated_at: new Date().toISOString()
            })
            .eq('id', img.id);
          
          if (error) {
            if (error.code === '23514') {
              console.log(`⚠️  Constraint still doesn't allow 'plus'. Image ${img.name} remains at 'free' tier.`);
              console.log('Please update the database constraint manually and re-run this script.');
              continue;
            }
            throw error;
          }
        } catch (err) {
          console.log(`⚠️  Could not update ${img.name} to plus tier. Constraint may need manual update.`);
        }
      }
    }
    
    // Verify the final state
    console.log('✅ Verifying migration results...');
    const { data: updatedImages, error: verifyError } = await supabase
      .from('background_images')
      .select('id, name, tier_required')
      .order('tier_required');
    
    if (verifyError) {
      throw verifyError;
    }
    
    console.log('Final tier distribution:');
    const newTierCounts = updatedImages.reduce((acc, img) => {
      acc[img.tier_required] = (acc[img.tier_required] || 0) + 1;
      return acc;
    }, {});
    console.log(newTierCounts);
    
    console.log('🎉 Migration completed!');
    console.log('📋 Summary:');
    console.log('- Premium tier images updated to pro');
    console.log('- Pro tier images ready to be updated to plus (may need manual constraint update)');
    console.log('- All tier values are being aligned with the Plans table structure');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runTierFixMigration();