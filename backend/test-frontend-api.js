const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testFrontendAPI() {
  console.log('🧪 Testing Frontend API Call for Background Images\n');

  try {
    // Step 1: Sign in as admin user (plus tier)
    console.log('1️⃣ Signing in as admin user...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'admin123456'
    });

    if (authError) {
      console.error('❌ Auth error:', authError);
      return;
    }

    console.log('✅ Signed in successfully');
    console.log('  User ID:', authData.user.id);
    console.log('  Access Token:', authData.session.access_token.substring(0, 20) + '...');

    // Step 2: Make the exact API call that frontend makes
    console.log('\n2️⃣ Making API call to /api/background-images...');
    
    try {
      const response = await axios.get('http://localhost:5000/api/background-images', {
        headers: {
          'Authorization': `Bearer ${authData.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('  Response Status:', response.status);
      console.log('✅ API call successful!');
      console.log('  Images returned:', response.data.images?.length || 0);
      
      if (response.data.images && response.data.images.length > 0) {
        console.log('\n📋 Images received:');
        response.data.images.forEach((img, index) => {
          console.log(`  ${index + 1}. ${img.name} (${img.tier_required} tier)`);
        });
        
        console.log('\n📊 Tier breakdown:');
        const tierCounts = {};
        response.data.images.forEach(img => {
          const tier = img.tier_required || 'undefined';
          tierCounts[tier] = (tierCounts[tier] || 0) + 1;
        });
        
        Object.entries(tierCounts).forEach(([tier, count]) => {
          console.log(`  ${tier}: ${count} images`);
        });
      }
    } catch (error) {
      console.error('❌ API call failed:', error.response?.data || error.message);
    }

    // Step 3: Check user's subscription tier
    console.log('\n3️⃣ Checking user subscription tier...');
    
    try {
      const userResponse = await axios.get('http://localhost:5000/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${authData.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ User profile retrieved');
      console.log('  Subscription Tier:', userResponse.data.subscription_tier || 'Not set');
      console.log('  Plan Name:', userResponse.data.plan_name || 'Not set');
    } catch (error) {
      console.log('❌ Failed to get user profile:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testFrontendAPI();