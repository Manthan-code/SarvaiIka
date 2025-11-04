// Jest mock for billingService used by pages
export default {
  getBillingHistory: jest.fn(),
  createCheckoutSession: jest.fn(),
  updateSubscriptionPlan: jest.fn(),
  cancelSubscription: jest.fn(),
  createBillingPortalSession: jest.fn(),
  processCheckoutSuccess: jest.fn(),
};