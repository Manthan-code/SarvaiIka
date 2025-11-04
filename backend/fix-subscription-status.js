const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSubscriptionStatus() {
  console.log('🔧 Fixing Admin Subscription Status\n');

  try {
    // Get admin user ID from auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    const adminUser = authUsers.users.find(u => u.email === 'admin@test.com');
    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }
    
    console.log('✅ Admin user ID:', adminUser.id);

    // Update subscription status to active
    console.log('\n1️⃣ Updating subscription status to active...');
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_plan: 'plus',
        subscription_status: 'active'
      })
      .eq('id', adminUser.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating profile:', updateError);
      return;
    }
    
    console.log('✅ Updated profile:');
    console.log('  Subscription Plan:', updatedProfile.subscription_plan);
    console.log('  Subscription Status:', updatedProfile.subscription_status);

    // Test the API again
    console.log('\n2️⃣ Testing background images API...');
    
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'admin123456'
    });

    if (signInError) {
      console.error('❌ Sign in error:', signInError);
      return;
    }

    const axios = require('axios');
    try {
      const response = await axios.get('http://localhost:5000/api/background-images', {
        headers: {
          'Authorization': `Bearer ${authData.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ API test successful!');
      console.log('  Images returned:', response.data.images?.length || 0);
      
      if (response.data.images) {
        console.log('\n📋 Images received:');
        response.data.images.forEach((img, index) => {
          console.log(`  ${index + 1}. ${img.name} (${img.tier_required} tier)`);
        });
        
        const tierCounts = {};
        response.data.images.forEach(img => {
          const tier = img.tier_required || 'undefined';
          tierCounts[tier] = (tierCounts[tier] || 0) + 1;
        });
        
        console.log('\n📊 Tier breakdown:');
        Object.entries(tierCounts).forEach(([tier, count]) => {
          console.log(`  ${tier}: ${count} images`);
        });
        
        if (response.data.images.length === 7) {
          console.log('\n🎉 SUCCESS: Plus tier user now sees 7 images (5 free + 2 plus)!');
        } else {
          console.log('\n⚠️ Expected 7 images but got', response.data.images.length);
        }
      }
    } catch (error) {
      console.error('❌ API test failed:', error.response?.data || error.message);
    }

    // Also test with debug logging
    console.log('\n3️⃣ Testing with debug info...');
    
    // Check what the API is actually seeing
    const { data: profileCheck, error: profileCheckError } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_status')
      .eq('id', adminUser.id);

    if (profileCheckError) {
      console.error('❌ Error checking profile:', profileCheckError);
    } else {
      console.log('✅ Profile check result:', profileCheck[0]);
    }

    // Check background images in database
    const { data: allImages, error: imagesError } = await supabase
      .from('background_images')
      .select('id, name, tier_required, is_active')
      .eq('is_active', true)
      .order('tier_required', { ascending: true })
      .order('name', { ascending: true });

    if (imagesError) {
      console.error('❌ Error fetching images:', imagesError);
    } else {
      console.log('\n📋 All active background images in database:');
      allImages.forEach((img, index) => {
        console.log(`  ${index + 1}. ${img.name} (${img.tier_required} tier)`);
      });
      
      // Test tier filtering manually
      const userTier = 'plus';
      const tierHierarchy = {
        'free': ['free'],
        'plus': ['free', 'plus'],
        'pro': ['free', 'plus', 'pro']
      };
      const allowedTiers = tierHierarchy[userTier] || ['free'];
      
      console.log('\n🔍 Manual tier filtering test:');
      console.log('  User tier:', userTier);
      console.log('  Allowed tiers:', allowedTiers);
      
      const filteredImages = allImages.filter(img => allowedTiers.includes(img.tier_required));
      console.log('  Filtered images count:', filteredImages.length);
      
      filteredImages.forEach((img, index) => {
        console.log(`    ${index + 1}. ${img.name} (${img.tier_required} tier)`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixSubscriptionStatus();