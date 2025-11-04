require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupTierDistribution() {
    try {
        console.log('🎨 Setting up proper tier distribution for testing...');
        
        // Get all current images
        const { data: allImages, error: fetchError } = await supabase
            .from('background_images')
            .select('id, name, tier_required')
            .order('id');
            
        if (fetchError) {
            console.error('❌ Error fetching images:', fetchError);
            return;
        }
        
        console.log(`Found ${allImages.length} total images`);
        
        // Distribute images across tiers:
        // First 6 images: free tier
        // Next 5 images: plus tier  
        // Last 5 images: pro tier
        
        const updates = [];
        
        for (let i = 0; i < allImages.length; i++) {
            const image = allImages[i];
            let newTier;
            
            if (i < 6) {
                newTier = 'free';
            } else if (i < 11) {
                newTier = 'plus';
            } else {
                newTier = 'pro';
            }
            
            if (image.tier_required !== newTier) {
                updates.push({
                    id: image.id,
                    name: image.name,
                    oldTier: image.tier_required,
                    newTier: newTier
                });
            }
        }
        
        console.log(`Planning to update ${updates.length} images:`);
        updates.forEach(update => {
            console.log(`  - ${update.name}: ${update.oldTier} → ${update.newTier}`);
        });
        
        // Execute updates
        for (const update of updates) {
            const { error: updateError } = await supabase
                .from('background_images')
                .update({ 
                    tier_required: update.newTier,
                    updated_at: new Date().toISOString()
                })
                .eq('id', update.id);
                
            if (updateError) {
                console.error(`❌ Error updating ${update.name}:`, updateError);
                return;
            }
        }
        
        console.log('✅ Updates completed!');
        
        // Verify final distribution
        const { data: finalImages, error: finalError } = await supabase
            .from('background_images')
            .select('tier_required');
            
        if (finalError) {
            console.error('❌ Error fetching final state:', finalError);
            return;
        }
        
        const finalCounts = finalImages.reduce((acc, img) => {
            acc[img.tier_required] = (acc[img.tier_required] || 0) + 1;
            return acc;
        }, {});
        
        console.log('📊 Final tier distribution:', finalCounts);
        console.log('🎉 Tier distribution setup completed!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

setupTierDistribution();