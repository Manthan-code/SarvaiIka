const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAdminUser() {
  console.log('🔧 Fixing Admin User Setup\n');

  try {
    // Step 1: Get the admin user from auth.users
    console.log('1️⃣ Getting admin user from auth.users...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    const adminUser = authUsers.users.find(u => u.email === 'admin@test.com');
    if (!adminUser) {
      console.log('❌ Admin user not found in auth.users');
      return;
    }
    
    console.log('✅ Found admin user:');
    console.log('  User ID:', adminUser.id);
    console.log('  Email:', adminUser.email);

    // Step 2: Check/fix profiles table
    console.log('\n2️⃣ Checking profiles table...');
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', adminUser.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Error checking profile:', profileError);
      return;
    }

    if (!existingProfile) {
      console.log('❌ No profile found, creating one...');
      
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          user_id: adminUser.id,
          email: adminUser.email,
          subscription_tier: 'plus',
          plan_name: 'Plus'
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating profile:', createError);
        return;
      }
      
      console.log('✅ Created new profile:', newProfile);
    } else {
      console.log('✅ Found existing profile:');
      console.log('  Current subscription_tier:', existingProfile.subscription_tier);
      console.log('  Current plan_name:', existingProfile.plan_name);
      
      // Update to plus tier if not already set
      if (existingProfile.subscription_tier !== 'plus') {
        console.log('🔄 Updating to plus tier...');
        
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_tier: 'plus',
            plan_name: 'Plus'
          })
          .eq('user_id', adminUser.id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ Error updating profile:', updateError);
          return;
        }
        
        console.log('✅ Updated profile to plus tier');
      }
    }

    // Step 3: Check/fix plans table
    console.log('\n3️⃣ Checking plans table...');
    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select('*')
      .order('price', { ascending: true });

    if (plansError) {
      console.error('❌ Error fetching plans:', plansError);
      return;
    }

    console.log('✅ Current plans:');
    plans.forEach(plan => {
      console.log(`  - ${plan.name}: tier="${plan.tier}", price=$${plan.price}`);
    });

    // Fix plans if tier is undefined
    const plansToFix = plans.filter(plan => !plan.tier || plan.tier === 'undefined');
    if (plansToFix.length > 0) {
      console.log('\n🔄 Fixing plans with undefined tiers...');
      
      for (const plan of plansToFix) {
        let correctTier = 'free';
        if (plan.name.toLowerCase().includes('plus')) {
          correctTier = 'plus';
        } else if (plan.name.toLowerCase().includes('pro')) {
          correctTier = 'pro';
        }
        
        const { error: fixError } = await supabase
          .from('plans')
          .update({ tier: correctTier })
          .eq('id', plan.id);

        if (fixError) {
          console.error(`❌ Error fixing plan ${plan.name}:`, fixError);
        } else {
          console.log(`✅ Fixed plan ${plan.name} -> tier: ${correctTier}`);
        }
      }
    }

    // Step 4: Test the API again
    console.log('\n4️⃣ Testing background images API...');
    
    // Sign in as admin
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'admin123456'
    });

    if (signInError) {
      console.error('❌ Sign in error:', signInError);
      return;
    }

    // Test API call
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
        const tierCounts = {};
        response.data.images.forEach(img => {
          const tier = img.tier_required || 'undefined';
          tierCounts[tier] = (tierCounts[tier] || 0) + 1;
        });
        
        console.log('  Tier breakdown:');
        Object.entries(tierCounts).forEach(([tier, count]) => {
          console.log(`    ${tier}: ${count} images`);
        });
      }
    } catch (error) {
      console.error('❌ API test failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixAdminUser();