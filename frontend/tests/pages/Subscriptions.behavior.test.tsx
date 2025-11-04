import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Subscriptions from '../../src/pages/Subscriptions';
import { ThemeProvider } from '@/hooks/useTheme';
import { useToast } from '../../src/hooks/use-toast';

// Mock react-router-dom navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock auth store
jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    user: { id: 'user-1', email: 'test@example.com' },
    session: { access_token: 'token' },
  })),
}));

// Mock useSubscriptions hook
jest.mock('../../src/hooks/useSubscriptions', () => ({
  useSubscriptions: jest.fn(() => ({
    userSubscription: null,
    plans: [],
    isLoading: false,
    refetchUserSubscription: jest.fn(),
    refetchPlans: jest.fn(),
  })),
}));

// Mock billing service
jest.mock('../../src/services/billingService', () => ({
  __esModule: true,
  default: {
    processCheckoutSuccess: jest.fn(),
    createCheckoutSession: jest.fn(),
    updateSubscriptionPlan: jest.fn(),
    createBillingPortalSession: jest.fn(),
    cancelSubscription: jest.fn(),
  },
}));

// Mock toast hook with stable instance across calls
jest.mock('../../src/hooks/use-toast', () => {
  const toast = jest.fn();
  return {
    useToast: () => ({ toast }),
  };
});

// Mock icons
jest.mock('lucide-react', () => ({
  Loader2: () => <div data-testid="loader" />,
  Star: () => <div data-testid="star-icon" />,
}));

const renderSubscriptions = (initialUrl: string = '/subscriptions') => {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[initialUrl]}>
        <Subscriptions />
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Subscriptions Page Behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset location for tests that set href
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/' },
      writable: true,
    } as any);
  });

  it('navigates back on Escape key press', () => {
    renderSubscriptions();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('shows payment canceled toast when URL contains canceled=true', async () => {
    renderSubscriptions('/subscriptions?canceled=true');

    await waitFor(() => {
      const { toast } = useToast();
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Payment Canceled',
        variant: 'destructive',
      }));
    });
  });

  it('redirects to /login when unauthenticated on mount', () => {
    const { useAuthStore } = require('../../src/stores/authStore');
    (useAuthStore as jest.Mock).mockReturnValueOnce({ user: null, session: null });

    renderSubscriptions();

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});