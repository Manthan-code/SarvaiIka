import { apiClient } from '../utils/apiClient';

const stripeService = {
  /**
   * Create a Stripe checkout session for subscription
   * @param {string} planId - The plan ID to subscribe to
   * @returns {Promise} Checkout session response with URL
   */
  createCheckoutSession: async (planId) => {
    try {
      const response = await apiClient.post('/api/subscriptions/create-checkout-session', {
        planId
      });
      return response.success ? response.data : response;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  },

  /**
   * Create a billing portal session for subscription management
   * @returns {Promise} Billing portal session response with URL
   */
  createBillingPortalSession: async () => {
    try {
      const response = await apiClient.post('/api/subscriptions/create-billing-portal');
      return response.success ? response.data : response;
    } catch (error) {
      console.error('Error creating billing portal session:', error);
      throw error;
    }
  },

  /**
   * Cancel subscription
   * @param {boolean} immediate - Whether to cancel immediately or at period end
   * @returns {Promise} Cancellation response
   */
  cancelSubscription: async (immediate = false) => {
    try {
      const response = await apiClient.post('/api/subscriptions/cancel-subscription', {
        immediate
      });
      return response.success ? response.data : response;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  },

  /**
   * Redirect to Stripe checkout
   * @param {string} checkoutUrl - The Stripe checkout URL
   */
  redirectToCheckout: (checkoutUrl) => {
    window.location.href = checkoutUrl;
  },

  /**
   * Redirect to billing portal
   * @param {string} portalUrl - The Stripe billing portal URL
   */
  redirectToBillingPortal: (portalUrl) => {
    window.location.href = portalUrl;
  },

  /**
   * Get subscription expiry information
   * @returns {Promise} Subscription expiry response
   */
  getSubscriptionExpiry: async () => {
    try {
      const response = await apiClient.get('/api/subscriptions/expiry');
      return response.success ? response.data : response;
    } catch (error) {
      console.error('Error getting subscription expiry:', error);
      throw error;
    }
  },

  /**
   * Check and handle subscription expiry
   * @returns {Promise} Subscription expiry check response
   */
  checkSubscriptionExpiry: async () => {
    try {
      const response = await apiClient.post('/api/subscriptions/check-expiry');
      return response.success ? response.data : response;
    } catch (error) {
      console.error('Error checking subscription expiry:', error);
      throw error;
    }
  }
};

export default stripeService;