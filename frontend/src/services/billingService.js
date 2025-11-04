import { apiClient } from '../utils/apiClient';

class BillingService {
  // Create checkout session
  async createCheckoutSession(planId) {
    if (!planId) {
      throw new Error('Plan ID is required');
    }
    
    return apiClient.post('/api/subscriptions/create-checkout-session', 
      { planId },
      { context: 'Create checkout session' }
    );
  }

  // Process checkout success - Hybrid approach
  async processCheckoutSuccess(sessionId, planId) {
    try {
      // Check if we're in development mode (using Stripe CLI webhooks)
      const isDevelopment = process.env.NODE_ENV === 'development' || 
                           window.location.hostname === 'localhost' ||
                           window.location.hostname === '127.0.0.1';

      if (isDevelopment) {
        // For development, use the test endpoint that simulates webhook processing
        console.log('Development mode: Using test webhook endpoint');
        const response = await apiClient.post('/api/subscriptions/process-real-session', {
          session_id: sessionId,
          planId: planId
        });
        return response.success ? response.data : response;
      } else {
        // For production, just return success - real webhook will handle the rest
        console.log('Production mode: Real Stripe webhook will process payment');
        return {
          success: true,
          message: 'Payment processed successfully. Your subscription will be activated shortly.',
          session_id: sessionId,
          plan_id: planId
        };
      }
    } catch (error) {
      console.error('Error processing checkout success:', error);
      throw error;
    }
  }

  // Create billing portal session
  async createBillingPortalSession() {
    return apiClient.post('/api/subscriptions/create-billing-portal', 
      null,
      { context: 'Create billing portal session' }
    );
  }

  // Cancel subscription
  async cancelSubscription(immediate = false) {
    try {
      const response = await apiClient.post('/api/subscriptions/cancel-subscription', {
        immediate
      });
      return response.success ? response.data : response;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  // Get user subscription
  async getUserSubscription() {
    try {
      const response = await apiClient.get('/api/subscriptions/user/subscription');
      return response.success ? response.data : response;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      throw error;
    }
  }

  // Get all subscriptions
  async getSubscriptions() {
    return apiClient.get('/api/subscriptions', {
      context: 'Get subscriptions'
    });
  }

  // Update user subscription plan
  async updateSubscriptionPlan(plan) {
    if (!plan) {
      throw new Error('Plan is required');
    }
    
    return apiClient.post('/api/subscriptions/user/subscription', 
      { plan },
      { context: 'Update subscription plan' }
    );
  }

  // Test webhook endpoint (development only)
  async testWebhook(sessionId, userId, planId) {
    if (!sessionId || !userId || !planId) {
      throw new Error('Session ID, User ID, and Plan ID are required');
    }
    
    return apiClient.post('/api/subscriptions/test-webhook', 
      { sessionId, userId, planId },
      { context: 'Test webhook' }
    );
  }

}

export default new BillingService();
