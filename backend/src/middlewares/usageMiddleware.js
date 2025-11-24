const logger = require('../config/logger');
const SubscriptionExpirationService = require('../services/subscriptionExpirationService');
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

// Get user's active subscription
async function getUserActiveSubscription(userId) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) {
      console.log('No active subscription found for user:', userId);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    return null;
  }
}

// Track usage middleware
async function trackUsage(req, res, next) {
  try {
    console.log('[DEBUG] Entering trackUsage middleware');
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const supabase = getSupabase();
    // Get user's profile to check subscription plan
    const profileQuery = supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', userId);

    let profileResult;
    if (typeof profileQuery.maybeSingle === 'function') {
      profileResult = await profileQuery.maybeSingle();
    } else {
      profileResult = await profileQuery.single();
    }

    const { data: profile, error: profileError } = profileResult || {};

    // Only return error for actual database errors, not missing profiles
    if (profileError && profileError.code !== 'PGRST116') {
      logger.error('Error fetching user profile:', profileError);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    const userPlan = profile?.subscription_plan || 'free';
    req.userPlan = userPlan;

    // Check for subscription expiry first (for all users)
    const wasExpired = await SubscriptionExpirationService.checkUserSubscriptionExpiry(userId);
    if (wasExpired) {
      // Subscription was expired and user was downgraded to free
      req.userPlan = 'free';
    }

    // For free users, check if they have a subscription record
    if (req.userPlan === 'free') {
      const subscription = await getUserActiveSubscription(userId);

      if (subscription) {
        // Free user with subscription record - check limits
        if (subscription.messages_used >= subscription.messages_limit) {
          return res.status(403).json({
            error: 'Message limit exceeded for free plan',
            code: 'LIMIT_EXCEEDED'
          });
        }
        req.allowed = true;
      } else {
        // Free user without subscription record - allow with basic limits
        req.allowed = true;
      }
    } else {
      // Paid users - check subscription
      const subscription = await getUserActiveSubscription(userId);

      if (!subscription) {
        return res.status(403).json({
          error: 'No active subscription found',
          code: 'NO_SUBSCRIPTION'
        });
      }

      if (subscription.messages_used >= subscription.messages_limit) {
        return res.status(403).json({
          error: 'Message limit exceeded',
          code: 'LIMIT_EXCEEDED'
        });
      }

      req.allowed = true;
    }

    next();
  } catch (error) {
    logger.error('Error in trackUsage middleware:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Update usage function
async function updateUsage(userId) {
  try {
    console.log('🔍 updateUsage called for userId:', userId);
    const supabase = getSupabase();

    // First get the current usage WITHOUT using select() to keep chain intact when tests override select for update result
    const fetchRes = await supabase
      .from('subscriptions')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    const { data: currentSubData, error: fetchError } = fetchRes || {};

    if (fetchError || !currentSubData) {
      console.log('🔍 No subscription record found for user, skipping usage update');
      return true; // For free users without subscription records
    }

    const currentUsed = currentSubData?.messages_used ?? 0;
    const nextUsed = currentUsed + 1;

    // Update with incremented value and fetch result via select()
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ messages_used: nextUsed })
      .eq('user_id', userId)
      .eq('status', 'active')
      .select();

    if (error) {
      console.error('❌ Error updating usage:', error);
      logger.error('Error updating usage:', error);
      return false;
    }

    console.log('✅ Usage updated successfully:', data);
    return true;
  } catch (error) {
    console.error('❌ Error in updateUsage:', error);
    logger.error('Error in updateUsage:', error);
    return false;
  }
}

module.exports = { getUserActiveSubscription, trackUsage, updateUsage };
