const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

// Service role client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Regular client (subject to RLS)
const supabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkRLSPolicies() {
  console.log('🔍 Checking RLS Policies and Access\n');

  try {
    // First, sign in with the admin user using the regular client
    console.log('1️⃣ Signing in with regular client...');
    const { data: authData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'admin123456'
    });

    if (signInError) {
      console.error('❌ Sign in error:', signInError);
      return;
    }

    console.log('✅ Signed in successfully');
    console.log('  User ID:', authData.user.id);

    // Test profile query with regular client (like the API does)
    console.log('\n2️⃣ Testing profile query with regular client (like API)...');
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('subscription_plan')
      .eq('id', authData.user.id);

    console.log('Regular client result:');
    console.log('  Profile data:', profileData);
    console.log('  Profile error:', profileError);
    console.log('  Profile length:', profileData?.length || 0);

    // Test profile query with service role client
    console.log('\n3️⃣ Testing profile query with service role client...');
    const { data: adminProfileData, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription_plan')
      .eq('id', authData.user.id);

    console.log('Service role client result:');
    console.log('  Profile data:', adminProfileData);
    console.log('  Profile error:', adminProfileError);
    console.log('  Profile length:', adminProfileData?.length || 0);

    // Check if RLS is enabled on profiles table
    console.log('\n4️⃣ Checking RLS status on profiles table...');
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .rpc('get_table_info', { table_name: 'profiles' });

    if (tableError) {
      console.log('❌ Could not check table info:', tableError);
    } else {
      console.log('✅ Table info:', tableInfo);
    }

    // Try to check RLS policies (this might not work depending on permissions)
    console.log('\n5️⃣ Checking RLS policies...');
    try {
      const { data: policies, error: policiesError } = await supabaseAdmin
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'profiles');

      if (policiesError) {
        console.log('❌ Could not fetch policies:', policiesError);
      } else {
        console.log('✅ RLS Policies on profiles table:');
        policies.forEach((policy, index) => {
          console.log(`  ${index + 1}. ${policy.policyname}: ${policy.cmd} - ${policy.qual}`);
        });
      }
    } catch (error) {
      console.log('❌ Error checking policies:', error.message);
    }

    // Test if we can create a profile with the regular client
    console.log('\n6️⃣ Testing profile creation with regular client...');
    const testProfileData = {
      id: authData.user.id,
      email: authData.user.email,
      subscription_plan: 'plus',
      subscription_status: 'active'
    };

    const { data: insertData, error: insertError } = await supabaseClient
      .from('profiles')
      .upsert(testProfileData)
      .select()
      .single();

    if (insertError) {
      console.log('❌ Insert/upsert failed:', insertError);
    } else {
      console.log('✅ Insert/upsert successful:', insertData);
    }

    // Test the query again after upsert
    console.log('\n7️⃣ Testing profile query again after upsert...');
    const { data: finalProfileData, error: finalProfileError } = await supabaseClient
      .from('profiles')
      .select('subscription_plan')
      .eq('id', authData.user.id);

    console.log('Final query result:');
    console.log('  Profile data:', finalProfileData);
    console.log('  Profile error:', finalProfileError);
    console.log('  Profile length:', finalProfileData?.length || 0);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkRLSPolicies();