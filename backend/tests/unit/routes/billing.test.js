/**
 * Billing Routes Unit Tests
 * Comprehensive tests for billing route handlers
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const request = require('supertest');
const express = require('express');

// Mock dependencies
const mockBillingController = {
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
  getUsageMetrics: jest.fn(),
  generateBillingReport: jest.fn()
};

const mockAuth = {
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'user_123', email: 'test@example.com' };
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next()),
  rateLimitByUser: jest.fn((req, res, next) => next())
};

const mockValidation = {
  validatePagination: jest.fn((req, res, next) => next()),
  validatePaymentMethod: jest.fn((req, res, next) => next()),
  validateBillingAddress: jest.fn((req, res, next) => next()),
  validateDateRange: jest.fn((req, res, next) => next()),
  validateInvoiceId: jest.fn((req, res, next) => next())
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

jest.mock('../../../src/controllers/billingController', () => mockBillingController);
jest.mock('../../../src/middleware/auth', () => mockAuth);
jest.mock('../../../src/middleware/validation', () => mockValidation);
jest.mock('../../../src/utils/logger', () => mockLogger);

// Create Express app with routes
const app = express();
app.use(express.json());

// Import and use routes after mocking
const billingRoutes = require('../../../src/routes/billing');
app.use('/api/billing', billingRoutes);

describe('Billing Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/billing/history', () => {
    it('should get billing history successfully', async () => {
      const mockHistory = {
        transactions: [
          {
            id: 'txn_123',
            amount: 2999,
            currency: 'usd',
            status: 'succeeded',
            created: '2024-01-01T00:00:00Z',
            description: 'Pro Plan Subscription'
          },
          {
            id: 'txn_124',
            amount: 2999,
            currency: 'usd',
            status: 'succeeded',
            created: '2023-12-01T00:00:00Z',
            description: 'Pro Plan Subscription'
          }
        ],
        total: 2,
        page: 1,
        limit: 10,
        has_more: false
      };

      mockBillingController.getBillingHistory.mockImplementation((req, res) => {
        res.status(200).json(mockHistory);
      });

      const response = await request(app)
        .get('/api/billing/history')
        .expect(200);

      expect(response.body).toEqual(mockHistory);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockValidation.validatePagination).toHaveBeenCalled();
      expect(mockBillingController.getBillingHistory).toHaveBeenCalled();
    });

    it('should handle pagination parameters', async () => {
      mockBillingController.getBillingHistory.mockImplementation((req, res) => {
        expect(req.query.page).toBe('2');
        expect(req.query.limit).toBe('5');
        res.status(200).json({
          transactions: [],
          total: 20,
          page: 2,
          limit: 5,
          has_more: true
        });
      });

      await request(app)
        .get('/api/billing/history?page=2&limit=5')
        .expect(200);
    });

    it('should handle date range filtering', async () => {
      mockBillingController.getBillingHistory.mockImplementation((req, res) => {
        expect(req.query.start_date).toBe('2024-01-01');
        expect(req.query.end_date).toBe('2024-01-31');
        res.status(200).json({
          transactions: [],
          total: 0,
          page: 1,
          limit: 10,
          has_more: false
        });
      });

      await request(app)
        .get('/api/billing/history?start_date=2024-01-01&end_date=2024-01-31')
        .expect(200);
    });

    it('should require authentication', async () => {
      mockAuth.authenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      await request(app)
        .get('/api/billing/history')
        .expect(401);
    });

    it('should validate pagination parameters', async () => {
      mockValidation.validatePagination.mockImplementation((req, res, next) => {
        res.status(400).json({ error: 'Invalid pagination parameters' });
      });

      await request(app)
        .get('/api/billing/history?page=-1&limit=0')
        .expect(400);
    });

    it('should handle empty billing history', async () => {
      mockBillingController.getBillingHistory.mockImplementation((req, res) => {
        res.status(200).json({
          transactions: [],
          total: 0,
          page: 1,
          limit: 10,
          has_more: false
        });
      });

      const response = await request(app)
        .get('/api/billing/history')
        .expect(200);

      expect(response.body.transactions).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should handle billing service errors', async () => {
      mockBillingController.getBillingHistory.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Failed to retrieve billing history' });
      });

      await request(app)
        .get('/api/billing/history')
        .expect(500);
    });
  });

  describe('GET /api/billing/invoices', () => {
    it('should get invoices successfully', async () => {
      const mockInvoices = {
        invoices: [
          {
            id: 'in_123',
            number: 'INV-001',
            amount_paid: 2999,
            currency: 'usd',
            status: 'paid',
            created: '2024-01-01T00:00:00Z',
            pdf: 'https://invoice.stripe.com/pdf'
          }
        ],
        total: 1,
        page: 1,
        limit: 10
      };

      mockBillingController.getInvoices.mockImplementation((req, res) => {
        res.status(200).json(mockInvoices);
      });

      const response = await request(app)
        .get('/api/billing/invoices')
        .expect(200);

      expect(response.body).toEqual(mockInvoices);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockValidation.validatePagination).toHaveBeenCalled();
      expect(mockBillingController.getInvoices).toHaveBeenCalled();
    });

    it('should filter invoices by status', async () => {
      mockBillingController.getInvoices.mockImplementation((req, res) => {
        expect(req.query.status).toBe('paid');
        res.status(200).json({
          invoices: [{ id: 'in_123', status: 'paid' }],
          total: 1,
          page: 1,
          limit: 10
        });
      });

      await request(app)
        .get('/api/billing/invoices?status=paid')
        .expect(200);
    });

    it('should handle empty invoices list', async () => {
      mockBillingController.getInvoices.mockImplementation((req, res) => {
        res.status(200).json({
          invoices: [],
          total: 0,
          page: 1,
          limit: 10
        });
      });

      const response = await request(app)
        .get('/api/billing/invoices')
        .expect(200);

      expect(response.body.invoices).toEqual([]);
    });
  });

  describe('GET /api/billing/invoices/:invoiceId', () => {
    it('should get specific invoice successfully', async () => {
      const mockInvoice = {
        id: 'in_123',
        number: 'INV-001',
        amount_paid: 2999,
        currency: 'usd',
        status: 'paid',
        created: '2024-01-01T00:00:00Z',
        lines: [
          {
            description: 'Pro Plan Subscription',
            amount: 2999,
            quantity: 1
          }
        ]
      };

      mockBillingController.getInvoice.mockImplementation((req, res) => {
        res.status(200).json(mockInvoice);
      });

      const response = await request(app)
        .get('/api/billing/invoices/in_123')
        .expect(200);

      expect(response.body).toEqual(mockInvoice);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockValidation.validateInvoiceId).toHaveBeenCalled();
      expect(mockBillingController.getInvoice).toHaveBeenCalled();
    });

    it('should handle invoice not found', async () => {
      mockBillingController.getInvoice.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Invoice not found' });
      });

      await request(app)
        .get('/api/billing/invoices/nonexistent')
        .expect(404);
    });

    it('should validate invoice ID format', async () => {
      mockValidation.validateInvoiceId.mockImplementation((req, res, next) => {
        res.status(400).json({ error: 'Invalid invoice ID format' });
      });

      await request(app)
        .get('/api/billing/invoices/invalid@id')
        .expect(400);
    });

    it('should handle unauthorized access to invoice', async () => {
      mockBillingController.getInvoice.mockImplementation((req, res) => {
        res.status(403).json({ error: 'Unauthorized access to invoice' });
      });

      await request(app)
        .get('/api/billing/invoices/in_123')
        .expect(403);
    });
  });

  describe('GET /api/billing/invoices/:invoiceId/download', () => {
    it('should download invoice PDF successfully', async () => {
      const mockPdfBuffer = Buffer.from('PDF content');

      mockBillingController.downloadInvoice.mockImplementation((req, res) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="invoice-in_123.pdf"');
        res.status(200).send(mockPdfBuffer);
      });

      const response = await request(app)
        .get('/api/billing/invoices/in_123/download')
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockBillingController.downloadInvoice).toHaveBeenCalled();
    });

    it('should handle PDF generation errors', async () => {
      mockBillingController.downloadInvoice.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Failed to generate PDF' });
      });

      await request(app)
        .get('/api/billing/invoices/in_123/download')
        .expect(500);
    });

    it('should handle invoice not available for download', async () => {
      mockBillingController.downloadInvoice.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Invoice PDF not available' });
      });

      await request(app)
        .get('/api/billing/invoices/in_123/download')
        .expect(404);
    });
  });

  describe('GET /api/billing/payment-methods', () => {
    it('should get payment methods successfully', async () => {
      const mockPaymentMethods = {
        payment_methods: [
          {
            id: 'pm_123',
            type: 'card',
            card: {
              brand: 'visa',
              last4: '4242',
              exp_month: 12,
              exp_year: 2025
            },
            is_default: true
          }
        ],
        total: 1
      };

      mockBillingController.getPaymentMethods.mockImplementation((req, res) => {
        res.status(200).json(mockPaymentMethods);
      });

      const response = await request(app)
        .get('/api/billing/payment-methods')
        .expect(200);

      expect(response.body).toEqual(mockPaymentMethods);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockBillingController.getPaymentMethods).toHaveBeenCalled();
    });

    it('should handle empty payment methods list', async () => {
      mockBillingController.getPaymentMethods.mockImplementation((req, res) => {
        res.status(200).json({
          payment_methods: [],
          total: 0
        });
      });

      const response = await request(app)
        .get('/api/billing/payment-methods')
        .expect(200);

      expect(response.body.payment_methods).toEqual([]);
    });
  });

  describe('POST /api/billing/payment-methods', () => {
    it('should add payment method successfully', async () => {
      const mockPaymentMethod = {
        id: 'pm_123',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2025
        },
        is_default: false
      };

      mockBillingController.addPaymentMethod.mockImplementation((req, res) => {
        res.status(201).json(mockPaymentMethod);
      });

      const response = await request(app)
        .post('/api/billing/payment-methods')
        .send({
          payment_method_id: 'pm_123',
          set_as_default: false
        })
        .expect(201);

      expect(response.body).toEqual(mockPaymentMethod);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockValidation.validatePaymentMethod).toHaveBeenCalled();
      expect(mockBillingController.addPaymentMethod).toHaveBeenCalled();
    });

    it('should validate payment method data', async () => {
      mockValidation.validatePaymentMethod.mockImplementation((req, res, next) => {
        res.status(400).json({ error: 'Invalid payment method data' });
      });

      await request(app)
        .post('/api/billing/payment-methods')
        .send({ payment_method_id: '' })
        .expect(400);
    });

    it('should handle payment method attachment errors', async () => {
      mockBillingController.addPaymentMethod.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Failed to attach payment method' });
      });

      await request(app)
        .post('/api/billing/payment-methods')
        .send({ payment_method_id: 'pm_invalid' })
        .expect(400);
    });
  });

  describe('PUT /api/billing/payment-methods/:paymentMethodId', () => {
    it('should update payment method successfully', async () => {
      const updatedPaymentMethod = {
        id: 'pm_123',
        billing_details: {
          name: 'John Doe',
          email: 'john@example.com'
        }
      };

      mockBillingController.updatePaymentMethod.mockImplementation((req, res) => {
        res.status(200).json(updatedPaymentMethod);
      });

      const response = await request(app)
        .put('/api/billing/payment-methods/pm_123')
        .send({
          billing_details: {
            name: 'John Doe',
            email: 'john@example.com'
          }
        })
        .expect(200);

      expect(response.body).toEqual(updatedPaymentMethod);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockBillingController.updatePaymentMethod).toHaveBeenCalled();
    });

    it('should handle payment method not found for update', async () => {
      mockBillingController.updatePaymentMethod.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Payment method not found' });
      });

      await request(app)
        .put('/api/billing/payment-methods/nonexistent')
        .send({ billing_details: { name: 'John Doe' } })
        .expect(404);
    });
  });

  describe('DELETE /api/billing/payment-methods/:paymentMethodId', () => {
    it('should delete payment method successfully', async () => {
      mockBillingController.deletePaymentMethod.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Payment method deleted successfully' });
      });

      const response = await request(app)
        .delete('/api/billing/payment-methods/pm_123')
        .expect(200);

      expect(response.body.message).toBe('Payment method deleted successfully');
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockBillingController.deletePaymentMethod).toHaveBeenCalled();
    });

    it('should handle payment method not found for deletion', async () => {
      mockBillingController.deletePaymentMethod.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Payment method not found' });
      });

      await request(app)
        .delete('/api/billing/payment-methods/nonexistent')
        .expect(404);
    });

    it('should handle deletion of default payment method', async () => {
      mockBillingController.deletePaymentMethod.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Cannot delete default payment method' });
      });

      await request(app)
        .delete('/api/billing/payment-methods/pm_123')
        .expect(400);
    });
  });

  describe('POST /api/billing/payment-methods/:paymentMethodId/default', () => {
    it('should set default payment method successfully', async () => {
      mockBillingController.setDefaultPaymentMethod.mockImplementation((req, res) => {
        res.status(200).json({ 
          message: 'Default payment method updated',
          payment_method_id: 'pm_123'
        });
      });

      const response = await request(app)
        .post('/api/billing/payment-methods/pm_123/default')
        .expect(200);

      expect(response.body.message).toBe('Default payment method updated');
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockBillingController.setDefaultPaymentMethod).toHaveBeenCalled();
    });

    it('should handle payment method not found for default setting', async () => {
      mockBillingController.setDefaultPaymentMethod.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Payment method not found' });
      });

      await request(app)
        .post('/api/billing/payment-methods/nonexistent/default')
        .expect(404);
    });
  });

  describe('GET /api/billing/address', () => {
    it('should get billing address successfully', async () => {
      const mockAddress = {
        line1: '123 Main St',
        line2: 'Apt 4B',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'US'
      };

      mockBillingController.getBillingAddress.mockImplementation((req, res) => {
        res.status(200).json(mockAddress);
      });

      const response = await request(app)
        .get('/api/billing/address')
        .expect(200);

      expect(response.body).toEqual(mockAddress);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockBillingController.getBillingAddress).toHaveBeenCalled();
    });

    it('should handle no billing address found', async () => {
      mockBillingController.getBillingAddress.mockImplementation((req, res) => {
        res.status(404).json({ error: 'No billing address found' });
      });

      await request(app)
        .get('/api/billing/address')
        .expect(404);
    });
  });

  describe('PUT /api/billing/address', () => {
    it('should update billing address successfully', async () => {
      const updatedAddress = {
        line1: '456 Oak Ave',
        city: 'San Francisco',
        state: 'CA',
        postal_code: '94102',
        country: 'US'
      };

      mockBillingController.updateBillingAddress.mockImplementation((req, res) => {
        res.status(200).json(updatedAddress);
      });

      const response = await request(app)
        .put('/api/billing/address')
        .send(updatedAddress)
        .expect(200);

      expect(response.body).toEqual(updatedAddress);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockValidation.validateBillingAddress).toHaveBeenCalled();
      expect(mockBillingController.updateBillingAddress).toHaveBeenCalled();
    });

    it('should validate billing address data', async () => {
      mockValidation.validateBillingAddress.mockImplementation((req, res, next) => {
        res.status(400).json({ error: 'Invalid billing address data' });
      });

      await request(app)
        .put('/api/billing/address')
        .send({ line1: '', country: 'INVALID' })
        .expect(400);
    });
  });

  describe('GET /api/billing/usage', () => {
    it('should get usage metrics successfully', async () => {
      const mockUsage = {
        current_period: {
          start: '2024-01-01',
          end: '2024-02-01',
          usage: {
            api_calls: 1500,
            tokens_used: 50000,
            storage_gb: 2.5
          },
          limits: {
            api_calls: 5000,
            tokens_used: 100000,
            storage_gb: 10
          }
        },
        historical: [
          {
            period: '2023-12',
            usage: { api_calls: 1200, tokens_used: 40000 }
          }
        ]
      };

      mockBillingController.getUsageMetrics.mockImplementation((req, res) => {
        res.status(200).json(mockUsage);
      });

      const response = await request(app)
        .get('/api/billing/usage')
        .expect(200);

      expect(response.body).toEqual(mockUsage);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockBillingController.getUsageMetrics).toHaveBeenCalled();
    });

    it('should handle date range for usage metrics', async () => {
      mockBillingController.getUsageMetrics.mockImplementation((req, res) => {
        expect(req.query.start_date).toBe('2024-01-01');
        expect(req.query.end_date).toBe('2024-01-31');
        res.status(200).json({ usage: {} });
      });

      await request(app)
        .get('/api/billing/usage?start_date=2024-01-01&end_date=2024-01-31')
        .expect(200);
    });

    it('should validate date range', async () => {
      mockValidation.validateDateRange.mockImplementation((req, res, next) => {
        res.status(400).json({ error: 'Invalid date range' });
      });

      await request(app)
        .get('/api/billing/usage?start_date=invalid&end_date=2024-01-31')
        .expect(400);
    });
  });

  describe('POST /api/billing/reports', () => {
    it('should generate billing report successfully', async () => {
      const mockReport = {
        report_id: 'rpt_123',
        status: 'completed',
        download_url: 'https://example.com/reports/rpt_123.pdf',
        generated_at: '2024-01-01T12:00:00Z'
      };

      mockBillingController.generateBillingReport.mockImplementation((req, res) => {
        res.status(200).json(mockReport);
      });

      const response = await request(app)
        .post('/api/billing/reports')
        .send({
          type: 'monthly',
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        })
        .expect(200);

      expect(response.body).toEqual(mockReport);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockValidation.validateDateRange).toHaveBeenCalled();
      expect(mockBillingController.generateBillingReport).toHaveBeenCalled();
    });

    it('should handle report generation errors', async () => {
      mockBillingController.generateBillingReport.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Failed to generate report' });
      });

      await request(app)
        .post('/api/billing/reports')
        .send({ type: 'monthly' })
        .expect(500);
    });
  });

  describe('Route Security', () => {
    it('should require authentication for all routes', async () => {
      mockAuth.authenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      // Test all protected routes
      await request(app).get('/api/billing/history').expect(401);
      await request(app).get('/api/billing/invoices').expect(401);
      await request(app).get('/api/billing/payment-methods').expect(401);
      await request(app).post('/api/billing/payment-methods').expect(401);
      await request(app).get('/api/billing/address').expect(401);
      await request(app).put('/api/billing/address').expect(401);
      await request(app).get('/api/billing/usage').expect(401);
      await request(app).post('/api/billing/reports').expect(401);
    });

    it('should apply rate limiting to sensitive operations', async () => {
      mockAuth.rateLimitByUser.mockImplementation((req, res, next) => {
        res.status(429).json({ 
          error: 'Rate limit exceeded',
          retryAfter: 60
        });
      });

      await request(app)
        .post('/api/billing/payment-methods')
        .send({ payment_method_id: 'pm_123' })
        .expect(429);
    });
  });

  describe('Error Handling', () => {
    it('should handle controller exceptions', async () => {
      mockBillingController.getBillingHistory.mockImplementation((req, res) => {
        throw new Error('Controller error');
      });

      await request(app)
        .get('/api/billing/history')
        .expect(500);
    });

    it('should handle async controller errors', async () => {
      mockBillingController.getInvoices.mockImplementation(async (req, res) => {
        throw new Error('Async controller error');
      });

      await request(app)
        .get('/api/billing/invoices')
        .expect(500);
    });

    it('should handle middleware errors', async () => {
      mockAuth.authenticateToken.mockImplementation((req, res, next) => {
        next(new Error('Auth middleware error'));
      });

      await request(app)
        .get('/api/billing/history')
        .expect(500);
    });
  });

  describe('Input Validation', () => {
    it('should validate pagination parameters', async () => {
      mockValidation.validatePagination.mockImplementation((req, res, next) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        if (page < 1 || limit < 1 || limit > 100) {
          return res.status(400).json({ error: 'Invalid pagination parameters' });
        }
        next();
      });

      await request(app)
        .get('/api/billing/history?page=0&limit=101')
        .expect(400);
    });

    it('should validate date range parameters', async () => {
      mockValidation.validateDateRange.mockImplementation((req, res, next) => {
        const { start_date, end_date } = req.query;
        if (start_date && !Date.parse(start_date)) {
          return res.status(400).json({ error: 'Invalid start date format' });
        }
        if (end_date && !Date.parse(end_date)) {
          return res.status(400).json({ error: 'Invalid end date format' });
        }
        next();
      });

      await request(app)
        .get('/api/billing/history?start_date=invalid-date')
        .expect(400);
    });

    it('should validate payment method data', async () => {
      mockValidation.validatePaymentMethod.mockImplementation((req, res, next) => {
        const { payment_method_id } = req.body;
        if (!payment_method_id || typeof payment_method_id !== 'string') {
          return res.status(400).json({ error: 'Invalid payment method ID' });
        }
        next();
      });

      await request(app)
        .post('/api/billing/payment-methods')
        .send({ payment_method_id: 123 })
        .expect(400);
    });

    it('should validate billing address data', async () => {
      mockValidation.validateBillingAddress.mockImplementation((req, res, next) => {
        const { line1, country } = req.body;
        if (!line1 || !country) {
          return res.status(400).json({ error: 'Address line 1 and country are required' });
        }
        next();
      });

      await request(app)
        .put('/api/billing/address')
        .send({ line1: '', country: '' })
        .expect(400);
    });
  });

  describe('HTTP Methods', () => {
    it('should reject unsupported HTTP methods', async () => {
      await request(app)
        .patch('/api/billing/history')
        .expect(404);

      await request(app)
        .options('/api/billing/invoices')
        .expect(404);
    });

    it('should handle HEAD requests', async () => {
      await request(app)
        .head('/api/billing/history')
        .expect(200);
    });
  });

  describe('Content-Type Handling', () => {
    it('should handle JSON content type', async () => {
      mockBillingController.addPaymentMethod.mockImplementation((req, res) => {
        res.status(201).json({ id: 'pm_123' });
      });

      await request(app)
        .post('/api/billing/payment-methods')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ payment_method_id: 'pm_123' }))
        .expect(201);
    });

    it('should reject non-JSON content types for POST/PUT', async () => {
      await request(app)
        .post('/api/billing/payment-methods')
        .set('Content-Type', 'text/plain')
        .send('payment_method_id=pm_123')
        .expect(400);
    });

    it('should handle PDF content type for downloads', async () => {
      mockBillingController.downloadInvoice.mockImplementation((req, res) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.status(200).send(Buffer.from('PDF content'));
      });

      const response = await request(app)
        .get('/api/billing/invoices/in_123/download')
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
    });
  });
});