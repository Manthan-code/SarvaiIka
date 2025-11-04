const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const config = require('../config/config.js');
const supabaseAdmin = require('../db/supabase/admin.js');
const { requireAuth } = require('../middlewares/authMiddleware.js');
const { validateStripeWebhookSmart } = require('../middlewares/webhookMiddleware.js');
const { getCachedResponse, cacheResponse, invalidateCache } = require('../redis/redisHelpers.js');
const logger = require('../config/logger.js');
const stripeService = require('../services/stripeService.js');
const SubscriptionExpirationService = require('../services/subscriptionExpirationService.js');
const { asyncHandler, dbOperation, ValidationError } = require('../utils/errorHandler');
const { safePlanNameForProfile } = require('../utils/planUtils');

// Initialize Stripe
const stripe = new Stripe(config.stripe.secretKey);

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ========== SUBSCRIPTION MANAGEMENT ==========

// GET /api/subscriptions - Get user's subscriptions (OPTIMIZED - NO N+1)
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  console.log('Subscriptions route hit, user:', req.user);
  const userId = req.user.id;
  const cacheKey = `subscriptions:${userId}`;
  console.log('UserId:', userId, 'CacheKey:', cacheKey);
  
  const cachedSubscriptions = await getCachedResponse(userId, cacheKey);
  if (cachedSubscriptions) {
    return res.status(200).json({
      success: true,
      data: cachedSubscriptions
    });
  }

  const data = await dbOperation(async () => {
    // Single optimized query with proper join to avoid N+1
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        id,
        user_id,
        plan_id,
        status,
        stripe_subscription_id,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        canceled_at,
        created_at,
        updated_at,
        plans!inner(
          id,
          name,
          price,
          features,
          max_messages_per_month,
          description
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }, 'Fetch user subscriptions with plans');

  await cacheResponse(userId, cacheKey, data, 3600); // Cache for 1 hour
  console.log('Subscriptions data:', data, 'Type:', typeof data, 'IsArray:', Array.isArray(data));
  // Ensure we always return an array
  const responseData = Array.isArray(data) ? data : [];
  res.status(200).json({
    success: true,
    data: responseData
  });
}));

