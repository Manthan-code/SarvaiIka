import supabaseAdmin from './src/db/supabase/admin.js';
import config from './src/config/config.js';
import dotenv from 'dotenv';

dotenv.config();

async function updateStripePrices() {
  try {
    console.log('Updating plans with Stripe price IDs...');
    
    // Get all existing plans
    const { data: plans, error: fetchError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .order('display_order');
    
    if (fetchError) {
      console.error('Error fetching plans:', fetchError);
      return;
    }
    
    console.log('Found plans:', plans.map(p => `${p.name} - $${p.price}`));
    
    // Map plan names to Stripe price IDs
    const stripePriceMapping = {
      'Free': config.stripe.priceFree || null, // Free plan might not have a Stripe price
      'Plus': config.stripe.pricePlus,
      'Pro': config.stripe.pricePro
    };
    
    console.log('Stripe price mapping:', stripePriceMapping);
    
    // Update each plan with its Stripe price ID
    for (const plan of plans) {
      const stripePriceId = stripePriceMapping[plan.name];
      
      if (stripePriceId || plan.name === 'Free') {
        const { error: updateError } = await supabaseAdmin
          .from('plans')
          .update({ stripe_price_id: stripePriceId })
          .eq('id', plan.id);
        
        if (updateError) {
          console.error(`Error updating ${plan.name}:`, updateError);
        } else {
          console.log(`✓ Updated ${plan.name} with Stripe price ID: ${stripePriceId || 'null (free plan)'}`);
        }
      } else {
        console.warn(`⚠ No Stripe price ID found for ${plan.name}`);
      }
    }
    
    // Verify the updates
    const { data: updatedPlans, error: verifyError } = await supabaseAdmin
      .from('plans')
      .select('name, price, stripe_price_id')
      .order('display_order');
    
    if (verifyError) {
      console.error('Error verifying updates:', verifyError);
      return;
    }
    
    console.log('\nUpdated plans:');
    updatedPlans.forEach(plan => {
      console.log(`- ${plan.name}: $${plan.price} (Stripe: ${plan.stripe_price_id || 'none'})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateStripePrices();
}

export default updateStripePrices;