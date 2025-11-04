/**
 * Billing Controller Unit Tests
 * Comprehensive tests for all billing controller methods and edge cases
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockResolvedValue({ data: [], error: null })
};

// Mock the supabase client module
jest.mock('../src/db/supabase/client.js', () => mockSupabase);

const billingController = require('../src/controllers/billingController');

// Mock console methods
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('Billing Controller Unit Tests', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock request object
    mockReq = {
      user: { id: 'test-user-123' }
    };
    
    // Setup mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getBillingHistory', () => {

    it('should get billing history successfully', async () => {
      const mockBillingData = [
        {
          id: 'inv_1',
          amount_due: 2999,
          amount_paid: 2999,
          currency: 'usd',
          status: 'paid',
          stripe_invoice_id: 'in_1234567890',
          invoice_pdf_url: 'https://pay.stripe.com/invoice/acct_1234/test_1234/pdf',
          hosted_invoice_url: 'https://invoice.stripe.com/i/inv_1',
          due_date: '2022-01-15T00:00:00Z',
          period_start: '2022-01-01T00:00:00Z',
          period_end: '2022-01-31T23:59:59Z',
          created_at: '2022-01-01T00:00:00Z',
          subscriptions: {
            plan: 'pro',
            status: 'active'
          }
        },
        {
          id: 'inv_2',
          amount_due: 2999,
          amount_paid: 2999,
          currency: 'usd',
          status: 'paid',
          stripe_invoice_id: 'in_0987654321',
          invoice_pdf_url: 'https://pay.stripe.com/invoice/acct_1234/test_5678/pdf',
          hosted_invoice_url: 'https://invoice.stripe.com/i/inv_2',
          due_date: '2022-02-15T00:00:00Z',
          period_start: '2022-02-01T00:00:00Z',
          period_end: '2022-02-28T23:59:59Z',
          created_at: '2022-02-01T00:00:00Z',
          subscriptions: {
            plan: 'pro',
            status: 'active'
          }
        }
      ];
      
      mockSupabase.order.mockResolvedValue({
        data: mockBillingData,
        error: null
      });
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      expect(mockSupabase.from).toHaveBeenCalledWith('subscription_invoices');
      expect(mockSupabase.select).toHaveBeenCalledWith(`
                id,
                amount_due,
                amount_paid,
                currency,
                status,
                stripe_invoice_id,
                invoice_pdf_url,
                hosted_invoice_url,
                due_date,
                period_start,
                period_end,
                created_at,
                subscriptions!inner(
                    plan,
                    status
                )
            `);
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'test-user-123');
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false });
      
      const expectedResponse = [
        {
          id: 'inv_1',
          amount: 2999,
          amountPaid: 2999,
          currency: 'usd',
          status: 'paid',
          plan: 'pro',
          subscriptionStatus: 'active',
          invoiceUrl: 'https://invoice.stripe.com/i/inv_1',
          pdfUrl: 'https://pay.stripe.com/invoice/acct_1234/test_1234/pdf',
          dueDate: '2022-01-15T00:00:00Z',
          periodStart: '2022-01-01T00:00:00Z',
          periodEnd: '2022-01-31T23:59:59Z',
          date: '2022-01-01T00:00:00Z',
          stripeInvoiceId: 'in_1234567890'
        },
        {
          id: 'inv_2',
          amount: 2999,
          amountPaid: 2999,
          currency: 'usd',
          status: 'paid',
          plan: 'pro',
          subscriptionStatus: 'active',
          invoiceUrl: 'https://invoice.stripe.com/i/inv_2',
          pdfUrl: 'https://pay.stripe.com/invoice/acct_1234/test_5678/pdf',
          dueDate: '2022-02-15T00:00:00Z',
          periodStart: '2022-02-01T00:00:00Z',
          periodEnd: '2022-02-28T23:59:59Z',
          date: '2022-02-01T00:00:00Z',
          stripeInvoiceId: 'in_0987654321'
        }
      ];
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse);
    });

    it('should handle missing user in request', async () => {
      mockReq.user = undefined;
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle missing user id', async () => {
      mockReq.user = {};
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      expect(mockSupabase.from).toHaveBeenCalledWith('subscription_invoices');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', undefined);
    });

    it('should handle empty billing history', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null
      });
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('should handle null billing data', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: null
      });
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should handle Supabase error', async () => {
      const mockError = { message: 'Database connection failed' };
      
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: mockError
      });
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: 'Failed to fetch billing history'
      });
      expect(console.error).toHaveBeenCalledWith('Database error:', mockError);
    });

    it('should handle Supabase rejection', async () => {
      mockSupabase.order.mockRejectedValue(new Error('Network error'));
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: 'Internal server error'
      });
      expect(console.error).toHaveBeenCalledWith('Error fetching billing history:', expect.any(Error));
    });

    it('should handle invoice with missing subscription data', async () => {
      const incompleteInvoice = {
        id: 'inv_incomplete',
        amount_due: 1999,
        amount_paid: 1999,
        currency: 'usd',
        status: 'paid',
        stripe_invoice_id: 'in_incomplete',
        invoice_pdf_url: null,
        hosted_invoice_url: 'https://invoice.stripe.com/i/inv_incomplete',
        due_date: '2022-01-15T00:00:00Z',
        period_start: '2022-01-01T00:00:00Z',
        period_end: '2022-01-31T23:59:59Z',
        created_at: '2022-01-01T00:00:00Z',
        subscriptions: null // Missing subscription data
      };
      
      mockSupabase.order.mockResolvedValue({
        data: [incompleteInvoice],
        error: null
      });
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      const expectedResponse = [{
        id: 'inv_incomplete',
        amount: 1999,
        amountPaid: 1999,
        currency: 'usd',
        status: 'paid',
        plan: 'Unknown',
        subscriptionStatus: 'Unknown',
        invoiceUrl: 'https://invoice.stripe.com/i/inv_incomplete',
        pdfUrl: null,
        dueDate: '2022-01-15T00:00:00Z',
        periodStart: '2022-01-01T00:00:00Z',
        periodEnd: '2022-01-31T23:59:59Z',
        date: '2022-01-01T00:00:00Z',
        stripeInvoiceId: 'in_incomplete'
      }];
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse);
    });

    it('should handle invoice with zero amount', async () => {
      const zeroAmountInvoice = {
        id: 'inv_zero',
        amount_due: 0,
        amount_paid: 0,
        currency: 'usd',
        status: 'paid',
        stripe_invoice_id: 'in_zero',
        invoice_pdf_url: 'https://pay.stripe.com/invoice/acct_1234/test_zero/pdf',
        hosted_invoice_url: 'https://invoice.stripe.com/i/inv_zero',
        due_date: '2022-01-15T00:00:00Z',
        period_start: '2022-01-01T00:00:00Z',
        period_end: '2022-01-31T23:59:59Z',
        created_at: '2022-01-01T00:00:00Z',
        subscriptions: {
          plan: 'free',
          status: 'active'
        }
      };
      
      mockSupabase.order.mockResolvedValue({
        data: [zeroAmountInvoice],
        error: null
      });
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      const expectedResponse = [{
        id: 'inv_zero',
        amount: 0,
        amountPaid: 0,
        currency: 'usd',
        status: 'paid',
        plan: 'free',
        subscriptionStatus: 'active',
        invoiceUrl: 'https://invoice.stripe.com/i/inv_zero',
        pdfUrl: 'https://pay.stripe.com/invoice/acct_1234/test_zero/pdf',
        dueDate: '2022-01-15T00:00:00Z',
        periodStart: '2022-01-01T00:00:00Z',
        periodEnd: '2022-01-31T23:59:59Z',
        date: '2022-01-01T00:00:00Z',
        stripeInvoiceId: 'in_zero'
      }];
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse);
    });

    it('should handle different invoice statuses', async () => {
      const multiStatusInvoices = [
        {
          id: 'inv_paid',
          amount_due: 2999,
          amount_paid: 2999,
          currency: 'usd',
          status: 'paid',
          stripe_invoice_id: 'in_paid',
          invoice_pdf_url: 'https://pay.stripe.com/invoice/acct_1234/test_paid/pdf',
          hosted_invoice_url: 'https://invoice.stripe.com/i/inv_paid',
          due_date: '2022-01-15T00:00:00Z',
          period_start: '2022-01-01T00:00:00Z',
          period_end: '2022-01-31T23:59:59Z',
          created_at: '2022-01-01T00:00:00Z',
          subscriptions: {
            plan: 'pro',
            status: 'active'
          }
        },
        {
          id: 'inv_pending',
          amount_due: 2999,
          amount_paid: 0,
          currency: 'usd',
          status: 'open',
          stripe_invoice_id: 'in_pending',
          invoice_pdf_url: 'https://pay.stripe.com/invoice/acct_1234/test_pending/pdf',
          hosted_invoice_url: 'https://invoice.stripe.com/i/inv_pending',
          due_date: '2022-02-15T00:00:00Z',
          period_start: '2022-02-01T00:00:00Z',
          period_end: '2022-02-28T23:59:59Z',
          created_at: '2022-02-01T00:00:00Z',
          subscriptions: {
            plan: 'pro',
            status: 'past_due'
          }
        }
      ];
      
      mockSupabase.order.mockResolvedValue({
        data: multiStatusInvoices,
        error: null
      });
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ status: 'paid', plan: 'pro', subscriptionStatus: 'active' }),
        expect.objectContaining({ status: 'open', plan: 'pro', subscriptionStatus: 'past_due' })
      ]));
    });

    it('should handle different currencies', async () => {
      const multiCurrencyInvoices = [
        {
          id: 'inv_eur',
          amount_due: 2500,
          amount_paid: 2500,
          currency: 'eur',
          status: 'paid',
          stripe_invoice_id: 'in_eur',
          invoice_pdf_url: 'https://pay.stripe.com/invoice/acct_1234/test_eur/pdf',
          hosted_invoice_url: 'https://invoice.stripe.com/i/inv_eur',
          due_date: '2022-01-15T00:00:00Z',
          period_start: '2022-01-01T00:00:00Z',
          period_end: '2022-01-31T23:59:59Z',
          created_at: '2022-01-01T00:00:00Z',
          subscriptions: {
            plan: 'pro',
            status: 'active'
          }
        },
        {
          id: 'inv_gbp',
          amount_due: 2200,
          amount_paid: 2200,
          currency: 'gbp',
          status: 'paid',
          stripe_invoice_id: 'in_gbp',
          invoice_pdf_url: 'https://pay.stripe.com/invoice/acct_1234/test_gbp/pdf',
          hosted_invoice_url: 'https://invoice.stripe.com/i/inv_gbp',
          due_date: '2022-02-15T00:00:00Z',
          period_start: '2022-02-01T00:00:00Z',
          period_end: '2022-02-28T23:59:59Z',
          created_at: '2022-02-01T00:00:00Z',
          subscriptions: {
            plan: 'pro',
            status: 'active'
          }
        }
      ];
      
      mockSupabase.order.mockResolvedValue({
        data: multiCurrencyInvoices,
        error: null
      });
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ currency: 'eur', amount: 2500 }),
        expect.objectContaining({ currency: 'gbp', amount: 2200 })
      ]));
    });

    it('should handle large billing history', async () => {
      const largeBillingData = Array.from({ length: 50 }, (_, i) => ({
        id: `inv_${i}`,
        amount_due: 2999,
        amount_paid: 2999,
        currency: 'usd',
        status: 'paid',
        stripe_invoice_id: `in_${i}`,
        invoice_pdf_url: `https://pay.stripe.com/invoice/acct_1234/test_${i}/pdf`,
        hosted_invoice_url: `https://invoice.stripe.com/i/inv_${i}`,
        due_date: '2022-01-15T00:00:00Z',
        period_start: '2022-01-01T00:00:00Z',
        period_end: '2022-01-31T23:59:59Z',
        created_at: '2022-01-01T00:00:00Z',
        subscriptions: {
          plan: 'pro',
          status: 'active'
        }
      }));
      
      mockSupabase.order.mockResolvedValue({
        data: largeBillingData,
        error: null
      });
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: 'inv_0' }),
        expect.objectContaining({ id: 'inv_49' })
      ]));
      expect(mockRes.json.mock.calls[0][0]).toHaveLength(50);
    });

    it('should handle special characters in user id', async () => {
      mockReq.user.id = 'user-123@domain.com';
      
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null
      });
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-123@domain.com');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('should handle missing request object', async () => {
      await billingController.getBillingHistory(null, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Data Transformation Tests', () => {
    it('should transform invoice data correctly', async () => {
      const mockBillingData = [{
        id: 'inv_123',
        amount_due: 2999,
        amount_paid: 2999,
        currency: 'eur',
        status: 'paid',
        stripe_invoice_id: 'in_123',
        invoice_pdf_url: 'https://pay.stripe.com/invoice/acct_1234/test_123/pdf',
        hosted_invoice_url: 'https://invoice.stripe.com/i/inv_123',
        due_date: '2022-01-15T00:00:00Z',
        period_start: '2022-01-01T00:00:00Z',
        period_end: '2022-01-31T23:59:59Z',
        created_at: '2022-01-01T00:00:00Z',
        subscriptions: {
          plan: 'pro',
          status: 'active'
        }
      }];
      
      mockSupabase.order.mockResolvedValue({
        data: mockBillingData,
        error: null
      });
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([{
        id: 'inv_123',
        amount: 2999,
        amountPaid: 2999,
        currency: 'eur',
        status: 'paid',
        plan: 'pro',
        subscriptionStatus: 'active',
        invoiceUrl: 'https://invoice.stripe.com/i/inv_123',
        pdfUrl: 'https://pay.stripe.com/invoice/acct_1234/test_123/pdf',
        dueDate: '2022-01-15T00:00:00Z',
        periodStart: '2022-01-01T00:00:00Z',
        periodEnd: '2022-01-31T23:59:59Z',
        date: '2022-01-01T00:00:00Z',
        stripeInvoiceId: 'in_123'
      }]);
    });

    it('should handle missing subscription data gracefully', async () => {
      const mockBillingData = [{
        id: 'inv_123',
        amount_due: 1999,
        amount_paid: 1999,
        currency: 'usd',
        status: 'paid',
        stripe_invoice_id: 'in_123',
        invoice_pdf_url: 'https://pay.stripe.com/invoice/acct_1234/test_123/pdf',
        hosted_invoice_url: 'https://invoice.stripe.com/i/inv_123',
        due_date: '2022-01-15T00:00:00Z',
        period_start: '2022-01-01T00:00:00Z',
        period_end: '2022-01-31T23:59:59Z',
        created_at: '2022-01-01T00:00:00Z',
        subscriptions: null
      }];
      
      mockSupabase.order.mockResolvedValue({
        data: mockBillingData,
        error: null
      });
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([{
        id: 'inv_123',
        amount: 1999,
        amountPaid: 1999,
        currency: 'usd',
        status: 'paid',
        plan: 'Unknown',
        subscriptionStatus: 'Unknown',
        invoiceUrl: 'https://invoice.stripe.com/i/inv_123',
        pdfUrl: 'https://pay.stripe.com/invoice/acct_1234/test_123/pdf',
        dueDate: '2022-01-15T00:00:00Z',
        periodStart: '2022-01-01T00:00:00Z',
        periodEnd: '2022-01-31T23:59:59Z',
        date: '2022-01-01T00:00:00Z',
        stripeInvoiceId: 'in_123'
      }]);
    });

    it('should handle edge cases in data transformation', async () => {
      const mockBillingData = [{
        id: 'inv_edge',
        amount_due: 0,
        amount_paid: 0,
        currency: 'gbp',
        status: 'draft',
        stripe_invoice_id: 'in_edge',
        invoice_pdf_url: null,
        hosted_invoice_url: null,
        due_date: null,
        period_start: '2022-01-01T00:00:00Z',
        period_end: '2022-01-31T23:59:59Z',
        created_at: '2022-01-01T00:00:00Z',
        subscriptions: {
          plan: 'basic',
          status: 'canceled'
        }
      }];
      
      mockSupabase.order.mockResolvedValue({
        data: mockBillingData,
        error: null
      });
      
      await billingController.getBillingHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([{
        id: 'inv_edge',
        amount: 0,
        amountPaid: 0,
        currency: 'gbp',
        status: 'draft',
        plan: 'basic',
        subscriptionStatus: 'canceled',
        invoiceUrl: null,
        pdfUrl: null,
        dueDate: null,
        periodStart: '2022-01-01T00:00:00Z',
        periodEnd: '2022-01-31T23:59:59Z',
        date: '2022-01-01T00:00:00Z',
        stripeInvoiceId: 'in_edge'
      }]);
    });
  });
});