// GET /api/subscriptions/user/subscription - Get current user's subscription
router.get('/user/subscription', requireAuth, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Fetching subscription for user:', userId);

    // Get user's current active subscription with plan details
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        *,
        plans (
          id,
          name,
          price,
          features,
          max_messages_per_month
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('Subscription query result:', { subscription, subError });

    if (subError && subError.code !== 'PGRST116') {
      console.log('Subscription error:', subError);
      throw subError;
    }

    // If we have an active subscription, return it
    if (subscription) {
      console.log('Active subscription found:', subscription);
      return res.status(200).json({
        plan: subscription.plan_id || subscription.plans?.name?.toLowerCase(),
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        plan_details: {
          name: subscription.plans?.name || 'Unknown',
          price: subscription.plans?.price || 0,
          features: Array.isArray(subscription.plans?.features) 
            ? subscription.plans.features 
            : JSON.parse(subscription.plans?.features || '[]')
        }
      });
    }

    console.log('No active subscription, checking profile...');

    // Use profile data from requireAuth middleware
    const profile = req.profile;
    console.log('Profile from middleware:', profile);

    if (!profile) {
      console.log('No profile found in middleware');
      return res.status(403).json({ error: 'User profile not found' });
    }

    const userPlan = profile.subscription_plan || 'free';
    console.log('User plan from profile:', userPlan);

    // Get the actual plan details from the plans table
    const { data: planDetails, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .ilike('name', userPlan)
      .single();

    console.log('Plan details query result:', { planDetails, planError });

    if (planError && planError.code !== 'PGRST116') {
      console.log('Plan details error:', planError);
      // Don't throw here, just use fallback
      console.log('Using fallback plan details');
    }

    // Return the actual plan details from database or fallback
    return res.status(200).json({
      plan: userPlan,
      status: 'active',
      current_period_end: null,
      cancel_at_period_end: false,
      plan_details: {
        name: planDetails?.name || userPlan,
        price: planDetails?.price || 0,
        features: Array.isArray(planDetails?.features) 
          ? planDetails.features 
          : (() => {
              try {
                return JSON.parse(planDetails?.features || '[]');
              } catch (e) {
                console.log('Error parsing features, using empty array');
                return [];
              }
            })()
      }
    });

  } catch (error) {
    console.error('Subscription API error details:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

// POST /api/subscriptions/user/subscription - Update user's subscription
router.post('/user/subscription', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user.id;

    if (!plan || !['free', 'plus', 'pro'].includes(safePlanNameForProfile(plan))) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const planName = plan.charAt(0).toUpperCase() + plan.slice(1);

    // Get plan details from database
    const { data: planData, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('name', planName)
      .single();

    if (planError && plan !== 'free') {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // Update user's profile subscription_plan
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ 
        id: userId,
        subscription_plan: safePlanNameForProfile(plan)
      }, { 
        onConflict: 'id' 
      });

    if (profileError) throw profileError;

    // Cancel existing active subscriptions
    const { error: cancelError } = await supabaseAdmin
      .from('subscriptions')
      .update({ 
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (cancelError) throw cancelError;

    // Create new subscription if not free plan
    if (safePlanNameForProfile(plan) !== 'free' && planData) {
      const { error: subscriptionError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan_id: planData.id,
          status: 'active',
          messages_limit: planData.max_messages_per_month,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (subscriptionError) throw subscriptionError;
    }

    res.status(200).json({
      success: true,
      message: `Successfully updated to ${safePlanNameForProfile(plan)} plan`,
        plan: safePlanNameForProfile(plan),
      status: 'active'
    });

  } catch (error) {
    logger.error('Error updating user subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
}));

// POST /api/subscriptions - Create new subscription
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { plan_id, status = 'active', messages_limit } = req.body;
    const userId = req.user.id;

    if (!plan_id) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // Get plan details to set messages_limit if not provided
    let finalMessagesLimit = messages_limit;
    if (!messages_limit) {
      const { data: plan } = await supabaseAdmin
        .from('plans')
        .select('max_messages_per_month')
        .eq('id', plan_id)
        .single();

      if (plan) {
        finalMessagesLimit = plan.max_messages_per_month;
      }
    }

    const { data: subscription, error } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id,
        status,
        messages_limit: finalMessagesLimit,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select(`
        *,
        plans (*)
      `)
      .single();

    if (error) {
      logger.error('Error creating subscription:', error);
      return res.status(500).json({ error: 'Failed to create subscription' });
    }

    // Invalidate cache
    await invalidateCache(`subscriptions:${userId}`);

    res.status(201).json({
      subscriptionId: subscription.id,
      message: 'Subscription created successfully',
      subscription
    });

  } catch (error) {
    logger.error('Error in POST /api/subscriptions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// PUT /api/subscriptions/:id - Update subscription
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    // Remove fields that shouldn't be updated
    delete updates.id;
    delete updates.user_id;
    delete updates.created_at;

    updates.updated_at = new Date().toISOString();

    const { data: subscription, error } = await supabaseAdmin
      .from('subscriptions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        *,
        plans (*)
      `)
      .single();

    if (error) {
      logger.error('Error updating subscription:', error);
      return res.status(500).json({ error: 'Failed to update subscription' });
    }

    // Invalidate cache
    await invalidateCache(`subscriptions:${userId}`);

    res.status(200).json({
      message: 'Subscription updated successfully',
      subscription
    });

  } catch (error) {
    logger.error('Error in PUT /api/subscriptions/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// DELETE /api/subscriptions/:id - Cancel subscription
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: subscription, error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error canceling subscription:', error);
      return res.status(500).json({ error: 'Failed to cancel subscription' });
    }

    // Invalidate cache
    await invalidateCache(`subscriptions:${userId}`);

    res.status(200).json({
      message: 'Subscription canceled successfully',
      subscription
    });

  } catch (error) {
    logger.error('Error in DELETE /api/subscriptions/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// ========== SUBSCRIPTION EXPIRY ==========

// GET /api/subscriptions/expiry - Get user's subscription expiry info
router.get('/expiry', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const expiryInfo = await SubscriptionExpirationService.getUserSubscriptionExpiry(userId);
    
    if (!expiryInfo) {
      return res.status(200).json({
        hasSubscription: false,
        message: 'No active subscription found'
      });
    }
    
    res.status(200).json({
      hasSubscription: true,
      ...expiryInfo
    });
    
  } catch (error) {
    logger.error('Error getting subscription expiry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/subscriptions/check-expiry - Check and handle user's subscription expiry
router.post('/check-expiry', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const wasExpired = await SubscriptionExpirationService.checkUserSubscriptionExpiry(userId);
    
    res.status(200).json({
      wasExpired,
      message: wasExpired ? 'Subscription was expired and has been handled' : 'Subscription is still active'
    });
    
  } catch (error) {
    logger.error('Error checking subscription expiry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== PAYMENT PROCESSING ==========

// POST /api/subscriptions/create-checkout-session - Create Stripe checkout session
router.post('/create-checkout-session', requireAuth, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // Get plan details from database - try by UUID first, then by name
    let { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    // If not found by UUID, try by plan name (for fallback plans)
    if (planError || !plan) {
      const { data: planByName, error: nameError } = await supabaseAdmin
        .from('plans')
        .select('*')
        .eq('name', planId)
        .single();
      
      if (!nameError && planByName) {
        plan = planByName;
        planError = null;
      }
    }

    if (planError || !plan) {
      logger.error('Plan not found by ID or name:', { planId, planError });
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (!plan.stripe_price_id) {
      return res.status(400).json({ error: 'Plan does not have a Stripe price ID configured' });
    }

    // Create checkout session
    const session = await stripeService.createCheckoutSession({
      userId: userId,
      planId: planId,
      priceId: plan.stripe_price_id,
      successUrl: `${process.env.FRONTEND_URL}/subscriptions?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.FRONTEND_URL}/subscriptions?canceled=true`
    });

    // Clear user's subscription cache
    await invalidateCache(userId, `subscriptions:${userId}`);
    await invalidateCache(userId, `user_subscription:${userId}`);

    res.status(200).json({
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    logger.error('Error creating checkout session:', error);
    
    // Check if it's a Stripe authentication error (dummy keys)
    if (error.type === 'StripeAuthenticationError' || error.code === 'authentication_required') {
      return res.status(500).json({ 
        error: 'Payment system configuration error. Please contact support.',
        details: 'Stripe authentication failed - invalid API keys configured'
      });
    }
    
    // Check if it's an invalid price ID error
    if (error.code === 'resource_missing' && error.message?.includes('price')) {
      return res.status(500).json({ 
        error: 'Payment plan configuration error. Please contact support.',
        details: 'Invalid Stripe price ID configured for this plan'
      });
    }
    
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}));

// POST /api/subscriptions/create-billing-portal - Create billing portal session
router.post('/create-billing-portal', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's Stripe customer ID
    const customer = await stripeService.getCustomerByUserId(userId);
    
    if (!customer) {
      return res.status(404).json({ error: 'No Stripe customer found for user' });
    }

    // Create billing portal session
    const session = await stripeService.createBillingPortalSession(
      customer.id,
      `${process.env.FRONTEND_URL}/subscriptions`
    );

    res.status(200).json({
      url: session.url
    });

  } catch (error) {
    logger.error('Error creating billing portal session:', error);
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});

// POST /api/subscriptions/cancel-subscription - Cancel subscription
router.post('/cancel-subscription', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { immediate = false } = req.body;

    // Get user's active subscription
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    if (!subscription.stripe_subscription_id) {
      return res.status(400).json({ error: 'No Stripe subscription ID found' });
    }

    // Cancel subscription in Stripe
    let canceledSubscription;
    if (immediate) {
      canceledSubscription = await stripeService.cancelSubscriptionImmediately(subscription.stripe_subscription_id);
    } else {
      canceledSubscription = await stripeService.cancelSubscription(subscription.stripe_subscription_id);
    }

    // Update subscription in database
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        cancel_at_period_end: !immediate,
        status: immediate ? 'canceled' : 'active',
        canceled_at: immediate ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    if (updateError) {
      logger.error('Error updating subscription in database:', updateError);
    }

    // Clear user's subscription cache
    await invalidateCache(userId, `subscriptions:${userId}`);
    await invalidateCache(userId, `user_subscription:${userId}`);

    res.status(200).json({
      message: immediate ? 'Subscription canceled immediately' : 'Subscription will be canceled at the end of the current period',
      subscription: canceledSubscription
    });

  } catch (error) {
    logger.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// ========== STRIPE WEBHOOK HANDLING ==========

// POST /api/subscriptions/test-checkout-completion - Test endpoint for simulating checkout completion
router.post('/test-checkout-completion', requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = req.user.id; // Get the actual authenticated user's ID
    const { plan_name, session_id } = req.body;

    if (!plan_name) {
      return res.status(400).json({ error: 'Plan name is required' });
    }

    // Simulate checkout session completion
    const mockSession = {
      id: session_id || 'cs_test_' + Date.now(),
      customer: 'cus_test_' + Date.now(),
      subscription: 'sub_test_' + Date.now(),
      metadata: {
        userId: authenticatedUserId, // Use the actual authenticated user's ID
        planName: plan_name
      }
    };

    // Call the checkout completion handler
    await handleCheckoutCompleted(mockSession);

    res.status(200).json({ 
      success: true, 
      message: 'Checkout completion simulated successfully',
      session: mockSession
    });

  } catch (error) {
    logger.error('Error in test checkout completion:', error);
    res.status(500).json({ error: 'Test checkout completion failed' });
  }
});

// POST /api/subscriptions/process-real-session - Process actual Stripe session
router.post('/process-real-session', requireAuth, async (req, res) => {
  try {
    const { session_id, planId } = req.body; // Accept planId from request body
    const authenticatedUserId = req.user.id; // Get the actual authenticated user's ID

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // Check if this is a test session (starts with cs_test_)
    if (session_id.startsWith('cs_test_')) {
      logger.info('Processing test session from frontend:', session_id);
      
      // For test sessions, use the authenticated user's ID and the provided planId
      const testSession = {
        id: session_id,
        status: 'complete',
        metadata: {
          userId: authenticatedUserId, // Use the actual authenticated user's ID
          planId: planId // Use the planId from the request body
        },
        subscription: `sub_test_${Date.now()}` // This should be a string, not an object
       };

      // Call the checkout completion handler with test session data
      await handleCheckoutCompleted(testSession);

      return res.status(200).json({ 
        success: true, 
        message: 'Test session processed successfully from frontend',
        session_id: testSession.id,
        user_id: testSession.metadata.userId,
        plan_id: testSession.metadata.planId
      });
    }

    // Retrieve the actual session from Stripe for real sessions
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription']
    });

    if (session.status !== 'complete') {
      return res.status(400).json({ error: 'Session is not complete' });
    }

    // Call the checkout completion handler with real session data
    await handleCheckoutCompleted(session);

    res.status(200).json({ 
      success: true, 
      message: 'Real session processed successfully',
      session_id: session.id,
      user_id: session.metadata?.userId,
      plan_id: session.metadata?.planId
    });

  } catch (error) {
    logger.error('Error processing real session:', error);
    res.status(500).json({ error: 'Failed to process real session: ' + error.message });
  }
});

// GET /api/subscriptions/check-user/:userId - Check user profile data
router.get('/check-user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, subscription_plan, subscription_status')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'User not found', details: error });
    }

    res.status(200).json({ 
      success: true, 
      profile
    });

  } catch (error) {
    logger.error('Error checking user profile:', error);
    res.status(500).json({ error: 'Failed to check user profile: ' + error.message });
  }
});

// GET /api/subscriptions/list-users - List all users for debugging
router.get('/list-users', async (req, res) => {
  try {
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, subscription_plan, subscription_status')
      .limit(10);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch users', details: error });
    }

    res.status(200).json({ 
      success: true, 
      profiles,
      count: profiles.length
    });

  } catch (error) {
    logger.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users: ' + error.message });
  }
});

// POST /api/subscriptions/test-existing-user - Test subscription update for existing user
router.post('/test-existing-user', async (req, res) => {
  try {
    const { user_id, plan_name } = req.body;

    if (!user_id || !plan_name) {
      return res.status(400).json({ error: 'User ID and plan name are required' });
    }

    // Create a mock session with the existing user ID
    const mockSession = {
      id: 'cs_test_existing_' + Date.now(),
      customer: 'cus_test_existing_' + Date.now(),
      subscription: 'sub_test_existing_' + Date.now(),
      metadata: {
        userId: user_id,
        planName: plan_name
      }
    };

    // Call the checkout completion handler
    await handleCheckoutCompleted(mockSession);

    res.status(200).json({ 
      success: true, 
      message: 'Subscription updated for existing user',
      user_id: user_id,
      plan_name: plan_name
    });

  } catch (error) {
    logger.error('Error testing existing user subscription:', error);
    res.status(500).json({ error: 'Failed to test existing user subscription: ' + error.message });
  }
});

// POST /api/subscriptions/test-webhook - Test webhook handler manually
router.post('/test-webhook', async (req, res) => {
  try {
    const { sessionId, userId, planId } = req.body;
    
    if (!sessionId || !userId || !planId) {
      return res.status(400).json({ error: 'sessionId, userId, and planId are required' });
    }

    // Create a mock checkout session completed event with test subscription ID
    const mockSession = {
      id: sessionId,
      object: 'checkout.session',
      customer: 'cus_test_customer',
      subscription: 'sub_test_' + Date.now(), // Use test subscription ID
      metadata: {
        userId: userId,
        planId: planId
      }
    };

    logger.info('Testing webhook with mock session:', mockSession);
    
    // Call the handleCheckoutCompleted function directly
    await handleCheckoutCompleted(mockSession);
    
    res.json({ 
      success: true, 
      message: 'Webhook test completed',
      sessionId: sessionId
    });
  } catch (error) {
    logger.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/subscriptions/webhook-status - Check webhook configuration
router.get('/webhook-status', async (req, res) => {
  try {
    const status = {
      webhookSecretConfigured: !!(process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_CLI_WEBHOOK_SECRET),
      productionWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      cliWebhookSecret: !!process.env.STRIPE_CLI_WEBHOOK_SECRET,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      stripeKeyConfigured: !!process.env.STRIPE_SECRET_KEY,
      hybridMode: !!(process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_CLI_WEBHOOK_SECRET)
    };
    
    res.json(status);
  } catch (error) {
    logger.error('Error getting webhook status:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/subscriptions/webhook - Stripe webhook handler
router.post('/webhook', 
  express.raw({ type: 'application/json' }),
  validateStripeWebhookSmart,
  async (req, res) => {
    try {
      // Event is already verified and attached by middleware
      const event = req.stripeEvent;
      logger.info('Processing verified webhook event:', {
        type: event.type,
        id: event.id,
        created: event.created
      });
    
    logger.info('Stripe webhook received:', event.type);

    switch (event.type) {
      case 'checkout.session.completed':
        logger.info('Processing checkout.session.completed event');
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'payment_intent.succeeded':
        logger.info('Processing payment_intent.succeeded event');
        await handlePaymentSuccess(event.data.object);
        break;

      case 'customer.subscription.updated':
        logger.info('Processing customer.subscription.updated event');
        await handleSubscriptionUpdate(event.data.object);
        break;

      case 'customer.subscription.deleted':
        logger.info('Processing customer.subscription.deleted event');
        await handleSubscriptionCancel(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        logger.info('Processing invoice.payment_succeeded event');
        await handleInvoicePayment(event.data.object);
        break;

      default:
        logger.info('Unhandled event type:', event.type);
    }

    logger.info('Webhook processed successfully:', {
      eventType: event.type,
      eventId: event.id,
      timestamp: new Date().toISOString()
    });
    
    res.status(200).json({ 
      success: true, 
      received: true,
      eventType: event.type,
      eventId: event.id
    });

  } catch (error) {
    logger.error('Error in Stripe webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// ========== WEBHOOK HANDLER FUNCTIONS ==========

async function handleCheckoutCompleted(session) {
  try {
    logger.info('Processing checkout completion:', {
      sessionId: session.id,
      customer: session.customer,
      subscription: session.subscription,
      metadata: session.metadata
    });
    
    const { customer, subscription: stripe_subscription_id } = session;
    
    // Handle test scenarios vs real Stripe subscriptions
    let stripeSubscription = null;
    let isTestScenario = false;
    let metadata = {};
    let userId, planId, planName;
    
    // Safely check if it's a test scenario
    logger.info('Checking subscription ID:', {
      stripe_subscription_id,
      type: typeof stripe_subscription_id,
      isString: typeof stripe_subscription_id === 'string'
    });
    
    if (stripe_subscription_id && typeof stripe_subscription_id === 'string') {
      isTestScenario = stripe_subscription_id.startsWith('sub_test_');
      logger.info('Test scenario check:', { isTestScenario, stripe_subscription_id });
      
      if (isTestScenario) {
        // For test scenarios, get metadata from session
        logger.info('Test scenario detected, extracting metadata from session:', {
          hasMetadata: !!session.metadata,
          sessionMetadata: session.metadata
        });
        if (session.metadata) {
          metadata = session.metadata;
          userId = metadata.userId;
          planId = metadata.planId;
          planName = metadata.planName;
          logger.info('Extracted metadata:', { userId, planId, planName });
        }
      } else {
        // Get subscription details from Stripe for real subscriptions
        stripeSubscription = await stripeService.getSubscription(stripe_subscription_id);
        if (stripeSubscription && stripeSubscription.metadata) {
          metadata = stripeSubscription.metadata;
          userId = metadata.userId;
          planId = metadata.planId;
          planName = metadata.planName;
        }
      }
    } else {
      logger.warn('Invalid stripe_subscription_id:', stripe_subscription_id);
    }

    if (!userId || (!planId && !planName)) {
      logger.error('Missing userId or planId/planName in subscription metadata:', metadata);
      return;
    }
    
    logger.info(`Processing subscription for user ${userId}, plan: ${planId || planName}`);

    // Get plan details - support both planId and planName
    let plan, planError;
    if (planId) {
      const result = await supabaseAdmin
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single();
      plan = result.data;
      planError = result.error;
    } else if (planName) {
      const result = await supabaseAdmin
        .from('plans')
        .select('*')
        .ilike('name', planName)
        .single();
      plan = result.data;
      planError = result.error;
    }

    if (planError || !plan) {
      logger.error('Plan not found for checkout completion:', planError);
      return;
    }
    
    // Create subscription record with appropriate data
    const now = new Date();
    
    // Safely handle date conversion with validation
    let periodStart = now;
    let periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now as default
    
    if (stripeSubscription && stripeSubscription.current_period_start) {
      const startDate = new Date(stripeSubscription.current_period_start * 1000);
      if (!isNaN(startDate.getTime())) {
        periodStart = startDate;
      }
    }
    
    if (stripeSubscription && stripeSubscription.current_period_end) {
      const endDate = new Date(stripeSubscription.current_period_end * 1000);
      if (!isNaN(endDate.getTime())) {
        periodEnd = endDate;
      }
    }
    
    const subscriptionStatus = stripeSubscription ? stripeSubscription.status : 'active';

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (existingSubscription) {
      // Update existing subscription
      logger.info(`Updating existing subscription for user ${userId}`);
      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          plan_id: plan.id,
          status: subscriptionStatus,
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          stripe_subscription_id: stripe_subscription_id,
          stripe_customer_id: customer,
          messages_limit: plan.max_messages_per_month,
          updated_at: now.toISOString()
        })
        .eq('id', existingSubscription.id);

      if (updateError) {
        logger.error('Error updating existing subscription:', updateError);
      } else {
        logger.info(`Successfully updated existing subscription for user ${userId}`);
      }
    } else {
      // Create new subscription record
      logger.info(`Creating new subscription for user ${userId}`);
      const { error: subscriptionError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan_id: plan.id,
          status: subscriptionStatus,
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          stripe_subscription_id: stripe_subscription_id,
          stripe_customer_id: customer,
          messages_limit: plan.max_messages_per_month,
          messages_used: 0,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        });

      if (subscriptionError) {
        logger.error('Error creating subscription record:', subscriptionError);
      } else {
        logger.info(`Successfully created new subscription for user ${userId}`);
      }
    }

      // Update user's profile subscription plan using admin client
      logger.info(`Attempting to update profile for user ${userId} with plan ${plan.name.toLowerCase()}`);
      
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_plan: safePlanNameForProfile(plan.name),
          subscription_status: subscriptionStatus,
          subscription_ends_at: periodEnd.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', userId)
        .select();

      if (profileError) {
        logger.error('Error updating user profile:', profileError);
        logger.error('Profile update failed for user:', userId);
        // Continue processing even if profile update fails
      } else {
        logger.info(`User ${userId} subscription updated to ${plan.name.toLowerCase()}`);
        logger.info('Profile update result:', profileData);
      }

      // Clear user's subscription cache
      await invalidateCache(userId, `subscriptions:${userId}`);
      await invalidateCache(userId, `user_subscription:${userId}`);

    logger.info('Checkout completed successfully for user:', userId);
  } catch (error) {
    logger.error('Error handling checkout completion:', error);
  }
}

async function handlePaymentSuccess(paymentIntent) {
  try {
    const { customer, metadata } = paymentIntent;
    
    if (metadata?.subscription_id) {
      // Update subscription status
      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          stripe_customer_id: customer,
          updated_at: new Date().toISOString()
        })
        .eq('id', metadata.subscription_id);
    }

    logger.info('Payment processed successfully for customer:', customer);
  } catch (error) {
    logger.error('Error handling payment success:', error);
  }
}

async function handleSubscriptionUpdate(subscription) {
  try {
    const { 
      id: stripe_subscription_id, 
      status, 
      current_period_start,
      current_period_end,
      customer: stripe_customer_id,
      metadata
    } = subscription;

    // Check if subscription already exists
    const { data: existingSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', stripe_subscription_id)
      .single();

    if (existingSubscription) {
      // Update existing subscription
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status,
          current_period_start: new Date(current_period_start * 1000).toISOString(),
          current_period_end: new Date(current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', stripe_subscription_id);
    } else {
      // Create new subscription from webhook
      const userId = metadata?.userId;
      const planId = metadata?.planId;
      
      if (userId && planId) {
        // Get plan details
        const { data: plan } = await supabaseAdmin
          .from('plans')
          .select('*')
          .eq('id', planId)
          .single();

        if (plan) {
          // Check if user already has an active subscription
          const { data: existingSubscription } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();

          const periodStart = new Date(current_period_start * 1000);
          const periodEnd = new Date(current_period_end * 1000);

          if (existingSubscription) {
            // Update existing subscription
            logger.info(`Updating existing subscription for user ${userId} in subscription update handler`);
            await supabaseAdmin
              .from('subscriptions')
              .update({
                plan_id: planId,
                status: status,
                current_period_start: periodStart.toISOString(),
                current_period_end: periodEnd.toISOString(),
                stripe_subscription_id: stripe_subscription_id,
                stripe_customer_id: stripe_customer_id,
                messages_limit: plan.max_messages_per_month,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingSubscription.id);
          } else {
            // Create new subscription with 30-day duration
            logger.info(`Creating new subscription for user ${userId} in subscription update handler`);
            await supabaseAdmin
              .from('subscriptions')
              .insert({
                user_id: userId,
                plan_id: planId,
                status: status,
                current_period_start: periodStart.toISOString(),
                current_period_end: periodEnd.toISOString(),
                stripe_subscription_id: stripe_subscription_id,
                stripe_customer_id: stripe_customer_id,
                messages_limit: plan.max_messages_per_month,
                messages_used: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
          }

          // Update user's profile subscription plan
          const { error: profileUpdateError } = await supabaseAdmin
            .from('profiles')
            .update({
              subscription_plan: safePlanNameForProfile(plan.name),
              subscription_status: status,
              subscription_ends_at: periodEnd.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);

          if (profileUpdateError) {
            logger.error('Error updating profile in subscription update:', profileUpdateError);
          } else {
            logger.info('Profile updated successfully for subscription:', stripe_subscription_id);
          }

          logger.info('New subscription created from webhook:', stripe_subscription_id);
        }
      }
    }

    logger.info('Subscription updated:', stripe_subscription_id);
  } catch (error) {
    logger.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionCancel(subscription) {
  try {
    const { id: stripe_subscription_id } = subscription;

    // Get the subscription to find the user
    const { data: existingSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', stripe_subscription_id)
      .single();

    // Update subscription status
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', stripe_subscription_id);

    // Update user's profile back to free plan
    if (existingSubscription?.user_id) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_plan: 'free',
          subscription_status: 'inactive',
          subscription_ends_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.user_id);

      if (profileUpdateError) {
        logger.error('Error updating profile on subscription cancel:', profileUpdateError);
      } else {
        logger.info('Profile updated to free plan for user:', existingSubscription.user_id);
      }

      // Clear user's subscription cache
      await invalidateCache(existingSubscription.user_id, `subscriptions:${existingSubscription.user_id}`);
      await invalidateCache(existingSubscription.user_id, `user_subscription:${existingSubscription.user_id}`);
    }

    logger.info('Subscription canceled:', stripe_subscription_id);
  } catch (error) {
    logger.error('Error handling subscription cancel:', error);
  }
}

async function handleInvoicePayment(invoice) {
  try {
    const { subscription: stripe_subscription_id, total, customer: stripe_customer_id } = invoice;

    // Get the internal subscription ID and user ID
    const { data: subscriptionData } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id')
      .eq('stripe_subscription_id', stripe_subscription_id)
      .single();

    if (!subscriptionData) {
      logger.warn('Subscription not found for invoice:', stripe_subscription_id);
      return;
    }

    // Create invoice record
    const { error: invoiceError } = await supabaseAdmin
      .from('subscription_invoices')
      .insert({
        subscription_id: subscriptionData.id,
        user_id: subscriptionData.user_id,
        amount_due: total / 100, // Convert from cents to dollars
        amount_paid: total / 100,
        currency: invoice.currency || 'usd',
        status: 'paid',
        stripe_invoice_id: invoice.id,
        period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
        period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
        created_at: new Date().toISOString()
      });

    if (invoiceError) {
      logger.error('Error creating invoice record:', invoiceError);
    } else {
      logger.info('Invoice payment processed successfully:', invoice.id);
    }
  } catch (error) {
    logger.error('Error handling invoice payment:', error);
  }
}

module.exports = router;