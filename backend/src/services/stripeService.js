const Stripe = require('stripe');
const config = require('../config/config.js');
const supabaseAdmin = require('../db/supabase/admin.js');
const logger = require('../config/logger.js');

// Use admin client for service operations
const supabase = supabaseAdmin;

// Initialize Stripe with secret key
const stripe = new Stripe(config.stripe.secretKey);

class StripeService {
  /**
   * Create a Stripe customer
   * @param {Object} customerData - Customer information
   * @returns {Promise<Object>} Stripe customer object
   */
  async createCustomer(customerData) {
    try {
      const customer = await stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        metadata: {
          userId: customerData.userId
        }
      });
      
      logger.info('Stripe customer created:', customer.id);
      return customer;
    } catch (error) {
      logger.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Create a checkout session for subscription
   * @param {Object} sessionData - Checkout session data
   * @returns {Promise<Object>} Stripe checkout session
   */
  async createCheckoutSession(sessionData) {
    try {
      const { userId, planId, priceId, successUrl, cancelUrl } = sessionData;
      
      // Get user profile for email (do this first)
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', userId)
        .single();
      
      // Get or create customer
      let customer = await this.getCustomerByUserId(userId);
      if (!customer && profile) {
        try {
          customer = await this.createCustomer({
            email: profile.email,
            name: profile.name,
            userId: userId
          });
        } catch (customerError) {
          logger.warn('Failed to create customer, will use customer_email instead:', customerError.message);
          // Continue without customer - will use customer_email below
        }
      }

      const sessionConfig = {
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          metadata: {
            userId: userId,
            planId: planId
          }
        }
      };

      // Add customer and customer_update only if customer exists
      if (customer?.id) {
        sessionConfig.customer = customer.id;
        sessionConfig.customer_update = {
          name: 'never', // Prevent name changes
          address: 'auto' // Allow address updates
        };
      } else if (profile?.email) {
        // If no customer but we have profile email, use customer_email
        sessionConfig.customer_email = profile.email;
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      logger.info('Checkout session created:', session.id);
      return session;
    } catch (error) {
      logger.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Get customer by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Stripe customer or null
   */
  async getCustomerByUserId(userId) {
    try {
      const customers = await stripe.customers.list({
        limit: 1,
        metadata: {
          userId: userId
        }
      });
      
      return customers.data.length > 0 ? customers.data[0] : null;
    } catch (error) {
      logger.error('Error getting customer by user ID:', error);
      return null;
    }
  }

  /**
   * Get subscription by Stripe subscription ID
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Stripe subscription
   */
  async getSubscription(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      logger.error('Error getting subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Canceled subscription
   */
  async cancelSubscription(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
      
      logger.info('Subscription canceled:', subscriptionId);
      return subscription;
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Immediately cancel a subscription
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Canceled subscription
   */
  async cancelSubscriptionImmediately(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.cancel(subscriptionId);
      
      logger.info('Subscription canceled immediately:', subscriptionId);
      return subscription;
    } catch (error) {
      logger.error('Error canceling subscription immediately:', error);
      throw error;
    }
  }

  /**
   * Create a billing portal session
   * @param {string} customerId - Stripe customer ID
   * @param {string} returnUrl - Return URL after portal session
   * @returns {Promise<Object>} Billing portal session
   */
  async createBillingPortalSession(customerId, returnUrl) {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      
      logger.info('Billing portal session created:', session.id);
      return session;
    } catch (error) {
      logger.error('Error creating billing portal session:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   * @param {string} payload - Raw request body
   * @param {string} signature - Stripe signature header
   * @param {string} endpointSecret - Webhook endpoint secret
   * @returns {Object} Verified event
   */
  verifyWebhookSignature(payload, signature, endpointSecret) {
    try {
      const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
      return event;
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      throw error;
    }
  }

  /**
   * Get all prices for a product
   * @param {string} productId - Stripe product ID
   * @returns {Promise<Array>} Array of prices
   */
  async getPricesForProduct(productId) {
    try {
      const prices = await stripe.prices.list({
        product: productId,
        active: true
      });
      
      return prices.data;
    } catch (error) {
      logger.error('Error getting prices for product:', error);
      throw error;
    }
  }

  /**
   * Get customer's payment methods
   * @param {string} customerId - Stripe customer ID
   * @returns {Promise<Array>} Array of payment methods
   */
  async getCustomerPaymentMethods(customerId) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });
      
      return paymentMethods.data;
    } catch (error) {
      logger.error('Error getting customer payment methods:', error);
      throw error;
    }
  }

  /**
   * Update subscription
   * @param {string} subscriptionId - Stripe subscription ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated subscription
   */
  async updateSubscription(subscriptionId, updateData) {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, updateData);
      
      logger.info('Subscription updated:', subscriptionId);
      return subscription;
    } catch (error) {
      logger.error('Error updating subscription:', error);
      throw error;
    }
  }
}

module.exports = new StripeService();