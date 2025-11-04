const supabase = require('../db/supabase/client.js');
const logger = require('../config/logger.js');
const { invalidateCache } = require('../utils/cache.js');

/**
 * Service to handle subscription expiration logic
 */
class SubscriptionExpirationService {
  /**
   * Check and handle expired subscriptions
   */
  static async checkExpiredSubscriptions() {
    try {
      logger.info('Starting subscription expiration check...');
      
      const now = new Date();
      
      // Find all active subscriptions that have expired
      const { data: expiredSubscriptions, error } = await supabase
        .from('subscriptions')
        .select(`
          id,
          user_id,
          current_period_end,
          stripe_subscription_id,
          plans (
            name
          )
        `)
        .eq('status', 'active')
        .lt('current_period_end', now.toISOString());
      
      if (error) {
        logger.error('Error fetching expired subscriptions:', error);
        return;
      }
      
      if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
        logger.info('No expired subscriptions found');
        return;
      }
      
      logger.info(`Found ${expiredSubscriptions.length} expired subscriptions`);
      
      // Process each expired subscription
      for (const subscription of expiredSubscriptions) {
        await this.handleExpiredSubscription(subscription);
      }
      
      logger.info('Subscription expiration check completed');
    } catch (error) {
      logger.error('Error in subscription expiration check:', error);
    }
  }
  
  /**
   * Handle a single expired subscription
   */
  static async handleExpiredSubscription(subscription) {
    try {
      const { id, user_id, stripe_subscription_id, plans } = subscription;
      
      logger.info(`Processing expired subscription: ${id} for user: ${user_id}`);
      
      // Update subscription status to expired
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (updateError) {
        logger.error(`Error updating expired subscription ${id}:`, updateError);
        return;
      }
      
      // Update user's profile to free plan and reset role to user
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          subscription_plan: 'free',
          subscription_status: 'inactive',
          subscription_ends_at: null,
          role: 'user',
          updated_at: new Date().toISOString()
        })
        .eq('id', user_id);
      
      if (profileError) {
        logger.error(`Error updating user profile ${user_id}:`, profileError);
      }
      
      // Clear user's subscription cache
      await invalidateCache(user_id, `subscriptions:${user_id}`);
      await invalidateCache(user_id, `user_subscription:${user_id}`);
      
      logger.info(`Successfully processed expired subscription ${id} - user ${user_id} downgraded to free plan and role reset to user`);
      
    } catch (error) {
      logger.error(`Error handling expired subscription ${subscription.id}:`, error);
    }
  }
  
  /**
   * Check if a specific user's subscription has expired
   */
  static async checkUserSubscriptionExpiry(userId) {
    try {
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('id, current_period_end, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
      
      if (error || !subscription) {
        return false; // No active subscription
      }
      
      const now = new Date();
      const expiryDate = new Date(subscription.current_period_end);
      
      if (expiryDate <= now) {
        // Subscription has expired, handle it
        await this.handleExpiredSubscription({
          id: subscription.id,
          user_id: userId,
          current_period_end: subscription.current_period_end
        });
        return true; // Was expired and handled
      }
      
      return false; // Not expired
    } catch (error) {
      logger.error(`Error checking user subscription expiry for ${userId}:`, error);
      return false;
    }
  }
  
  /**
   * Get subscription expiry information for a user
   */
  static async getUserSubscriptionExpiry(userId) {
    try {
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select(`
          id,
          current_period_end,
          status,
          plans (
            name
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
      
      if (error || !subscription) {
        return null;
      }
      
      const now = new Date();
      const expiryDate = new Date(subscription.current_period_end);
      const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
      
      return {
        subscriptionId: subscription.id,
        expiryDate: subscription.current_period_end,
        daysUntilExpiry,
        isExpired: expiryDate <= now,
        planName: subscription.plans?.name
      };
    } catch (error) {
      logger.error(`Error getting user subscription expiry for ${userId}:`, error);
      return null;
    }
  }
  
  /**
   * Start the subscription expiration checker (runs every hour)
   */
  static startExpirationChecker() {
    // Run immediately
    this.checkExpiredSubscriptions();
    
    // Then run every hour
    const intervalId = setInterval(() => {
      this.checkExpiredSubscriptions();
    }, 60 * 60 * 1000); // 1 hour
    
    logger.info('Subscription expiration checker started (runs every hour)');
    
    return intervalId;
  }
}

module.exports = SubscriptionExpirationService;