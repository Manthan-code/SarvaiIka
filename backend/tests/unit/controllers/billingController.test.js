/**
 * Billing Controller Unit Tests
 * Comprehensive tests for billing controller functionality
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock services
const mockBillingService = {
  getBillingHistory: jest.fn(),
  getInvoices: jest.fn(),
  getInvoice: jest.fn(),
  downloadInvoice: jest.fn(),
  getPaymentMethods: jest.fn(),
  addPaymentMethod: jest.fn(),
  updatePaymentMethod: jest.fn(),
  deletePaymentMethod: jest.fn(),
  setDefaultPaymentMethod: jest.fn(),
  getBillingAddress: jest.fn(),
  updateBillingAddress: jest.fn(),
  getUsageData: jest.fn(),
  generateReport: jest.fn()
};

const mockStripeService = {
  getCustomer: jest.fn(),
  listInvoices: jest.fn(),
  getInvoice: jest.fn(),
  listPaymentMethods: jest.fn(),
  createPaymentMethod: jest.fn(),
  attachPaymentMethod: jest.fn(),
  detachPaymentMethod: jest.fn(),
  updateCustomer: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Setup mocks
jest.mock('../../src/services/billingService', () => mockBillingService);
jest.mock('../../src/services/stripeService', () => mockStripeService);
jest.mock('../../src/utils/logger', () => mockLogger);

describe('Billing Controller Unit Tests', () => {
  let billingController;
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear module cache to get fresh instance
    delete require.cache[require.resolve('../../src/controllers/billingController')];
    billingController = require('../../src/controllers/billingController');
    
    // Setup request/response mocks
    req = {
      user: { id: 'user123', stripeCustomerId: 'cus_test123' },
      params: {},
      query: {},
      body: {},
      headers: {}
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getBillingHistory', () => {
    it('should get billing history successfully', async () => {
      const mockHistory = {
        data: [
          { id: 'txn_1', amount: 2000, date: '2023-01-01', description: 'Subscription' },
          { id: 'txn_2', amount: 1500, date: '2023-01-15', description: 'Usage charge' }
        ],
        pagination: { page: 1, limit: 10, total: 2 }
      };

      req.query = { page: '1', limit: '10' };
      mockBillingService.getBillingHistory.mockResolvedValue(mockHistory);

      await billingController.getBillingHistory(req, res, next);

      expect(mockBillingService.getBillingHistory).toHaveBeenCalledWith('user123', {
        page: 1,
        limit: 10
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockHistory.data,
        pagination: mockHistory.pagination
      });
    });

    it('should handle date range filtering', async () => {
      req.query = {
        startDate: '2023-01-01',
        endDate: '2023-01-31',
        page: '1',
        limit: '20'
      };

      const mockHistory = { data: [], pagination: { page: 1, limit: 20, total: 0 } };
      mockBillingService.getBillingHistory.mockResolvedValue(mockHistory);

      await billingController.getBillingHistory(req, res, next);

      expect(mockBillingService.getBillingHistory).toHaveBeenCalledWith('user123', {
        startDate: '2023-01-01',
        endDate: '2023-01-31',
        page: 1,
        limit: 20
      });
    });

    it('should handle invalid pagination parameters', async () => {
      req.query = { page: 'invalid', limit: 'invalid' };

      const mockHistory = { data: [], pagination: { page: 1, limit: 10, total: 0 } };
      mockBillingService.getBillingHistory.mockResolvedValue(mockHistory);

      await billingController.getBillingHistory(req, res, next);

      expect(mockBillingService.getBillingHistory).toHaveBeenCalledWith('user123', {
        page: 1,
        limit: 10
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Service unavailable');
      mockBillingService.getBillingHistory.mockRejectedValue(error);

      await billingController.getBillingHistory(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockLogger.error).toHaveBeenCalledWith('Error getting billing history:', error);
    });

    it('should handle empty billing history', async () => {
      const mockHistory = { data: [], pagination: { page: 1, limit: 10, total: 0 } };
      mockBillingService.getBillingHistory.mockResolvedValue(mockHistory);

      await billingController.getBillingHistory(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0 }
      });
    });

    it('should validate date range', async () => {
      req.query = {
        startDate: '2023-01-31',
        endDate: '2023-01-01' // End date before start date
      };

      await billingController.getBillingHistory(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'End date must be after start date'
      });
    });
  });

  describe('getInvoices', () => {
    it('should get invoices successfully', async () => {
      const mockInvoices = {
        data: [
          { id: 'in_1', amount: 2000, status: 'paid', date: '2023-01-01' },
          { id: 'in_2', amount: 1500, status: 'open', date: '2023-01-15' }
        ],
        pagination: { page: 1, limit: 10, total: 2 }
      };

      req.query = { status: 'all', page: '1', limit: '10' };
      mockBillingService.getInvoices.mockResolvedValue(mockInvoices);

      await billingController.getInvoices(req, res, next);

      expect(mockBillingService.getInvoices).toHaveBeenCalledWith('user123', {
        status: 'all',
        page: 1,
        limit: 10
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockInvoices.data,
        pagination: mockInvoices.pagination
      });
    });

    it('should filter invoices by status', async () => {
      req.query = { status: 'paid' };
      const mockInvoices = { data: [], pagination: { page: 1, limit: 10, total: 0 } };
      mockBillingService.getInvoices.mockResolvedValue(mockInvoices);

      await billingController.getInvoices(req, res, next);

      expect(mockBillingService.getInvoices).toHaveBeenCalledWith('user123', {
        status: 'paid',
        page: 1,
        limit: 10
      });
    });

    it('should handle empty invoice list', async () => {
      const mockInvoices = { data: [], pagination: { page: 1, limit: 10, total: 0 } };
      mockBillingService.getInvoices.mockResolvedValue(mockInvoices);

      await billingController.getInvoices(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0 }
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Service error');
      mockBillingService.getInvoices.mockRejectedValue(error);

      await billingController.getInvoices(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getInvoice', () => {
    it('should get invoice successfully', async () => {
      const invoiceId = 'in_test123';
      const mockInvoice = {
        id: invoiceId,
        amount: 2000,
        status: 'paid',
        date: '2023-01-01',
        items: [{ description: 'Subscription', amount: 2000 }]
      };

      req.params.invoiceId = invoiceId;
      mockBillingService.getInvoice.mockResolvedValue(mockInvoice);

      await billingController.getInvoice(req, res, next);

      expect(mockBillingService.getInvoice).toHaveBeenCalledWith('user123', invoiceId);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockInvoice
      });
    });

    it('should handle invoice not found', async () => {
      const invoiceId = 'in_nonexistent';
      req.params.invoiceId = invoiceId;

      const error = new Error('Invoice not found');
      error.statusCode = 404;
      mockBillingService.getInvoice.mockRejectedValue(error);

      await billingController.getInvoice(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should validate invoice ID format', async () => {
      req.params.invoiceId = 'invalid_id';

      await billingController.getInvoice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid invoice ID format'
      });
    });

    it('should handle unauthorized access', async () => {
      const invoiceId = 'in_test123';
      req.params.invoiceId = invoiceId;

      const error = new Error('Unauthorized access');
      error.statusCode = 403;
      mockBillingService.getInvoice.mockRejectedValue(error);

      await billingController.getInvoice(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('downloadInvoice', () => {
    it('should download invoice successfully', async () => {
      const invoiceId = 'in_test123';
      const mockPdfBuffer = Buffer.from('PDF content');

      req.params.invoiceId = invoiceId;
      mockBillingService.downloadInvoice.mockResolvedValue(mockPdfBuffer);

      await billingController.downloadInvoice(req, res, next);

      expect(mockBillingService.downloadInvoice).toHaveBeenCalledWith('user123', invoiceId);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', `attachment; filename="invoice-${invoiceId}.pdf"`);
      expect(res.send).toHaveBeenCalledWith(mockPdfBuffer);
    });

    it('should handle PDF generation errors', async () => {
      const invoiceId = 'in_test123';
      req.params.invoiceId = invoiceId;

      const error = new Error('PDF generation failed');
      mockBillingService.downloadInvoice.mockRejectedValue(error);

      await billingController.downloadInvoice(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockLogger.error).toHaveBeenCalledWith('Error downloading invoice:', error);
    });

    it('should handle invoice not available for download', async () => {
      const invoiceId = 'in_test123';
      req.params.invoiceId = invoiceId;

      const error = new Error('Invoice not available for download');
      error.statusCode = 400;
      mockBillingService.downloadInvoice.mockRejectedValue(error);

      await billingController.downloadInvoice(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getPaymentMethods', () => {
    it('should get payment methods successfully', async () => {
      const mockPaymentMethods = [
        { id: 'pm_1', type: 'card', card: { last4: '4242', brand: 'visa' }, default: true },
        { id: 'pm_2', type: 'card', card: { last4: '1234', brand: 'mastercard' }, default: false }
      ];

      mockBillingService.getPaymentMethods.mockResolvedValue(mockPaymentMethods);

      await billingController.getPaymentMethods(req, res, next);

      expect(mockBillingService.getPaymentMethods).toHaveBeenCalledWith('user123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockPaymentMethods
      });
    });

    it('should handle empty payment methods list', async () => {
      mockBillingService.getPaymentMethods.mockResolvedValue([]);

      await billingController.getPaymentMethods(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Service error');
      mockBillingService.getPaymentMethods.mockRejectedValue(error);

      await billingController.getPaymentMethods(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('addPaymentMethod', () => {
    it('should add payment method successfully', async () => {
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
        card: { last4: '4242', brand: 'visa' }
      };

      req.body = paymentMethodData;
      mockBillingService.addPaymentMethod.mockResolvedValue(mockPaymentMethod);

      await billingController.addPaymentMethod(req, res, next);

      expect(mockBillingService.addPaymentMethod).toHaveBeenCalledWith('user123', paymentMethodData);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockPaymentMethod
      });
    });

    it('should validate payment method data', async () => {
      req.body = {}; // Missing required fields

      await billingController.addPaymentMethod(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Payment method type is required'
      });
    });

    it('should handle payment method attachment errors', async () => {
      const paymentMethodData = { type: 'card', card: {} };
      req.body = paymentMethodData;

      const error = new Error('Card declined');
      error.statusCode = 400;
      mockBillingService.addPaymentMethod.mockRejectedValue(error);

      await billingController.addPaymentMethod(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should validate card data', async () => {
      req.body = {
        type: 'card',
        card: {
          number: 'invalid',
          exp_month: 13, // Invalid month
          exp_year: 2020, // Past year
          cvc: '12' // Too short
        }
      };

      await billingController.addPaymentMethod(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid card data'
      });
    });
  });

  describe('updatePaymentMethod', () => {
    it('should update payment method successfully', async () => {
      const paymentMethodId = 'pm_test123';
      const updateData = { billing_details: { name: 'Updated Name' } };

      const mockUpdatedPaymentMethod = {
        id: paymentMethodId,
        billing_details: { name: 'Updated Name' }
      };

      req.params.paymentMethodId = paymentMethodId;
      req.body = updateData;
      mockBillingService.updatePaymentMethod.mockResolvedValue(mockUpdatedPaymentMethod);

      await billingController.updatePaymentMethod(req, res, next);

      expect(mockBillingService.updatePaymentMethod).toHaveBeenCalledWith('user123', paymentMethodId, updateData);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedPaymentMethod
      });
    });

    it('should handle payment method not found', async () => {
      const paymentMethodId = 'pm_nonexistent';
      req.params.paymentMethodId = paymentMethodId;
      req.body = { billing_details: { name: 'Test' } };

      const error = new Error('Payment method not found');
      error.statusCode = 404;
      mockBillingService.updatePaymentMethod.mockRejectedValue(error);

      await billingController.updatePaymentMethod(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should validate update data', async () => {
      req.params.paymentMethodId = 'pm_test123';
      req.body = {}; // Empty update data

      await billingController.updatePaymentMethod(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No update data provided'
      });
    });
  });

  describe('deletePaymentMethod', () => {
    it('should delete payment method successfully', async () => {
      const paymentMethodId = 'pm_test123';
      req.params.paymentMethodId = paymentMethodId;

      mockBillingService.deletePaymentMethod.mockResolvedValue({ deleted: true });

      await billingController.deletePaymentMethod(req, res, next);

      expect(mockBillingService.deletePaymentMethod).toHaveBeenCalledWith('user123', paymentMethodId);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment method deleted successfully'
      });
    });

    it('should handle payment method not found', async () => {
      const paymentMethodId = 'pm_nonexistent';
      req.params.paymentMethodId = paymentMethodId;

      const error = new Error('Payment method not found');
      error.statusCode = 404;
      mockBillingService.deletePaymentMethod.mockRejectedValue(error);

      await billingController.deletePaymentMethod(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle default payment method deletion', async () => {
      const paymentMethodId = 'pm_test123';
      req.params.paymentMethodId = paymentMethodId;

      const error = new Error('Cannot delete default payment method');
      error.statusCode = 400;
      mockBillingService.deletePaymentMethod.mockRejectedValue(error);

      await billingController.deletePaymentMethod(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('should set default payment method successfully', async () => {
      const paymentMethodId = 'pm_test123';
      req.params.paymentMethodId = paymentMethodId;

      const mockUpdatedCustomer = {
        id: 'cus_test123',
        invoice_settings: { default_payment_method: paymentMethodId }
      };

      mockBillingService.setDefaultPaymentMethod.mockResolvedValue(mockUpdatedCustomer);

      await billingController.setDefaultPaymentMethod(req, res, next);

      expect(mockBillingService.setDefaultPaymentMethod).toHaveBeenCalledWith('user123', paymentMethodId);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Default payment method updated successfully'
      });
    });

    it('should handle payment method not found', async () => {
      const paymentMethodId = 'pm_nonexistent';
      req.params.paymentMethodId = paymentMethodId;

      const error = new Error('Payment method not found');
      error.statusCode = 404;
      mockBillingService.setDefaultPaymentMethod.mockRejectedValue(error);

      await billingController.setDefaultPaymentMethod(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getBillingAddress', () => {
    it('should get billing address successfully', async () => {
      const mockAddress = {
        line1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'US'
      };

      mockBillingService.getBillingAddress.mockResolvedValue(mockAddress);

      await billingController.getBillingAddress(req, res, next);

      expect(mockBillingService.getBillingAddress).toHaveBeenCalledWith('user123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAddress
      });
    });

    it('should handle no billing address found', async () => {
      mockBillingService.getBillingAddress.mockResolvedValue(null);

      await billingController.getBillingAddress(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No billing address found'
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Service error');
      mockBillingService.getBillingAddress.mockRejectedValue(error);

      await billingController.getBillingAddress(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateBillingAddress', () => {
    it('should update billing address successfully', async () => {
      const addressData = {
        line1: '456 Oak St',
        city: 'Los Angeles',
        state: 'CA',
        postal_code: '90210',
        country: 'US'
      };

      const mockUpdatedAddress = { ...addressData, id: 'addr_test123' };

      req.body = addressData;
      mockBillingService.updateBillingAddress.mockResolvedValue(mockUpdatedAddress);

      await billingController.updateBillingAddress(req, res, next);

      expect(mockBillingService.updateBillingAddress).toHaveBeenCalledWith('user123', addressData);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedAddress
      });
    });

    it('should validate billing address data', async () => {
      req.body = {}; // Missing required fields

      await billingController.updateBillingAddress(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Address line 1 is required'
      });
    });

    it('should validate country code', async () => {
      req.body = {
        line1: '123 Main St',
        city: 'Test City',
        country: 'INVALID'
      };

      await billingController.updateBillingAddress(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid country code'
      });
    });

    it('should handle service errors', async () => {
      const addressData = {
        line1: '123 Main St',
        city: 'Test City',
        country: 'US'
      };

      req.body = addressData;
      const error = new Error('Update failed');
      mockBillingService.updateBillingAddress.mockRejectedValue(error);

      await billingController.updateBillingAddress(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getUsageData', () => {
    it('should get usage data successfully', async () => {
      const mockUsageData = {
        current_period: {
          start: '2023-01-01',
          end: '2023-01-31',
          usage: {
            api_calls: 1500,
            storage_gb: 2.5,
            bandwidth_gb: 10.2
          }
        },
        billing_cycle: 'monthly',
        limits: {
          api_calls: 10000,
          storage_gb: 100,
          bandwidth_gb: 1000
        }
      };

      req.query = { period: 'current' };
      mockBillingService.getUsageData.mockResolvedValue(mockUsageData);

      await billingController.getUsageData(req, res, next);

      expect(mockBillingService.getUsageData).toHaveBeenCalledWith('user123', { period: 'current' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUsageData
      });
    });

    it('should handle date range queries', async () => {
      req.query = {
        startDate: '2023-01-01',
        endDate: '2023-01-31'
      };

      const mockUsageData = { usage: {}, period: 'custom' };
      mockBillingService.getUsageData.mockResolvedValue(mockUsageData);

      await billingController.getUsageData(req, res, next);

      expect(mockBillingService.getUsageData).toHaveBeenCalledWith('user123', {
        startDate: '2023-01-01',
        endDate: '2023-01-31'
      });
    });

    it('should validate date range', async () => {
      req.query = {
        startDate: '2023-01-31',
        endDate: '2023-01-01'
      };

      await billingController.getUsageData(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'End date must be after start date'
      });
    });

    it('should handle usage tracking errors', async () => {
      const error = new Error('Usage tracking unavailable');
      mockBillingService.getUsageData.mockRejectedValue(error);

      await billingController.getUsageData(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('generateReport', () => {
    it('should generate billing report successfully', async () => {
      const reportData = {
        type: 'monthly',
        format: 'pdf',
        period: '2023-01'
      };

      const mockReport = {
        id: 'report_test123',
        url: 'https://example.com/reports/report_test123.pdf',
        status: 'completed'
      };

      req.body = reportData;
      mockBillingService.generateReport.mockResolvedValue(mockReport);

      await billingController.generateReport(req, res, next);

      expect(mockBillingService.generateReport).toHaveBeenCalledWith('user123', reportData);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReport
      });
    });

    it('should validate report parameters', async () => {
      req.body = {}; // Missing required fields

      await billingController.generateReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Report type is required'
      });
    });

    it('should validate report format', async () => {
      req.body = {
        type: 'monthly',
        format: 'invalid',
        period: '2023-01'
      };

      await billingController.generateReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid report format. Supported formats: pdf, csv, xlsx'
      });
    });

    it('should handle report generation errors', async () => {
      const reportData = {
        type: 'monthly',
        format: 'pdf',
        period: '2023-01'
      };

      req.body = reportData;
      const error = new Error('Report generation failed');
      mockBillingService.generateReport.mockRejectedValue(error);

      await billingController.generateReport(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockLogger.error).toHaveBeenCalledWith('Error generating report:', error);
    });
  });

  describe('Input Validation', () => {
    it('should validate pagination parameters', async () => {
      req.query = { page: '-1', limit: '0' };

      const mockHistory = { data: [], pagination: { page: 1, limit: 10, total: 0 } };
      mockBillingService.getBillingHistory.mockResolvedValue(mockHistory);

      await billingController.getBillingHistory(req, res, next);

      expect(mockBillingService.getBillingHistory).toHaveBeenCalledWith('user123', {
        page: 1,
        limit: 10
      });
    });

    it('should limit maximum page size', async () => {
      req.query = { limit: '1000' }; // Exceeds maximum

      const mockHistory = { data: [], pagination: { page: 1, limit: 100, total: 0 } };
      mockBillingService.getBillingHistory.mockResolvedValue(mockHistory);

      await billingController.getBillingHistory(req, res, next);

      expect(mockBillingService.getBillingHistory).toHaveBeenCalledWith('user123', {
        page: 1,
        limit: 100 // Capped at maximum
      });
    });

    it('should validate date formats', async () => {
      req.query = {
        startDate: 'invalid-date',
        endDate: '2023-01-31'
      };

      await billingController.getBillingHistory(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date format'
      });
    });

    it('should sanitize input data', async () => {
      req.body = {
        line1: '<script>alert("xss")</script>123 Main St',
        city: 'New York',
        country: 'US'
      };

      const sanitizedData = {
        line1: '123 Main St',
        city: 'New York',
        country: 'US'
      };

      mockBillingService.updateBillingAddress.mockResolvedValue(sanitizedData);

      await billingController.updateBillingAddress(req, res, next);

      expect(mockBillingService.updateBillingAddress).toHaveBeenCalledWith('user123', sanitizedData);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      req.user = null; // No authenticated user

      await billingController.getBillingHistory(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
    });

    it('should handle authorization errors', async () => {
      const error = new Error('Insufficient permissions');
      error.statusCode = 403;
      mockBillingService.getBillingHistory.mockRejectedValue(error);

      await billingController.getBillingHistory(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle rate limiting errors', async () => {
      const error = new Error('Rate limit exceeded');
      error.statusCode = 429;
      mockBillingService.getBillingHistory.mockRejectedValue(error);

      await billingController.getBillingHistory(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle service unavailable errors', async () => {
      const error = new Error('Service temporarily unavailable');
      error.statusCode = 503;
      mockBillingService.getBillingHistory.mockRejectedValue(error);

      await billingController.getBillingHistory(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('Response Formatting', () => {
    it('should format successful responses consistently', async () => {
      const mockData = { test: 'data' };
      mockBillingService.getBillingHistory.mockResolvedValue({
        data: [mockData],
        pagination: { page: 1, limit: 10, total: 1 }
      });

      await billingController.getBillingHistory(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [mockData],
        pagination: { page: 1, limit: 10, total: 1 }
      });
    });

    it('should include metadata in responses', async () => {
      const mockData = { id: 'test123' };
      mockBillingService.getInvoice.mockResolvedValue(mockData);

      req.params.invoiceId = 'in_test123';
      await billingController.getInvoice(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockData
      });
    });

    it('should handle empty data responses', async () => {
      mockBillingService.getPaymentMethods.mockResolvedValue([]);

      await billingController.getPaymentMethods(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });
  });
});