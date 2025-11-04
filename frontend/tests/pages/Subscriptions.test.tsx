import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SubscriptionsPage from '@/pages/Subscriptions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/hooks/useTheme';

// Provide a mock that supports both hook calls and getState access
jest.mock('@/stores/authStore', () => {
  const store = {
    user: { email: 'test@example.com', id: 'user-1' },
    session: { access_token: 'token' },
    loading: false,
    isAuthenticated: () => true,
  };
  const useAuthStore = jest.fn(() => store);
  (useAuthStore as any).getState = () => store;
  return { useAuthStore };
});
// Also mock the relative import used by the Subscriptions page
jest.mock('../stores/authStore', () => {
  const store = {
    user: { email: 'test@example.com', id: 'user-1' },
    session: { access_token: 'token' },
    loading: false,
    isAuthenticated: () => true,
  };
  const useAuthStore = jest.fn(() => store);
  (useAuthStore as any).getState = () => store;
  return { useAuthStore };
});

// Mock toast hook
jest.mock('@/hooks/use-toast', () => {
  const toast = jest.fn();
  return { useToast: () => ({ toast }) };
});
import { useToast } from '@/hooks/use-toast';

// Mock useSubscriptions hook
jest.mock('@/hooks/useSubscriptions', () => ({ useSubscriptions: jest.fn() }));
import { useSubscriptions } from '@/hooks/useSubscriptions';

// Mock billing service
jest.mock('@/services/billingService', () => ({
  __esModule: true,
  default: {
    createCheckoutSession: jest.fn(),
    updateSubscriptionPlan: jest.fn(),
    cancelSubscription: jest.fn(),
    createBillingPortalSession: jest.fn(),
    processCheckoutSuccess: jest.fn(),
  },
}));
// Ensure component's relative import resolves to the same mocked module instance
jest.mock('../services/billingService', () => ({
  __esModule: true,
  default: require('@/services/billingService').default,
}));
import billingService from '@/services/billingService';

function renderWithProviders(ui: React.ReactElement, initialEntries: string[] = ['/subscriptions']) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (useSubscriptions as jest.Mock).mockReturnValue({
    userSubscription: null,
    plans: [],
    isLoading: false,
    refetchUserSubscription: jest.fn(),
    refetchPlans: jest.fn(),
  });
  Object.defineProperty(window, 'location', {
    value: { href: 'http://localhost/' },
    writable: true,
  } as any);
});

