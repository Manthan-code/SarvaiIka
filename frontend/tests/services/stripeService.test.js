import stripeService from '../../src/services/stripeService';
import apiClient from '../../src/utils/apiClient';

describe('stripeService', () => {
  beforeEach(() => {
    (apiClient.post as jest.Mock).mockClear();
    (apiClient.get as jest.Mock).mockClear();
    delete (window as any).location;
    (window as any).location = { href: '' } as any;
  });

  it('createCheckoutSession posts planId', async () => {
    await stripeService.createCheckoutSession('pro');
    expect((apiClient.post as jest.Mock)).toHaveBeenCalledWith('/api/subscriptions/create-checkout-session', { planId: 'pro' });
  });

  it('createBillingPortalSession posts to endpoint', async () => {
    await stripeService.createBillingPortalSession();
    expect((apiClient.post as jest.Mock)).toHaveBeenCalledWith('/api/subscriptions/create-billing-portal');
  });

  it('cancelSubscription posts immediate flag', async () => {
    await stripeService.cancelSubscription(true);
    expect((apiClient.post as jest.Mock)).toHaveBeenCalledWith('/api/subscriptions/cancel-subscription', { immediate: true });
  });

  it('redirectToCheckout sets window.location.href', () => {
    stripeService.redirectToCheckout('https://checkout');
    expect(window.location.href).toBe('https://checkout');
  });

  it('redirectToBillingPortal sets window.location.href', () => {
    stripeService.redirectToBillingPortal('https://portal');
    expect(window.location.href).toBe('https://portal');
  });

  it('getSubscriptionExpiry calls endpoint', async () => {
    await stripeService.getSubscriptionExpiry();
    expect((apiClient.get as jest.Mock)).toHaveBeenCalledWith('/api/subscriptions/expiry');
  });

  it('checkSubscriptionExpiry posts to endpoint', async () => {
    await stripeService.checkSubscriptionExpiry();
    expect((apiClient.post as jest.Mock)).toHaveBeenCalledWith('/api/subscriptions/check-expiry');
  });
});