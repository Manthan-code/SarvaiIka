import { apiClient } from '../utils/apiClient';

const plansService = {
    getPlans: () => apiClient.get('/api/plans'),
};

export default plansService;
