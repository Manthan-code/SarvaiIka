const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTableStructure() {
  console.log('🔍 Checking Table Structures\n');

  try {
    // Check profiles table
    console.log('1️⃣ Checking profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
    } else {
      if (profiles.length > 0) {
        console.log('✅ Profiles table columns:', Object.keys(profiles[0]));
        console.log('  Sample data:', profiles[0]);
      } else {
        console.log('❌ No data in profiles table');
      }
    }

    // Check plans table
    console.log('\n2️⃣ Checking plans table...');
    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select('*')
      .limit(3);

    if (plansError) {
      console.error('❌ Error fetching plans:', plansError);
    } else {
      if (plans.length > 0) {
        console.log('✅ Plans table columns:', Object.keys(plans[0]));
        plans.forEach(plan => {
          console.log(`  - ${plan.name}: tier="${plan.tier}", price=$${plan.price}`);
        });
      } else {
        console.log('❌ No data in plans table');
      }
    }

    // Check subscriptions table
    console.log('\n3️⃣ Checking subscriptions table...');
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('subscriptions')
      .select('*')
      .limit(3);

    if (subscriptionsError) {
      console.error('❌ Error fetching subscriptions:', subscriptionsError);
    } else {
      if (subscriptions.length > 0) {
        console.log('✅ Subscriptions table columns:', Object.keys(subscriptions[0]));
        subscriptions.forEach(sub => {
          console.log(`  - User: ${sub.user_id}, Plan: ${sub.plan_name}, Status: ${sub.status}`);
        });
      } else {
        console.log('❌ No data in subscriptions table');
      }
    }

    // Check background_images table
    console.log('\n4️⃣ Checking background_images table...');
    const { data: bgImages, error: bgError } = await supabase
      .from('background_images')
      .select('*')
      .limit(3);

    if (bgError) {
      console.error('❌ Error fetching background_images:', bgError);
    } else {
      if (bgImages.length > 0) {
        console.log('✅ Background_images table columns:', Object.keys(bgImages[0]));
        bgImages.forEach(img => {
          console.log(`  - ${img.name}: tier="${img.tier_required}", active=${img.is_active}`);
        });
      } else {
        console.log('❌ No data in background_images table');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkTableStructure();