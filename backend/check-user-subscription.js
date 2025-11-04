const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUserSubscription() {
  console.log('🔍 Checking Admin User Subscription Status\n');

  try {
    // Get admin user details
    console.log('1️⃣ Finding admin user...');
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'admin@test.com');

    if (usersError) {
      console.error('❌ Error fetching user:', usersError);
      return;
    }

    if (users.length === 0) {
      console.log('❌ Admin user not found in profiles table');
      
      // Check auth.users table
      console.log('\n🔍 Checking auth.users table...');
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.error('❌ Error fetching auth users:', authError);
        return;
      }
      
      const adminUser = authUsers.users.find(u => u.email === 'admin@test.com');
      if (adminUser) {
        console.log('✅ Found admin user in auth.users:');
        console.log('  User ID:', adminUser.id);
        console.log('  Email:', adminUser.email);
        console.log('  Created:', adminUser.created_at);
        
        // Check if profile exists for this user ID
        const { data: profileByUserId, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', adminUser.id);
          
        if (profileError) {
          console.error('❌ Error checking profile by user_id:', profileError);
        } else if (profileByUserId.length === 0) {
          console.log('❌ No profile found for this user_id');
        } else {
          console.log('✅ Found profile by user_id:', profileByUserId[0]);
        }
      } else {
        console.log('❌ Admin user not found in auth.users either');
      }
      return;
    }

    const adminProfile = users[0];
    console.log('✅ Found admin user profile:');
    console.log('  User ID:', adminProfile.user_id);
    console.log('  Email:', adminProfile.email);
    console.log('  Subscription Tier:', adminProfile.subscription_tier || 'Not set');
    console.log('  Plan Name:', adminProfile.plan_name || 'Not set');

    // Check subscriptions table
    console.log('\n2️⃣ Checking subscriptions table...');
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', adminProfile.user_id);

    if (subError) {
      console.error('❌ Error fetching subscriptions:', subError);
    } else if (subscriptions.length === 0) {
      console.log('❌ No subscription found for admin user');
    } else {
      console.log('✅ Found subscription:');
      subscriptions.forEach(sub => {
        console.log(`  - Plan: ${sub.plan_name}, Status: ${sub.status}, Tier: ${sub.tier}`);
      });
    }

    // Check plans table
    console.log('\n3️⃣ Checking available plans...');
    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select('*')
      .order('price', { ascending: true });

    if (plansError) {
      console.error('❌ Error fetching plans:', plansError);
    } else {
      console.log('✅ Available plans:');
      plans.forEach(plan => {
        console.log(`  - ${plan.name}: ${plan.tier} tier, $${plan.price}`);
      });
    }

    // Test what tier the API thinks this user has
    console.log('\n4️⃣ Testing tier detection logic...');
    
    // Simulate the API logic
    let userTier = 'free'; // default
    
    if (adminProfile.subscription_tier) {
      userTier = adminProfile.subscription_tier;
    } else if (subscriptions.length > 0) {
      const activeSubscription = subscriptions.find(sub => sub.status === 'active');
      if (activeSubscription) {
        userTier = activeSubscription.tier || 'free';
      }
    }
    
    console.log('  Detected tier:', userTier);
    
    // Show what images this tier should see
    const tierHierarchy = {
      'free': ['free'],
      'plus': ['free', 'plus'],
      'pro': ['free', 'plus', 'pro']
    };
    
    const allowedTiers = tierHierarchy[userTier] || ['free'];
    console.log('  Allowed image tiers:', allowedTiers);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkUserSubscription();