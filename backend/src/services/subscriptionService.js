const { createClient } = require('@supabase/supabase-js');

// Don't create the client at module level - create it when needed
let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    supabase = createClient(process.env.SUPABASE_URL, 
      process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabase;
}

async function createUserSubscription(userId, planName = 'free') {
  try {
    console.log(`🔍 Creating subscription for user ${userId} with plan: ${planName}`);
    
    // Get the Supabase client when we actually need it
    const client = getSupabaseClient();
    
    // Get plan details - use case-insensitive search
    const { data: plan, error: planError } = await client
      .from('plans')
      .select('id, max_messages_per_month, name')
      .ilike('name', planName)  // Changed from .eq to .ilike for case-insensitive search
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      console.error('❌ Error fetching plan:', planError);
      console.error(`❌ Plan '${planName}' not found`);
      throw new Error(`Plan '${planName}' not found`);
    }

    console.log(`✅ Found plan: ${plan.name} (ID: ${plan.id}) with ${plan.max_messages_per_month} messages`);

    // Create subscription - FIXED: Use 'client' instead of 'supabase'
    const { data: subscription, error: subError } = await client
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id: plan.id,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        messages_used: 0,
        messages_limit: plan.max_messages_per_month
      })
      .select()
      .single();

    if (subError) {
      console.error('❌ Error creating subscription:', subError);
      throw subError;
    }

    console.log(`✅ Created ${plan.name} subscription for user ${userId} with ${plan.max_messages_per_month} messages`);
    return subscription;
  } catch (error) {
    console.error('❌ createUserSubscription error:', error);
    throw error;
  }
}

module.exports = { createUserSubscription };
