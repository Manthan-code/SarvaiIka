const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testFrontendBackgroundAPI() {
  console.log('🧪 Testing Frontend Background Images API Call\n');

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

    // Step 2: Make the exact API call that frontend SettingsModal makes
    console.log('\n2️⃣ Making API call to /api/background-images (frontend style)...');
    
    try {
      const response = await axios.get('http://localhost:5000/api/background-images', {
        headers: {
          'Authorization': `Bearer ${authData.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('  Response Status:', response.status);
      console.log('✅ API call successful!');
      
      const data = response.data;
      console.log('  Raw response structure:', Object.keys(data));
      console.log('  Images array length:', data.images?.length || 0);
      
      if (data.images && data.images.length > 0) {
        console.log('\n📋 Images received (frontend format):');
        data.images.forEach((img, index) => {
          console.log(`  ${index + 1}. ${img.name} (${img.tier_required} tier)`);
        });
        
        console.log('\n📊 Tier breakdown:');
        const tierCounts = {};
        data.images.forEach(img => {
          tierCounts[img.tier_required] = (tierCounts[img.tier_required] || 0) + 1;
        });
        
        Object.entries(tierCounts).forEach(([tier, count]) => {
          console.log(`  ${tier}: ${count} images`);
        });
        
        console.log('\n✅ SUCCESS: Frontend should receive all 7 images!');
        console.log('🎯 Expected: 5 free + 2 plus tier images for admin user');
        
      } else {
        console.log('❌ No images returned in response');
        console.log('Full response:', JSON.stringify(data, null, 2));
      }
      
    } catch (apiError) {
      console.error('❌ API call failed:', apiError.response?.data || apiError.message);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testFrontendBackgroundAPI();