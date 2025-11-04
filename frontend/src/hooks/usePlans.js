import { useQuery } from 'react-query';
import plansService from '../services/plansService';

export const usePlans = () => {
    const { data, isLoading, error } = useQuery('plans', plansService.getPlans);

    return {
        plans: data,
        isLoading,
        error,
    };
};
