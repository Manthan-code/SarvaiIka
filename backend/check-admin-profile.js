const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAndFixAdminProfile() {
  console.log('🔍 Checking Admin Profile\n');

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

    // Check if profile exists for this user
    console.log('\n1️⃣ Checking profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminUser.id);

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return;
    }

    if (profiles.length === 0) {
      console.log('❌ No profile found for admin user');
      
      // Create profile
      console.log('🔧 Creating profile for admin user...');
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: adminUser.id,
          email: adminUser.email,
          subscription_plan: 'plus',
          subscription_status: 'active'
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating profile:', createError);
        return;
      }
      
      console.log('✅ Created profile:', newProfile);
    } else {
      const profile = profiles[0];
      console.log('✅ Found profile:');
      console.log('  ID:', profile.id);
      console.log('  Email:', profile.email);
      console.log('  Subscription Plan:', profile.subscription_plan);
      console.log('  Subscription Status:', profile.subscription_status);
      
      // Update to plus if not already set
      if (profile.subscription_plan !== 'plus') {
        console.log('\n🔧 Updating subscription plan to plus...');
        
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
        
        console.log('✅ Updated profile:', updatedProfile);
      }
    }

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

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkAndFixAdminProfile();