import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TransactionHistory from '@/pages/TransactionHistory';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock auth store for both alias and relative paths
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
jest.mock('@/components/ui/use-toast', () => {
  const toast = jest.fn();
  return { useToast: () => ({ toast }) };
});
import { useToast } from '@/components/ui/use-toast';

// Mock billingService (relative import used by page)
jest.mock('../services/billingService', () => ({
  __esModule: true,
  default: {
    getBillingHistory: jest.fn(),
  },
}));
import billingService from '../services/billingService';

// Mock useNavigate to assert navigations
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithProviders(ui: React.ReactElement, initialEntries: string[] = ['/transactions']) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TransactionHistory Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state while fetching', () => {
    // Keep the promise pending to maintain loading state
    (billingService.getBillingHistory as jest.Mock).mockReturnValue(new Promise(() => {}));

    renderWithProviders(<TransactionHistory />);

    expect(screen.getByText(/Loading transaction history/i)).toBeInTheDocument();
  });

  it('redirects to login when no session or user', () => {
    // Configure mocked auth store to return no session/user for this test only
    const { useAuthStore } = jest.requireMock('../stores/authStore');
    (useAuthStore as jest.Mock).mockImplementationOnce(() => ({
      user: null,
      session: null,
      loading: false,
      isAuthenticated: () => false,
    }));
  
    renderWithProviders(<TransactionHistory />);
  
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows empty state and navigates to subscriptions', async () => {
    (billingService.getBillingHistory as jest.Mock).mockResolvedValue([]);

    renderWithProviders(<TransactionHistory />);

    await waitFor(() => {
      expect(screen.getByText(/No transactions found/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View Subscription Plans/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/subscriptions');
  });

  it('renders transaction list with actions', async () => {
    const data = [
      {
        id: 'txn_1',
        amount: 1000,
        amountPaid: 1000,
        currency: 'usd',
        status: 'paid',
        plan: 'plus',
        subscriptionStatus: 'active',
        invoiceUrl: 'https://example.com/invoice/txn_1',
        pdfUrl: 'https://example.com/invoice/txn_1.pdf',
        date: '2025-01-15T00:00:00.000Z',
        periodStart: '2025-01-01T00:00:00.000Z',
        periodEnd: '2025-01-31T00:00:00.000Z',
        stripeInvoiceId: 'in_123',
      },
    ];
    (billingService.getBillingHistory as jest.Mock).mockResolvedValue(data);

    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null as any);

    renderWithProviders(<TransactionHistory />);

    // Title contains plan name
    await waitFor(() => {
      expect(screen.getByText(/Plus Plan/i)).toBeInTheDocument();
    });

    // Amount Paid label present
    expect(screen.getByText(/Amount Paid:/i)).toBeInTheDocument();

    // PDF and View buttons trigger window.open
    fireEvent.click(screen.getByRole('button', { name: /PDF/i }));
    fireEvent.click(screen.getByRole('button', { name: /View/i }));
    expect(openSpy).toHaveBeenCalledWith('https://example.com/invoice/txn_1.pdf', '_blank');
    expect(openSpy).toHaveBeenCalledWith('https://example.com/invoice/txn_1', '_blank');

    openSpy.mockRestore();
  });

  it('handles fetch error and shows error toast', async () => {
    (billingService.getBillingHistory as jest.Mock).mockRejectedValue(new Error('network error'));

    renderWithProviders(<TransactionHistory />);

    await waitFor(() => {
      const { toast } = useToast();
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error', variant: 'destructive' }));
    });
  });

  it('enters fullscreen mode when #transactions hash is present', () => {
    (billingService.getBillingHistory as jest.Mock).mockReturnValue(new Promise(() => {}));
  
    // Set hash before rendering so the effect detects it on mount
    window.location.hash = '#transactions';
  
    const { container } = renderWithProviders(<TransactionHistory />, ['/transactions']);
  
    // Check container class for fullscreen
    const fullscreenContainer = container.querySelector('div.fixed.inset-0.z-50.bg-background');
    expect(fullscreenContainer).not.toBeNull();
  });
});