describe('Subscriptions Page', () => {
  it('shows loading state when subscriptions are loading', () => {
    (useSubscriptions as jest.Mock).mockReturnValue({
      userSubscription: null,
      plans: [],
      isLoading: true,
      refetchUserSubscription: jest.fn(),
      refetchPlans: jest.fn(),
    });

    renderWithProviders(<SubscriptionsPage />);
    expect(screen.getByText(/Loading your subscription details/i)).toBeInTheDocument();
  });

  it('renders current subscription details and action buttons', () => {
    (useSubscriptions as jest.Mock).mockReturnValue({
      userSubscription: {
        plan: 'plus',
        status: 'active',
        current_period_end: '2025-12-01T00:00:00.000Z',
        cancel_at_period_end: false,
        plan_details: { name: 'Plus', price: 10 },
      },
      plans: [
        { id: 'free-plan', originalId: 'free-plan', name: 'Free', price: 0, features: ['Feature A'] },
        { id: 'plus-plan', originalId: 'plus-plan', name: 'Plus', price: 10, features: ['Feature C'] },
      ],
      isLoading: false,
      refetchUserSubscription: jest.fn(),
      refetchPlans: jest.fn(),
    });

    renderWithProviders(<SubscriptionsPage />);

    expect(screen.getByText(/Current Subscription:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Plus/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Next Billing Date/i)).toBeInTheDocument();
    expect(screen.getByText(/Monthly Price/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Manage Billing/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Cancel Subscription/i })).toBeInTheDocument();
  });

  it('shows "No Active Subscription" when there is no subscription', () => {
    (useSubscriptions as jest.Mock).mockReturnValue({
      userSubscription: null,
      plans: [
        { id: 'free-plan', originalId: 'free-plan', name: 'Free', price: 0, features: ['Feature A'] },
      ],
      isLoading: false,
      refetchUserSubscription: jest.fn(),
      refetchPlans: jest.fn(),
    });

    renderWithProviders(<SubscriptionsPage />);

    expect(screen.getByText(/No Active Subscription/i)).toBeInTheDocument();
    expect(screen.getByText(/You're currently on the free plan/i)).toBeInTheDocument();
  });

  it('Manage Billing triggers billing portal and redirects', async () => {
    (billingService.createBillingPortalSession as jest.Mock).mockResolvedValue({ url: 'https://billing.example' });

    (useSubscriptions as jest.Mock).mockReturnValue({
      userSubscription: {
        plan: 'plus',
        status: 'active',
        plan_details: { name: 'Plus', price: 10 },
      },
      plans: [],
      isLoading: false,
      refetchUserSubscription: jest.fn(),
      refetchPlans: jest.fn(),
    });

    renderWithProviders(<SubscriptionsPage />);

    fireEvent.click(screen.getByRole('button', { name: /Manage Billing/i }));

    await waitFor(() => {
      expect((billingService.createBillingPortalSession as jest.Mock)).toHaveBeenCalledTimes(1);
      expect(window.location.href).toBe('https://billing.example');
    });
  });

  it('Cancel Subscription calls service and refetches', async () => {
    (billingService.cancelSubscription as jest.Mock).mockResolvedValue({ success: true, message: 'Subscription canceled' });
    const refetchMock = jest.fn();

    (useSubscriptions as jest.Mock).mockReturnValue({
      userSubscription: {
        plan: 'plus',
        status: 'active',
        plan_details: { name: 'Plus', price: 10 },
      },
      plans: [],
      isLoading: false,
      refetchUserSubscription: refetchMock,
      refetchPlans: jest.fn(),
    });

    renderWithProviders(<SubscriptionsPage />);

    fireEvent.click(screen.getByRole('button', { name: /Cancel Subscription/i }));

    await waitFor(() => {
      expect((billingService.cancelSubscription as jest.Mock)).toHaveBeenCalledWith(false);
      expect(refetchMock).toHaveBeenCalledTimes(1);
      const { toast } = useToast();
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Success' }));
    });
  });

  it('Subscribe to paid plan creates checkout session and redirects', async () => {
    (billingService.createCheckoutSession as jest.Mock).mockResolvedValue({ sessionId: 'sess_123', url: 'https://checkout.example' });

    (useSubscriptions as jest.Mock).mockReturnValue({
      userSubscription: null,
      plans: [
        { id: 'plus-plan', originalId: 'plus-plan', name: 'Plus', price: 10, features: ['Feature C'] },
      ],
      isLoading: false,
      refetchUserSubscription: jest.fn(),
      refetchPlans: jest.fn(),
    });

    renderWithProviders(<SubscriptionsPage />);

    fireEvent.click(screen.getByRole('button', { name: /Get Plus/i }));

    await waitFor(() => {
      expect((billingService.createCheckoutSession as jest.Mock)).toHaveBeenCalledWith('plus-plan');
      expect(window.location.href).toBe('https://checkout.example');
    });
  });

  it('Subscribe to free plan updates plan and refetches', async () => {
    (billingService.updateSubscriptionPlan as jest.Mock).mockResolvedValue({ success: true });
    const refetchMock = jest.fn();

    (useSubscriptions as jest.Mock).mockReturnValue({
      userSubscription: {
        plan: 'plus',
        status: 'active',
        plan_details: { name: 'Plus', price: 10 },
      },
      plans: [
        { id: 'free-plan', originalId: 'free-plan', name: 'Free', price: 0, features: ['Feature A'] },
      ],
      isLoading: false,
      refetchUserSubscription: refetchMock,
      refetchPlans: jest.fn(),
    });

    renderWithProviders(<SubscriptionsPage />);

    const startBtn = await screen.findByRole('button', { name: /Get Started/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect((billingService.updateSubscriptionPlan as jest.Mock)).toHaveBeenCalledWith('free');
      expect(refetchMock).toHaveBeenCalledTimes(1);
      const { toast } = useToast();
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Success!' }));
    });
  });

  it('Checkout success via URL processes success and refetches', async () => {
    (billingService.processCheckoutSuccess as jest.Mock).mockResolvedValue({ success: true, message: 'Activated' });
    const refetchMock = jest.fn();

    (useSubscriptions as jest.Mock).mockReturnValue({
      userSubscription: null,
      plans: [],
      isLoading: false,
      refetchUserSubscription: refetchMock,
      refetchPlans: jest.fn(),
    });

    renderWithProviders(<SubscriptionsPage />, ['/subscriptions?success=true&session_id=sess_abc']);

    await waitFor(() => {
      expect((billingService.processCheckoutSuccess as jest.Mock)).toHaveBeenCalledWith('sess_abc', 'plus-plan');
      expect(refetchMock).toHaveBeenCalled();
      const { toast } = useToast();
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment Successful!' }));
    });
  });

  it('Paid checkout failure shows error toast', async () => {
    (billingService.createCheckoutSession as jest.Mock).mockRejectedValue(new Error('network error'));

    (useSubscriptions as jest.Mock).mockReturnValue({
      userSubscription: null,
      plans: [
        { id: 'plus-plan', originalId: 'plus-plan', name: 'Plus', price: 10, features: [] },
      ],
      isLoading: false,
      refetchUserSubscription: jest.fn(),
      refetchPlans: jest.fn(),
    });

    renderWithProviders(<SubscriptionsPage />);

    fireEvent.click(screen.getByRole('button', { name: /Get Plus/i }));

    await waitFor(() => {
      expect((billingService.createCheckoutSession as jest.Mock)).toHaveBeenCalledTimes(1);
      const { toast } = useToast();
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error', variant: 'destructive' }));
    });
  });
});