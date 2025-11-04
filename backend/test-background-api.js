require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testBackgroundAPI() {
    try {
        console.log('🧪 Testing background images API...');
        
        // Test 1: Check current tier distribution
        console.log('\n📊 Current tier distribution:');
        const { data: allImages, error: fetchError } = await supabase
            .from('background_images')
            .select('tier_required');
            
        if (fetchError) {
            console.error('❌ Error fetching images:', fetchError);
            return;
        }
        
        const tierCounts = allImages.reduce((acc, img) => {
            acc[img.tier_required] = (acc[img.tier_required] || 0) + 1;
            return acc;
        }, {});
        
        console.log(tierCounts);
        
        // Test 2: Simulate API calls for different user tiers
        const testTiers = ['free', 'plus', 'pro'];
        
        for (const userTier of testTiers) {
            console.log(`\n🔍 Testing API for ${userTier} user:`);
            
            // Define tier hierarchy - same as in API
            const tierHierarchy = {
                'free': ['free'],
                'plus': ['free', 'plus'], 
                'pro': ['free', 'plus', 'pro']
            };
            
            const allowedTiers = tierHierarchy[userTier] || ['free'];
            console.log(`  Allowed tiers: ${allowedTiers.join(', ')}`);
            
            // Fetch images for this user tier
            const { data: userImages, error: userError } = await supabase
                .from('background_images')
                .select('id, name, tier_required, url')
                .in('tier_required', allowedTiers)
                .eq('is_active', true);
                
            if (userError) {
                console.error(`  ❌ Error fetching images for ${userTier}:`, userError);
                continue;
            }
            
            console.log(`  ✅ Found ${userImages.length} images available`);
            userImages.forEach(img => {
                console.log(`    - ${img.name} (${img.tier_required} tier)`);
            });
        }
        
        // Test 3: Check if API endpoint structure is correct
        console.log('\n🔧 API Structure Check:');
        const { data: sampleImage, error: sampleError } = await supabase
            .from('background_images')
            .select('*')
            .limit(1)
            .single();
            
        if (sampleError) {
            console.error('❌ Error fetching sample image:', sampleError);
            return;
        }
        
        console.log('✅ Sample image structure:');
        console.log('  Fields:', Object.keys(sampleImage));
        console.log('  Tier field:', sampleImage.tier_required);
        
        console.log('\n🎉 Background images API test completed!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testBackgroundAPI();