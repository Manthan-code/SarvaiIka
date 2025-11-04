import { apiClient } from '../utils/apiClient';
import type { 
  CreateSubscriptionResponse, 
  UpdateUserSubscriptionResponse,
  Subscription 
} from '../types/subscription';

interface GetSubscriptionsParams {
  limit?: number;
  offset?: number;
}

const subscriptionsService = {
    getSubscriptions: (params?: GetSubscriptionsParams) => {
        const queryParams = new URLSearchParams();
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.offset) queryParams.append('offset', params.offset.toString());
        
        const url = `/api/subscriptions${queryParams.toString() ? `?${queryParams}` : ''}`;
        return apiClient.get<Subscription[]>(url);
    },
    createSubscription: (data: any) => apiClient.post<CreateSubscriptionResponse>('/api/subscriptions', data),
    deleteSubscription: (id: string) => apiClient.delete(`/api/subscriptions/${id}`),
    
    // User subscription management
    getCurrentUserSubscription: () => apiClient.get<Subscription>('/api/subscriptions/user/subscription'),
    updateUserSubscription: (plan: string) => apiClient.post<UpdateUserSubscriptionResponse>('/api/subscriptions/user/subscription', { plan }),
};

export default subscriptionsService;
