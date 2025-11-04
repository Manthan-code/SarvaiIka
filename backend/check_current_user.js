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

async function checkCurrentUser() {
  try {
    console.log('🔍 Checking all user profiles and their subscription plans...\n');
    
    // Get all profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, name, subscription_plan, role, subscription_status, subscription_ends_at')
      .order('created_at', { ascending: false });
    
    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return;
    }
    
    console.log(`📋 Found ${profiles.length} user profiles:\n`);
    
    profiles.forEach((profile, index) => {
      console.log(`${index + 1}. User: ${profile.email || 'No email'}`);
      console.log(`   ID: ${profile.id}`);
      console.log(`   Name: ${profile.name || 'No name'}`);
      console.log(`   Subscription Plan: ${profile.subscription_plan || 'No plan'}`);
      console.log(`   Role: ${profile.role || 'No role'}`);
      console.log(`   Status: ${profile.subscription_status || 'No status'}`);
      console.log(`   Ends At: ${profile.subscription_ends_at || 'No end date'}`);
      console.log('');
    });
    
    // Check subscriptions table
    console.log('💳 Checking subscriptions table...\n');
    
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        user_id,
        status,
        current_period_end,
        stripe_subscription_id,
        plans (
          name,
          price
        )
      `)
      .order('created_at', { ascending: false });
    
    if (subsError) {
      console.error('❌ Error fetching subscriptions:', subsError);
      return;
    }
    
    console.log(`📋 Found ${subscriptions.length} subscriptions:\n`);
    
    subscriptions.forEach((sub, index) => {
      console.log(`${index + 1}. User ID: ${sub.user_id}`);
      console.log(`   Status: ${sub.status}`);
      console.log(`   Plan: ${sub.plans?.name || 'No plan'} ($${sub.plans?.price || 0})`);
      console.log(`   Period End: ${sub.current_period_end}`);
      console.log(`   Stripe ID: ${sub.stripe_subscription_id}`);
      console.log('');
    });
    
    // Test the background images API logic for each user
    console.log('🎨 Testing background images access for each user...\n');
    
    for (const profile of profiles) {
      console.log(`Testing user: ${profile.email} (${profile.subscription_plan})`);
      
      const userTier = profile.subscription_plan || 'free';
      const tierHierarchy = {
        'free': ['free'],
        'plus': ['free', 'plus'],
        'pro': ['free', 'plus', 'pro']
      };
      
      const allowedTiers = tierHierarchy[userTier] || ['free'];
      console.log(`  Allowed tiers: ${allowedTiers.join(', ')}`);
      
      // Get background images for this user
      const { data: images, error: imagesError } = await supabaseAdmin
        .from('background_images')
        .select('id, name, tier_required')
        .eq('is_active', true)
        .in('tier_required', allowedTiers);
      
      if (imagesError) {
        console.log(`  ❌ Error: ${imagesError.message}`);
      } else {
        const tierCounts = {};
        images.forEach(img => {
          tierCounts[img.tier_required] = (tierCounts[img.tier_required] || 0) + 1;
        });
        console.log(`  ✅ Access to ${images.length} images: ${JSON.stringify(tierCounts)}`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCurrentUser();