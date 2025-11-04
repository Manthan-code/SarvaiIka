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

async function upgradeUserToPlus() {
  try {
    console.log('🔍 Finding users to upgrade to plus...\n');
    
    // Get all free users
    const { data: freeUsers, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, name, subscription_plan')
      .eq('subscription_plan', 'free')
      .order('created_at', { ascending: false });
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log(`📋 Found ${freeUsers.length} free users:\n`);
    
    freeUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.name || 'No name'}) - ID: ${user.id}`);
    });
    
    if (freeUsers.length === 0) {
      console.log('No free users found to upgrade.');
      return;
    }
    
    // For demo purposes, let's upgrade the first user or a specific user
    // You can modify this to target a specific email
    const targetEmail = process.argv[2]; // Pass email as command line argument
    
    let userToUpgrade;
    if (targetEmail) {
      userToUpgrade = freeUsers.find(user => user.email === targetEmail);
      if (!userToUpgrade) {
        console.log(`❌ User with email ${targetEmail} not found or not on free plan.`);
        return;
      }
    } else {
      // Upgrade the first free user
      userToUpgrade = freeUsers[0];
    }
    
    console.log(`\n🚀 Upgrading user: ${userToUpgrade.email} to plus plan...\n`);
    
    // Update the user's subscription plan
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        subscription_plan: 'plus',
        subscription_status: 'active',
        subscription_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        updated_at: new Date().toISOString()
      })
      .eq('id', userToUpgrade.id)
      .select();
    
    if (updateError) {
      console.error('❌ Error updating user profile:', updateError);
      return;
    }
    
    console.log('✅ User profile updated successfully!');
    console.log('Updated profile:', updatedProfile[0]);
    
    // Create a subscription record
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: userToUpgrade.id,
        plan_id: 'plus-plan-id', // You might need to adjust this based on your plans table
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        messages_limit: 1000,
        messages_used: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select();
    
    if (subError) {
      console.log('⚠️ Warning: Could not create subscription record:', subError.message);
      console.log('But profile was updated successfully.');
    } else {
      console.log('✅ Subscription record created/updated successfully!');
    }
    
    // Test the background images access
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
      .in('tier_required', allowedTiers);
    
    if (imagesError) {
      console.log(`❌ Error fetching images: ${imagesError.message}`);
    } else {
      const tierCounts = {};
      images.forEach(img => {
        tierCounts[img.tier_required] = (tierCounts[img.tier_required] || 0) + 1;
      });
      console.log(`✅ User now has access to ${images.length} images: ${JSON.stringify(tierCounts)}`);
      
      console.log('\nAvailable images:');
      images.forEach(img => {
        console.log(`  - ${img.name} (${img.tier_required})`);
      });
    }
    
    console.log('\n🎉 Upgrade completed! The user should now see plus tier background images.');
    console.log('💡 Tip: The user may need to refresh their browser or log out and back in to see the changes.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Usage: node upgrade_user_to_plus.js [email]
// If no email provided, upgrades the first free user
upgradeUserToPlus();