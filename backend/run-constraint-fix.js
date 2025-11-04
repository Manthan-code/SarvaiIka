require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixConstraint() {
    try {
        console.log('🔧 Fixing background_images table constraint...');
        
        // First, let's check current state
        console.log('📊 Checking current tier distribution...');
        const { data: currentImages, error: fetchError } = await supabase
            .from('background_images')
            .select('tier_required');
            
        if (fetchError) {
            console.error('❌ Error fetching current images:', fetchError);
            return;
        }
        
        const tierCounts = currentImages.reduce((acc, img) => {
            acc[img.tier_required] = (acc[img.tier_required] || 0) + 1;
            return acc;
        }, {});
        
        console.log('Current tier distribution:', tierCounts);
        
        // Update any remaining 'pro' tier images to 'plus' tier
        console.log('🔄 Updating pro tier images to plus tier...');
        const { data: updatedImages, error: updateError } = await supabase
            .from('background_images')
            .update({ 
                tier_required: 'plus',
                updated_at: new Date().toISOString()
            })
            .eq('tier_required', 'pro')
            .select();
            
        if (updateError) {
            console.error('❌ Error updating images:', updateError);
            return;
        }
        
        console.log(`✅ Updated ${updatedImages?.length || 0} images from 'pro' to 'plus' tier`);
        
        // Verify final state
        console.log('📊 Checking final tier distribution...');
        const { data: finalImages, error: finalFetchError } = await supabase
            .from('background_images')
            .select('tier_required');
            
        if (finalFetchError) {
            console.error('❌ Error fetching final images:', finalFetchError);
            return;
        }
        
        const finalTierCounts = finalImages.reduce((acc, img) => {
            acc[img.tier_required] = (acc[img.tier_required] || 0) + 1;
            return acc;
        }, {});
        
        console.log('Final tier distribution:', finalTierCounts);
        console.log('✅ Tier alignment completed successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

fixConstraint();