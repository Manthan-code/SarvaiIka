import subscriptionsService from '../../src/services/subscriptionsService';
import apiClient from '../../src/utils/apiClient';

describe('subscriptionsService', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockClear();
    (apiClient.post as jest.Mock).mockClear();
    (apiClient.delete as jest.Mock).mockClear();
  });

  test('getSubscriptions builds query params', async () => {
    await subscriptionsService.getSubscriptions({ limit: 5, offset: 10 });
    expect((apiClient.get as jest.Mock)).toHaveBeenCalledWith('/api/subscriptions?limit=5&offset=10');
  });

  test('createSubscription posts payload to /api/subscriptions', async () => {
    const payload = { planId: 'pro' } as any;
    await subscriptionsService.createSubscription(payload);
    expect((apiClient.post as jest.Mock)).toHaveBeenCalledWith('/api/subscriptions', payload);
  });

  test('deleteSubscription calls correct endpoint', async () => {
    await subscriptionsService.deleteSubscription('sub-123');
    expect((apiClient.delete as jest.Mock)).toHaveBeenCalledWith('/api/subscriptions/sub-123');
  });

  test('getCurrentUserSubscription calls user endpoint', async () => {
    await subscriptionsService.getCurrentUserSubscription();
    expect((apiClient.get as jest.Mock)).toHaveBeenCalledWith('/api/subscriptions/user/subscription');
  });

  test('updateUserSubscription posts plan payload', async () => {
    await subscriptionsService.updateUserSubscription('plus');
    expect((apiClient.post as jest.Mock)).toHaveBeenCalledWith('/api/subscriptions/user/subscription', { plan: 'plus' });
  });
});