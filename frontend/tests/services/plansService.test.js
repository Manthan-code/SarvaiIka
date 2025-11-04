import plansService from '../../src/services/plansService';
import apiClient from '../../src/utils/apiClient';

describe('plansService', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockClear();
  });

  it('getPlans calls /api/plans', async () => {
    await plansService.getPlans();
    expect((apiClient.get as jest.Mock)).toHaveBeenCalledWith('/api/plans');
  });
});