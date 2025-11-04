export interface PlanDetails {
  id?: string;
  name: string;
  price: number;
  features: string[];
}

export interface Subscription {
  id?: string;
  plan: string;
  status: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  plan_details?: PlanDetails;
  plan_id?: string;
  user?: {
    subscription_plan?: string;
  };
  updated_at?: string;
  [key: string]: unknown;
}

export interface Plan {
  id: string;
  originalId?: string;
  name: string;
  price: number;
  features: string[];
  max_messages_per_month: number;
  stripe_price_id?: string;
}

// API Response Types
export interface CreateSubscriptionResponse {
  subscriptionId: string;
  message: string;
  subscription: Subscription;
}

export interface UpdateUserSubscriptionResponse {
  success: boolean;
  message: string;
  plan: string;
  status: string;
}