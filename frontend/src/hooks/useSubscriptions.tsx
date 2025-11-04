import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import subscriptionsService from '../services/subscriptionsService';
import plansService from '../services/plansService';
import { useToast } from './use-toast';
import { useAuthStore } from '../stores/authStore';
import type { CreateSubscriptionResponse, UpdateUserSubscriptionResponse } from '../types/subscription';
import {
    getCachedSubscription,
    setCachedSubscription,
    clearCachedSubscription,
    getCachedPlans,
    setCachedPlans,
    getSubscriptionCacheFirst,
    cacheSubscriptionFromDB,
    invalidateSubscriptionCache,
    hasValidSubscriptionCache
} from '../lib/localStorageUtils';

export const useSubscriptions = () => {
    const [subscriptions, setSubscriptions] = useState(null);
    const [plans, setPlans] = useState(null);
    const [userSubscription, setUserSubscription] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();
    const { session } = useAuthStore();
    const queryClient = useQueryClient();
    
    // Add a ref to track if component is mounted
    const isMountedRef = useRef(true);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    /**
     * Load user subscription with cache-first strategy
     * Only fetches from DB on login or when explicitly requested (forceRefresh)
     */
    const loadUserSubscription = useCallback(async (forceRefresh = false) => {
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated()) {
            setUserSubscription(null);
            return;
        }

        try {
            // Use cache-first strategy
            const cachedSubscription = getSubscriptionCacheFirst();
            
            if (cachedSubscription && !forceRefresh) {
                // Cache hit and no force refresh - use cached data only
                setUserSubscription(cachedSubscription);
                setIsLoading(false);
                return;
            }

            // Cache miss or force refresh - fetch from DB
            if (!cachedSubscription) {
                setIsLoading(true);
                console.log('No subscription cache found - fetching from DB');
            } else if (forceRefresh) {
                setIsBackgroundRefreshing(true);
                console.log('Force refresh requested - fetching from DB');
            }

            const response = await subscriptionsService.getCurrentUserSubscription();
            
            if (isMountedRef.current && response) {
                const subscriptionData = response;
                
                if (subscriptionData && (subscriptionData.plan || subscriptionData.plan_details)) {
                    const cacheData = {
                        id: subscriptionData.id || 'user-subscription',
                        plan: subscriptionData.plan || subscriptionData.plan_details?.name,
                        plan_details: subscriptionData.plan_details || {
                            name: subscriptionData.plan,
                            features: [],
                            price: 0,
                        },
                        status: subscriptionData.status || 'active',
                        current_period_end: subscriptionData.current_period_end,
                        cancel_at_period_end: subscriptionData.cancel_at_period_end || false,
                        updated_at: new Date().toISOString(),
                    };
                    
                    setUserSubscription(cacheData);
                    cacheSubscriptionFromDB(cacheData);
                } else if (subscriptionData.user && subscriptionData.user.subscription_plan) {
                    const cacheData = {
                        id: 'user-subscription',
                        plan: subscriptionData.user.subscription_plan,
                        plan_details: {
                            name: subscriptionData.user.subscription_plan,
                            features: [],
                            price: 0,
                        },
                        status: 'active',
                        current_period_end: null,
                        cancel_at_period_end: false,
                        updated_at: new Date().toISOString(),
                    };
                    
                    setUserSubscription(cacheData);
                    cacheSubscriptionFromDB(cacheData);
                }
            }
        } catch (error) {
            if (isMountedRef.current) {
                console.error('Error loading user subscription:', error);
                setError(error instanceof Error ? error.message : 'Failed to load subscription');
                
                // Always fallback to cached data on error
                const cachedSubscription = getSubscriptionCacheFirst();
                if (cachedSubscription) {
                    setUserSubscription(cachedSubscription);
                }
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
                setIsBackgroundRefreshing(false);
            }
        }
    }, []); // Remove session from dependency array to prevent re-creation

    /**
     * Load plans with localStorage-first strategy
     */
    const loadPlans = useCallback(async (forceRefresh = false) => {
        try {
            // ALWAYS show cached plans first for instant UI (if available)
            const cachedPlans = getCachedPlans();
            if (cachedPlans && cachedPlans.length > 0) {
                setPlans(cachedPlans);
                
                // If not forcing refresh, return early - use localStorage data only
                if (!forceRefresh) {
                    return;
                }
            }

            // Only fetch from API if:
            // 1. No cached data exists (new user/first login after logout)
            // 2. forceRefresh is explicitly requested
            if (!cachedPlans || cachedPlans.length === 0 || forceRefresh) {
                const response = await plansService.getPlans();
                if (response && response.success && response.data && response.data.length > 0) {
                    setPlans(response.data);
                    setCachedPlans(response.data);
                }
            }
        } catch (error) {
            console.error('Error loading plans:', error);
            // Always fallback to cached plans on error
            const cachedPlans = getCachedPlans();
            if (cachedPlans && cachedPlans.length > 0) {
                setPlans(cachedPlans);
            }
        }
    }, []);

    /**
     * Load subscriptions (if needed)
     */
    const loadSubscriptions = useCallback(async () => {
        try {
            const response = await subscriptionsService.getSubscriptions();
            setSubscriptions(response);
        } catch (error) {
            console.error('Error fetching subscriptions:', error);
            setError(error instanceof Error ? error.message : 'Failed to load subscriptions');
        }
    }, []);

    // Mutations
    const createSubscription = useMutation({
        mutationFn: subscriptionsService.createSubscription,
        onSuccess: (response: CreateSubscriptionResponse) => {
            // Update localStorage with new subscription data
            if (response && response.subscription) {
                // Transform Subscription to CachedSubscription format
                const cacheData = {
                    id: response.subscription.id || 'user-subscription',
                    plan_details: response.subscription.plan_details || {
                        name: response.subscription.plan || 'free',
                        features: [],
                        price: 0,
                    },
                    status: response.subscription.status || 'active',
                    current_period_end: response.subscription.current_period_end,
                    updated_at: new Date().toISOString(),
                };
                
                cacheSubscriptionFromDB(cacheData);
                setUserSubscription(cacheData);
            } else {
                // Force refresh to get latest data
                loadUserSubscription(true);
            }
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        },
    });

    const deleteSubscription = useMutation({
        mutationFn: subscriptionsService.deleteSubscription,
        onSuccess: () => {
            // Clear subscription from localStorage and state
            invalidateSubscriptionCache();
            setUserSubscription(null);
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        },
    });

    const updateUserSubscription = useMutation({
        mutationFn: (plan: string) => subscriptionsService.updateUserSubscription(plan),
        onSuccess: (response: UpdateUserSubscriptionResponse, plan: string) => {
            // Force refresh to get latest data since this endpoint doesn't return subscription object
            loadUserSubscription(true);
            
            toast({
                title: "Subscription Updated",
                description: response.message || `Successfully updated to ${response.plan || plan} plan`,
                variant: "default",
            });
        },
        onError: (error) => {
            console.error('Subscription update failed:', error);
            toast({
                title: "Update Failed",
                description: error.message || "Failed to update subscription",
                variant: "destructive",
            });
        },
    });

    // Extract user ID to make dependency more stable - use a ref to track the actual value
    const userIdRef = useRef(session?.user?.id);
    const currentUserId = session?.user?.id;
    
    // Only update the ref if the user ID actually changed
    if (userIdRef.current !== currentUserId) {
        userIdRef.current = currentUserId;
    }
    
    // Load user subscription and plans when authenticated
    useEffect(() => {
        const { isAuthenticated } = useAuthStore.getState();
        const isAuth = isAuthenticated();
        const userId = userIdRef.current;
        
        if (userId && isAuth) {
            loadUserSubscription();
            loadPlans();
        } else {
            // Clear subscription data when not authenticated
            setUserSubscription(null);
            setError(null);
        }
    }, [userIdRef.current, loadUserSubscription, loadPlans]); // Use stable ref value and include memoized functions

    return {
        // Data
        subscriptions,
        plans,
        userSubscription,
        subscription: userSubscription, // Alias for backward compatibility
        
        // Loading states
        isLoading,
        isBackgroundRefreshing,
        
        // Error state
        error,
        
        // Mutations
        createSubscription: createSubscription.mutate,
        deleteSubscription: deleteSubscription.mutate,
        updateUserSubscription: updateUserSubscription.mutate,
        
        // Mutation states
        isCreatingSubscription: createSubscription.isPending,
        isUpdatingUserSubscription: updateUserSubscription.isPending,
        isDeletingSubscription: deleteSubscription.isPending,
        
        // Refetch functions
        refetchUserSubscription: useCallback(() => loadUserSubscription(true), [loadUserSubscription]),
        refetchPlans: loadPlans,
        refetchSubscriptions: loadSubscriptions,
    };
};
