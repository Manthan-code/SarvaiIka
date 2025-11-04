/**
 * Stripe Service Unit Tests
 * Comprehensive tests for all stripe service methods
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock Stripe before requiring the service
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
      del: jest.fn()
    },
    subscriptions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
      list: jest.fn()
    },
    invoices: {
      create: jest.fn(),
      retrieve: jest.fn(),
      list: jest.fn(),
      pay: jest.fn(),
      voidInvoice: jest.fn()
    },
    paymentMethods: {
      create: jest.fn(),
      retrieve: jest.fn(),
      attach: jest.fn(),
      detach: jest.fn(),
      list: jest.fn()
    },
    prices: {
      create: jest.fn(),
      retrieve: jest.fn(),
      list: jest.fn(),
      update: jest.fn()
    },
    products: {
      create: jest.fn(),
      retrieve: jest.fn(),
      list: jest.fn(),
      update: jest.fn()
    },
    webhookEndpoints: {
      create: jest.fn(),
      retrieve: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
      del: jest.fn()
    },
    events: {
      retrieve: jest.fn()
    },
    checkout: {
      sessions: {
        create: jest.fn(),
        retrieve: jest.fn(),
        list: jest.fn()
      }
    }
  }));
});

const stripeService = require('../../../src/services/stripeService');

describe('Stripe Service Unit Tests', () => {
  let mockStripe;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStripe = require('stripe')();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Customer Management', () => {
    it('should create a new customer', async () => {
      const customerData = {
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user123' }
      };

      const mockCustomer = {
        id: 'cus_test123',
        email: 'test@example.com',
        name: 'Test User'
      };

      mockStripe.customers.create.mockResolvedValue(mockCustomer);

      const result = await stripeService.createCustomer(customerData);

      expect(mockStripe.customers.create).toHaveBeenCalledWith(customerData);
      expect(result).toEqual(mockCustomer);
    });

    it('should retrieve a customer', async () => {
      const customerId = 'cus_test123';
      const mockCustomer = {
        id: customerId,
        email: 'test@example.com',
        name: 'Test User'
      };

      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer);

      const result = await stripeService.getCustomer(customerId);

      expect(mockStripe.customers.retrieve).toHaveBeenCalledWith(customerId);
      expect(result).toEqual(mockCustomer);
    });

    it('should update a customer', async () => {
      const customerId = 'cus_test123';
      const updateData = { name: 'Updated Name' };
      const mockUpdatedCustomer = {
        id: customerId,
        email: 'test@example.com',
        name: 'Updated Name'
      };

      mockStripe.customers.update.mockResolvedValue(mockUpdatedCustomer);

      const result = await stripeService.updateCustomer(customerId, updateData);

      expect(mockStripe.customers.update).toHaveBeenCalledWith(customerId, updateData);
      expect(result).toEqual(mockUpdatedCustomer);
    });

    it('should list customers', async () => {
      const mockCustomers = {
        data: [
          { id: 'cus_1', email: 'user1@example.com' },
          { id: 'cus_2', email: 'user2@example.com' }
        ],
        has_more: false
      };

      mockStripe.customers.list.mockResolvedValue(mockCustomers);

      const result = await stripeService.listCustomers({ limit: 10 });

      expect(mockStripe.customers.list).toHaveBeenCalledWith({ limit: 10 });
      expect(result).toEqual(mockCustomers);
    });

    it('should delete a customer', async () => {
      const customerId = 'cus_test123';
      const mockDeletedCustomer = {
        id: customerId,
        deleted: true
      };

      mockStripe.customers.del.mockResolvedValue(mockDeletedCustomer);

      const result = await stripeService.deleteCustomer(customerId);

      expect(mockStripe.customers.del).toHaveBeenCalledWith(customerId);
      expect(result).toEqual(mockDeletedCustomer);
    });
  });

  describe('Subscription Management', () => {
    it('should create a subscription', async () => {
      const subscriptionData = {
        customer: 'cus_test123',
        items: [{ price: 'price_test123' }]
      };

      const mockSubscription = {
        id: 'sub_test123',
        customer: 'cus_test123',
        status: 'active'
      };

      mockStripe.subscriptions.create.mockResolvedValue(mockSubscription);

      const result = await stripeService.createSubscription(subscriptionData);

      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(subscriptionData);
      expect(result).toEqual(mockSubscription);
    });

    it('should retrieve a subscription', async () => {
      const subscriptionId = 'sub_test123';
      const mockSubscription = {
        id: subscriptionId,
        customer: 'cus_test123',
        status: 'active'
      };

      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      const result = await stripeService.getSubscription(subscriptionId);

      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith(subscriptionId);
      expect(result).toEqual(mockSubscription);
    });

    it('should update a subscription', async () => {
      const subscriptionId = 'sub_test123';
      const updateData = { metadata: { updated: 'true' } };
      const mockUpdatedSubscription = {
        id: subscriptionId,
        customer: 'cus_test123',
        status: 'active',
        metadata: { updated: 'true' }
      };

      mockStripe.subscriptions.update.mockResolvedValue(mockUpdatedSubscription);

      const result = await stripeService.updateSubscription(subscriptionId, updateData);

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(subscriptionId, updateData);
      expect(result).toEqual(mockUpdatedSubscription);
    });

    it('should cancel a subscription', async () => {
      const subscriptionId = 'sub_test123';
      const mockCancelledSubscription = {
        id: subscriptionId,
        status: 'canceled'
      };

      mockStripe.subscriptions.cancel.mockResolvedValue(mockCancelledSubscription);

      const result = await stripeService.cancelSubscription(subscriptionId);

      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith(subscriptionId);
      expect(result).toEqual(mockCancelledSubscription);
    });
  });

  describe('Invoice Management', () => {
    it('should create an invoice', async () => {
      const invoiceData = {
        customer: 'cus_test123',
        auto_advance: false
      };

      const mockInvoice = {
        id: 'in_test123',
        customer: 'cus_test123',
        status: 'draft'
      };

      mockStripe.invoices.create.mockResolvedValue(mockInvoice);

      const result = await stripeService.createInvoice(invoiceData);

      expect(mockStripe.invoices.create).toHaveBeenCalledWith(invoiceData);
      expect(result).toEqual(mockInvoice);
    });

    it('should retrieve an invoice', async () => {
      const invoiceId = 'in_test123';
      const mockInvoice = {
        id: invoiceId,
        customer: 'cus_test123',
        status: 'paid'
      };

      mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice);

      const result = await stripeService.getInvoice(invoiceId);

      expect(mockStripe.invoices.retrieve).toHaveBeenCalledWith(invoiceId);
      expect(result).toEqual(mockInvoice);
    });

    it('should list invoices', async () => {
      const mockInvoices = {
        data: [
          { id: 'in_1', status: 'paid' },
          { id: 'in_2', status: 'open' }
        ],
        has_more: false
      };

      mockStripe.invoices.list.mockResolvedValue(mockInvoices);

      const result = await stripeService.listInvoices({ limit: 10 });

      expect(mockStripe.invoices.list).toHaveBeenCalledWith({ limit: 10 });
      expect(result).toEqual(mockInvoices);
    });
  });

  describe('Payment Methods', () => {
    it('should create a payment method', async () => {
      const paymentMethodData = {
        type: 'card',
        card: {
          number: '4242424242424242',
          exp_month: 12,
          exp_year: 2025,
          cvc: '123'
        }
      };

      const mockPaymentMethod = {
        id: 'pm_test123',
        type: 'card',
        card: { last4: '4242' }
      };

      mockStripe.paymentMethods.create.mockResolvedValue(mockPaymentMethod);

      const result = await stripeService.createPaymentMethod(paymentMethodData);

      expect(mockStripe.paymentMethods.create).toHaveBeenCalledWith(paymentMethodData);
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should attach payment method to customer', async () => {
      const paymentMethodId = 'pm_test123';
      const customerId = 'cus_test123';
      const mockAttachedPaymentMethod = {
        id: paymentMethodId,
        customer: customerId
      };

      mockStripe.paymentMethods.attach.mockResolvedValue(mockAttachedPaymentMethod);

      const result = await stripeService.attachPaymentMethod(paymentMethodId, customerId);

      expect(mockStripe.paymentMethods.attach).toHaveBeenCalledWith(paymentMethodId, {
        customer: customerId
      });
      expect(result).toEqual(mockAttachedPaymentMethod);
    });
  });

  describe('Checkout Sessions', () => {
    it('should create a checkout session', async () => {
      const sessionData = {
        payment_method_types: ['card'],
        line_items: [{
          price: 'price_test123',
          quantity: 1
        }],
        mode: 'subscription',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel'
      };

      const mockSession = {
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/pay/cs_test123'
      };

      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const result = await stripeService.createCheckoutSession(sessionData);

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(sessionData);
      expect(result).toEqual(mockSession);
    });

    it('should retrieve a checkout session', async () => {
      const sessionId = 'cs_test123';
      const mockSession = {
        id: sessionId,
        payment_status: 'paid',
        customer: 'cus_test123'
      };

      mockStripe.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      const result = await stripeService.getCheckoutSession(sessionId);

      expect(mockStripe.checkout.sessions.retrieve).toHaveBeenCalledWith(sessionId);
      expect(result).toEqual(mockSession);
    });
  });

  describe('Error Handling', () => {
    it('should handle Stripe API errors gracefully', async () => {
      const stripeError = new Error('Stripe API Error');
      stripeError.type = 'StripeCardError';
      stripeError.code = 'card_declined';

      mockStripe.customers.create.mockRejectedValue(stripeError);

      await expect(stripeService.createCustomer({})).rejects.toThrow('Stripe API Error');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      mockStripe.customers.retrieve.mockRejectedValue(networkError);

      await expect(stripeService.getCustomer('cus_test123')).rejects.toThrow('Network Error');
    });
  });

  describe('Webhook Handling', () => {
    it('should handle webhook events', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test123',
            customer: 'cus_test123'
          }
        }
      };

      mockStripe.events.retrieve.mockResolvedValue(mockEvent);

      const result = await stripeService.getEvent('evt_test123');

      expect(mockStripe.events.retrieve).toHaveBeenCalledWith('evt_test123');
      expect(result).toEqual(mockEvent);
    });
  });
});