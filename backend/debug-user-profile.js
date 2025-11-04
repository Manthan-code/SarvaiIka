const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugUserProfile() {
  console.log('🔍 Debugging User Profile Issue\n');

  try {
    // Get admin user from auth
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
    
    console.log('✅ Admin user from auth:');
    console.log('  ID:', adminUser.id);
    console.log('  Email:', adminUser.email);

    // Check all profiles in the table
    console.log('\n1️⃣ Checking all profiles in the table...');
    const { data: allProfiles, error: allProfilesError } = await supabase
      .from('profiles')
      .select('*');

    if (allProfilesError) {
      console.error('❌ Error fetching all profiles:', allProfilesError);
      return;
    }

    console.log('✅ All profiles in table:');
    allProfiles.forEach((profile, index) => {
      console.log(`  ${index + 1}. ID: ${profile.id}`);
      console.log(`     Email: ${profile.email}`);
      console.log(`     Subscription Plan: ${profile.subscription_plan}`);
      console.log(`     Subscription Status: ${profile.subscription_status}`);
      console.log('');
    });

    // Check if admin user ID matches any profile
    const matchingProfile = allProfiles.find(p => p.id === adminUser.id);
    if (matchingProfile) {
      console.log('✅ Found matching profile for admin user:');
      console.log('  Profile ID:', matchingProfile.id);
      console.log('  Auth User ID:', adminUser.id);
      console.log('  Match:', matchingProfile.id === adminUser.id);
    } else {
      console.log('❌ No matching profile found for admin user');
      console.log('  Auth User ID:', adminUser.id);
      console.log('  Available Profile IDs:', allProfiles.map(p => p.id));
      
      // Create the missing profile
      console.log('\n🔧 Creating missing profile...');
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
      } else {
        console.log('✅ Created new profile:', newProfile);
      }
    }

    // Test the specific query that the API uses
    console.log('\n2️⃣ Testing the exact API query...');
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', adminUser.id);

    console.log('API Query Result:');
    console.log('  Profile data:', profileData);
    console.log('  Profile error:', profileError);
    console.log('  Profile length:', profileData?.length || 0);
    
    const profile = profileData && profileData.length > 0 ? profileData[0] : null;
    const userTier = profile?.subscription_plan || 'free';
    console.log('  Resolved user tier:', userTier);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

debugUserProfile();