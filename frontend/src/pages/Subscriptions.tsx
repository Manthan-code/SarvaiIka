import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSubscriptions } from '../hooks/useSubscriptions';
import billingService from '../services/billingService';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';
import { useTheme } from '../hooks/useTheme';
import { Loader2, Check, Crown, Zap, Star } from 'lucide-react';
import { Subscription, Plan } from '../types/subscription';
import { safePlanName, comparePlans, getPlanOrder, capitalizePlanName } from '../utils/planUtils';

const Subscriptions: React.FC = () => {
  const { user, session } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  
  // Use the optimized useSubscriptions hook
  const {
    userSubscription: subscription,
    plans,
    isLoading: subscriptionsLoading,
    refetchUserSubscription,
    refetchPlans
  } = useSubscriptions();

  // Handle ESC key to go back
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        navigate(-1); // Go back to previous page
      }
    };

    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [navigate]);
  const [currentPlan, setCurrentPlan] = useState<string>('free');

  useEffect(() => {
    const initializeData = async () => {
      if (!user) {
        navigate('/login');
        return;
      }
      
      // Set current plan from subscription data (handled by useSubscriptions hook)
      if (subscription?.plan_details?.name) {
        setCurrentPlan(safePlanName(subscription.plan_details.name));
      } else if (subscription?.plan) {
        setCurrentPlan(safePlanName(subscription.plan));
      } else {
        setCurrentPlan('free');
      }
      
    };

    initializeData();
  }, [subscription, navigate, user]);

  // Handle Stripe redirect parameters
  useEffect(() => {
    const success = searchParams.get('success');
    const sessionId = searchParams.get('session_id');
    const canceled = searchParams.get('canceled');

    if (success === 'true' && sessionId) {
      handleCheckoutSuccess(sessionId);
    } else if (canceled === 'true') {
      toast({
        title: "Payment Canceled",
        description: "Your payment was canceled. You can try again anytime.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);





  const handleCheckoutSuccess = async (sessionId: string) => {
    try {
      setLoading(true);
      
      // Get the plan ID from the session or use a default
      // In a real implementation, you'd get this from the Stripe session
      const planId = 'plus-plan'; // This should come from the actual Stripe session
      
      console.log('Checkout success callback triggered:', { success: true, sessionId });
      
      if (user) {
        console.log('User authenticated, processing checkout success');
        
        // Use the hybrid approach - the service will handle development vs production
        const result = await billingService.processCheckoutSuccess(sessionId, planId);
        
        if (result.success) {
          toast({
            title: "Payment Successful!",
            description: result.message || "Your subscription has been activated successfully!",
          });
          
          // Refresh subscription data using the optimized hook
          await refetchUserSubscription();
          
          // Clear URL parameters
          navigate('/subscriptions', { replace: true });
        } else {
          throw new Error(result.message || 'Failed to process payment');
        }
      }
    } catch (error) {
      console.error('Error processing checkout success:', error);
      toast({
        title: "Payment Processing Error",
        description: "Your payment was successful, but there was an issue activating your subscription. Please contact support.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      setLoading(true);
      const { url } = await billingService.createBillingPortalSession();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating billing portal session:', error);
      toast({
        title: "Error",
        description: "Failed to open billing portal. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (immediate = false) => {
    try {
      setLoading(true);
      
      const result = await billingService.cancelSubscription(immediate);
        toast({
          title: "Success",
        description: result.message,
      });
      
      // Refresh subscription data using the optimized hook
      await refetchUserSubscription();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: Plan) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to subscribe to a plan.",
        variant: "destructive"
      });
      return;
    }

    if (plan.price === 0) {
      // Handle free plan upgrade
      try {
        setLoading(true);
        
        await billingService.updateSubscriptionPlan(safePlanName(plan.name));
        toast({
          title: "Success!",
          description: `You've been upgraded to the ${plan.name} plan.`,
        });
        setCurrentPlan(safePlanName(plan.name));
        
        // Refresh subscription data using the optimized hook
        await refetchUserSubscription();
      } catch (error) {
        console.error('Error upgrading to free plan:', error);
        toast({
          title: "Error",
          description: "Failed to upgrade plan. Please try again.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      
      // Create checkout session using originalId (UUID) for backend compatibility
      const planIdForCheckout = plan.originalId || plan.id;
      const { sessionId, url } = await billingService.createCheckoutSession(planIdForCheckout);
      
      if (url) {
        // Redirect to Stripe checkout
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: "Error",
        description: "Failed to create checkout session. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isCurrentPlan = (planName: string) => {
    return comparePlans(currentPlan, planName);
  };

  const isUpgrade = (planName: string) => {
    const current = getPlanOrder(currentPlan);
    const selected = getPlanOrder(planName);
    return selected > current;
  };

  const isDowngrade = (planName: string) => {
    const current = getPlanOrder(currentPlan);
    const selected = getPlanOrder(planName);
    return selected < current;
  };

  const getPlanIcon = (planName: string) => {
    switch (safePlanName(planName)) {
      case 'free':
        return <Star className="h-6 w-6 text-gray-400" />;
      case 'plus':
        return <Zap className="h-6 w-6 text-blue-500" />;
      case 'pro':
        return <Crown className="h-6 w-6 text-yellow-500" />;
      default:
        return <Star className="h-6 w-6 text-gray-400" />;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'canceled':
        return 'bg-red-100 text-red-800';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading || subscriptionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your subscription details...</p>
        </div>
      </div>
    );
  }

  return (
  <div className="min-h-screen bg-background py-16 px-6 lg:px-12">
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-20">
        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent mb-6">
          Subscription Management
        </h1>
        <p className="text-1xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Choose the perfect plan for your needs. Upgrade, downgrade, or manage
          your subscription with ease.
        </p>
      </div>

      {/* Current Subscription */}
      <Card className="mb-20 shadow-2xl border-0 rounded-2xl overflow-hidden">
        <CardHeader
          className="text-primary-foreground p-8 relative overflow-hidden 
                    bg-primary"
        >
          <CardTitle className="flex items-center text-primary-foreground text-3xl font-bold relative z-10">
            {getPlanIcon(subscription?.plan || "free")}
            <span className="ml-4">
              Current Subscription:{" "}
              {subscription?.plan_details?.name || "Free Plan"}
            </span>
          </CardTitle>

          <CardDescription className="text-primary-foreground/80 text-lg mt-2 relative z-10">
            Manage your current subscription and billing preferences.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8 bg-card">
          {subscription ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Status
                  </label>
                  <div className="mt-2">
                    <Badge className={getStatusColor(subscription.status)}>
                      {subscription.status || "Active"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Plan
                  </label>
                  <div className="mt-2 text-primary text-xl">
                    {subscription.plan_details?.name ||
                      subscription.plan ||
                      "Free"}
                  </div>
                </div>
                {subscription.current_period_end && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Next Billing Date
                    </label>
                    <div className="mt-2 text-foreground text-lg">
                      {formatDate(subscription.current_period_end)}
                    </div>
                  </div>
                )}
                {subscription.plan_details?.price && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Monthly Price
                    </label>
                    <div className="mt-2 text-xl font-semibold text-green-600">
                      €{subscription.plan_details.price}
                    </div>
                  </div>
                )}
              </div>

              {subscription.cancel_at_period_end && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-xl p-5 flex items-start">
                  <div className="w-5 h-5 bg-yellow-400 rounded-full mr-3 mt-1 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                      Subscription Ending
                    </h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Your subscription will end on{" "}
                      {formatDate(subscription.current_period_end)}. You can
                      reactivate anytime before then.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4 pt-6">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleManageBilling}
                  disabled={loading}
                  className="px-6"
                >
                  Manage Billing
                </Button>
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={() => handleCancelSubscription(false)}
                  disabled={loading}
                  className="px-6"
                >
                  Cancel Subscription
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Star className="h-14 w-14 text-muted-foreground mx-auto mb-6" />
              <h3 className="text-2xl font-semibold text-foreground mb-3">
                No Active Subscription
              </h3>
              <p className="text-muted-foreground text-lg">
                You're currently on the free plan. Upgrade to unlock premium
                features.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div className="mb-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-extrabold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent mb-6">
            Available Plans
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Flexible pricing designed to grow with you. All subscriptions include
            secure billing and can be changed anytime.
          </p>
        </div>



        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 max-w-7xl mx-auto px-4">
          {(plans || []).map((plan) => (
            <Card
              key={plan.id}
              className={`relative flex flex-col justify-between transition-all duration-300 border-0 rounded-2xl p-8 shadow-lg ${
                isCurrentPlan(plan.name)
                  ? "bg-primary text-primary-foreground shadow-2xl scale-[1.02]"
                  : safePlanName(plan.name) === "plus"
                  ? "bg-gradient-to-b from-indigo-600 to-purple-700 text-white shadow-xl border border-indigo-300"
                  : "bg-card text-card-foreground shadow-md border border-border hover:shadow-xl"
              }`}
            >
              {isCurrentPlan(plan.name) && (
                <div className="absolute -top-4 right-6">
                  <span className="bg-green-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-md">
                    Your Current Plan
                  </span>
                </div>
              )}

              {safePlanName(plan.name) === "plus" &&
                !isCurrentPlan(plan.name) && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-yellow-400 text-gray-900 px-6 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide shadow-md border border-yellow-500">
                      ★ Most Popular
                    </span>
                  </div>
                )}

              <CardHeader className="text-center pb-6 pt-8">
                <CardTitle className="text-3xl font-bold mb-3">
                  {plan.name}
                </CardTitle>
                <CardDescription
                  className={`text-base mb-5 ${
                    isCurrentPlan(plan.name) ||
                    safePlanName(plan.name) === "plus"
                      ? "text-gray-200"
                      : "text-muted-foreground"
                  }`}
                >
                  Intelligence for everyday tasks
                </CardDescription>
                <div className="mb-6">
                  <span className="text-lg font-semibold">€</span>
                  <span className="text-5xl font-extrabold">{plan.price}</span>
                  <span
                    className={`text-lg ml-1 ${
                      isCurrentPlan(plan.name) ||
                      safePlanName(plan.name) === "plus"
                        ? "text-gray-300"
                        : "text-muted-foreground"
                    }`}
                  >
                    {plan.price > 0 ? "/month" : ""}
                  </span>
                  {plan.price > 0 && (
                    <p
                      className={`text-sm mt-2 ${
                        isCurrentPlan(plan.name) ||
                        safePlanName(plan.name) === "plus"
                          ? "text-gray-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      (Includes €{(plan.price * 0.21).toFixed(2)} VAT)
                    </p>
                  )}
                  
                  {/* Action Buttons after price and VAT */}
                  <div className="mt-4">
                    {isCurrentPlan(plan.name) ? (
                      <Button
                        variant="outline"
                        className="w-full h-12 text-base font-medium border-border text-primary-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                        onClick={handleManageBilling}
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        ) : (
                          "Manage Billing"
                        )}
                      </Button>
                    ) : (
                      <Button
                        className={`w-full h-12 text-base font-semibold transition-all duration-200 ${
                          safePlanName(plan.name) === "plus"
                            ? "bg-white text-indigo-700 hover:bg-gray-100"
                            : safePlanName(plan.name) === "pro"
                            ? "bg-white text-primary hover:bg-gray-100"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                        onClick={() => handleSubscribe(plan)}
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        ) : safePlanName(plan.name) === "plus" ? (
                          "Get Plus"
                        ) : safePlanName(plan.name) === "pro" ? (
                          "Get Pro"
                        ) : (
                          "Get Started"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-6 pb-8 flex-1">
                <ul className="space-y-4 mb-10">
                  {(plan.features || []).map((feature, index) => (
                    <li
                      key={index}
                      className="flex items-center text-base leading-relaxed"
                    >
                      <Check
                        className={`h-5 w-5 mr-3 flex-shrink-0 ${
                          isCurrentPlan(plan.name) ||
                          safePlanName(plan.name) === "plus"
                            ? "text-white"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span
                        className={
                          isCurrentPlan(plan.name) ||
                          safePlanName(plan.name) === "plus"
                            ? "text-gray-100"
                            : "text-card-foreground"
                        }
                      >
                        {feature}</span>
                    </li>
                  ))}
                </ul>


              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  </div>
);

};

export default Subscriptions;
