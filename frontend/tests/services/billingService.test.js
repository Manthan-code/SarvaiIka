import billingService from '../../src/services/billingService';
import apiClient from '../../src/utils/apiClient';

describe('billingService', () => {
  beforeEach(() => {
    (apiClient.post as jest.Mock).mockClear();
    (apiClient.get as jest.Mock).mockClear();
    (apiClient.put as jest.Mock).mockClear();
    Object.defineProperty(window, 'location', { value: { hostname: 'localhost' }, writable: true });
    process.env.NODE_ENV = 'development';
  });

  it('createCheckoutSession posts planId with context', async () => {
    await billingService.createCheckoutSession('pro');
    expect((apiClient.post as jest.Mock)).toHaveBeenCalledWith(
      '/api/subscriptions/create-checkout-session',
      { planId: 'pro' },
      { context: 'Create checkout session' }
    );
  });

  it('processCheckoutSuccess uses test endpoint in development', async () => {
    await billingService.processCheckoutSuccess('sess123', 'pro');
    expect((apiClient.post as jest.Mock)).toHaveBeenCalledWith('/api/subscriptions/process-real-session', {
      session_id: 'sess123',
      planId: 'pro'
    });
  });

  it('createBillingPortalSession posts with context', async () => {
    await billingService.createBillingPortalSession();
    expect((apiClient.post as jest.Mock)).toHaveBeenCalledWith(
      '/api/subscriptions/create-billing-portal',
      null,
      { context: 'Create billing portal session' }
    );
  });

  it('cancelSubscription posts immediate flag', async () => {
    await billingService.cancelSubscription(false);
    expect((apiClient.post as jest.Mock)).toHaveBeenCalledWith('/api/subscriptions/cancel-subscription', { immediate: false });
  });

  it('getUserSubscription GETs user subscription', async () => {
    await billingService.getUserSubscription();
    expect((apiClient.get as jest.Mock)).toHaveBeenCalledWith('/api/subscriptions/user/subscription');
  });

  it('getSubscriptions GETs subscriptions with context', async () => {
    await billingService.getSubscriptions();
    expect((apiClient.get as jest.Mock)).toHaveBeenCalledWith('/api/subscriptions', { context: 'Get subscriptions' });
  });

  it('updateSubscriptionPlan posts with plan and context', async () => {
    await billingService.updateSubscriptionPlan('plus');
    expect((apiClient.post as jest.Mock)).toHaveBeenCalledWith(
      '/api/subscriptions/user/subscription',
      { plan: 'plus' },
      { context: 'Update subscription plan' }
    );
  });

  it('testWebhook posts payload with context', async () => {
    await billingService.testWebhook('sess1', 'user1', 'pro');
    expect((apiClient.post as jest.Mock)).toHaveBeenCalledWith(
      '/api/subscriptions/test-webhook',
      { sessionId: 'sess1', userId: 'user1', planId: 'pro' },
      { context: 'Test webhook' }
    );
  });
});