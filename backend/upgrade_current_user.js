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

async function upgradeCurrentUser() {
  try {
    console.log('🔍 Finding the most recently active user to upgrade...\n');
    
    // Get the most recently updated user (likely the one currently logged in)
    const { data: recentUsers, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, name, subscription_plan, last_login, updated_at')
      .order('updated_at', { ascending: false })
      .limit(10);
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log('📋 Most recently active users:');
    recentUsers.forEach((user, index) => {
      const status = user.subscription_plan === 'free' ? '🆓' : 
                   user.subscription_plan === 'plus' ? '➕' : 
                   user.subscription_plan === 'pro' ? '🏆' : '❓';
      console.log(`${index + 1}. ${status} ${user.email} (${user.subscription_plan}) - Updated: ${user.updated_at}`);
    });
    
    // Find free users to upgrade
    const freeUsers = recentUsers.filter(user => user.subscription_plan === 'free');
    
    if (freeUsers.length === 0) {
      console.log('\n✅ No free users found to upgrade. All recent users already have paid plans.');
      return;
    }
    
    // Upgrade the most recently active free user
    const userToUpgrade = freeUsers[0];
    
    console.log(`\n🚀 Upgrading most recent free user: ${userToUpgrade.email}`);
    console.log(`   User ID: ${userToUpgrade.id}`);
    console.log(`   Current Plan: ${userToUpgrade.subscription_plan}`);
    
    // Update the user's subscription plan
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        subscription_plan: 'plus',
        subscription_status: 'active',
        subscription_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userToUpgrade.id)
      .select();
    
    if (updateError) {
      console.error('❌ Error updating user profile:', updateError);
      return;
    }
    
    console.log('✅ User successfully upgraded to plus!');
    console.log('📧 Email:', updatedProfile[0].email);
    console.log('💳 New Plan:', updatedProfile[0].subscription_plan);
    console.log('📊 Status:', updatedProfile[0].subscription_status);
    console.log('⏰ Expires:', updatedProfile[0].subscription_ends_at);
    
    // Test background images access
    console.log('\n🎨 Testing background images access...');
    
    const tierHierarchy = {
      'free': ['free'],
      'plus': ['free', 'plus'],
      'pro': ['free', 'plus', 'pro']
    };
    
    const allowedTiers = tierHierarchy['plus'];
    
    const { data: images, error: imagesError } = await supabaseAdmin
      .from('background_images')
      .select('id, name, tier_required')
      .eq('is_active', true)
      .in('tier_required', allowedTiers)
      .order('tier_required', { ascending: true })
      .order('name', { ascending: true });
    
    if (imagesError) {
      console.log(`❌ Error fetching images: ${imagesError.message}`);
    } else {
      const tierCounts = {};
      images.forEach(img => {
        tierCounts[img.tier_required] = (tierCounts[img.tier_required] || 0) + 1;
      });
      console.log(`✅ User now has access to ${images.length} images: ${JSON.stringify(tierCounts)}`);
      
      console.log('\n📋 Available images:');
      images.forEach((img, index) => {
        const tierEmoji = img.tier_required === 'free' ? '🆓' : '➕';
        console.log(`  ${index + 1}. ${tierEmoji} ${img.name} (${img.tier_required})`);
      });
    }
    
    console.log('\n🎉 Upgrade completed!');
    console.log('💡 The user should now see 7 background images (5 free + 2 plus)');
    console.log('🔄 User may need to refresh the browser or re-open settings to see changes');
    
    // Also upgrade a few more users for testing
    if (freeUsers.length > 1) {
      console.log('\n🔄 Upgrading additional users for testing...');
      
      for (let i = 1; i < Math.min(3, freeUsers.length); i++) {
        const additionalUser = freeUsers[i];
        console.log(`Upgrading ${additionalUser.email}...`);
        
        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_plan: 'plus',
            subscription_status: 'active',
            subscription_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', additionalUser.id);
        
        console.log(`✅ ${additionalUser.email} upgraded to plus`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

upgradeCurrentUser();