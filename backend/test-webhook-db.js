import supabaseAdmin from './src/db/supabase/admin.js';
import logger from './src/config/logger.js';

async function testWebhookDatabase() {
  try {
    logger.info('Testing webhook database operations...');
    
    // Test 1: Check if profiles table has required columns
    logger.info('Checking profiles table schema...');
    const { data: profileColumns, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profileError) {
      logger.error('Error accessing profiles table:', profileError);
    } else {
      logger.info('Profiles table accessible, columns:', Object.keys(profileColumns[0] || {}));
    }
    
    // Test 2: Check if subscriptions table has required columns
    logger.info('Checking subscriptions table schema...');
    const { data: subscriptionColumns, error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .limit(1);
    
    if (subscriptionError) {
      logger.error('Error accessing subscriptions table:', subscriptionError);
    } else {
      logger.info('Subscriptions table accessible, columns:', Object.keys(subscriptionColumns[0] || {}));
    }
    
    // Test 3: Check if plans table has required columns
    logger.info('Checking plans table schema...');
    const { data: planColumns, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .limit(1);
    
    if (planError) {
      logger.error('Error accessing plans table:', planError);
    } else {
      logger.info('Plans table accessible, columns:', Object.keys(planColumns[0] || {}));
    }
    
    // Test 4: Test profile update operation
    logger.info('Testing profile update operation...');
    const testUserId = '00000000-0000-0000-0000-000000000000'; // Dummy UUID
    
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        subscription_plan: 'test',
        subscription_status: 'test',
        subscription_ends_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', testUserId);
    
    if (updateError) {
      logger.error('Profile update test failed:', updateError);
    } else {
      logger.info('Profile update operation test passed');
    }
    
              // Test 5: Test subscription insert operation
     logger.info('Testing subscription insert operation...');
     const testStripeId = 'sub_test_' + Date.now();
     const { error: insertError } = await supabaseAdmin
       .from('subscriptions')
       .insert({
         user_id: testUserId,
         plan_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
         status: 'active', // Use valid status value
         current_period_start: new Date().toISOString(),
         current_period_end: new Date().toISOString(),
         stripe_subscription_id: testStripeId,
         stripe_customer_id: 'cus_test_' + Date.now(),
         messages_limit: 1000,
         messages_used: 0
       });
     
     if (insertError) {
       logger.error('Subscription insert test failed:', insertError);
     } else {
       logger.info('Subscription insert operation test passed');
       
       // Clean up test data
       const { error: cleanupError } = await supabaseAdmin
         .from('subscriptions')
         .delete()
         .eq('stripe_subscription_id', testStripeId);
       
       if (cleanupError) {
         logger.error('Failed to cleanup test subscription:', cleanupError);
       } else {
         logger.info('Test subscription cleaned up successfully');
       }
     }
    
    logger.info('Database health check completed');
    
  } catch (error) {
    logger.error('Database health check failed:', error);
  }
}

// Run the test
testWebhookDatabase();
