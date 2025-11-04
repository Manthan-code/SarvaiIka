/**
 * Mock Stripe client for backend testing
 * Prevents actual payment processing and provides test data
 */

class MockStripe {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.config = config;

    this.customers = {
      create: jest.fn().mockResolvedValue({
        id: 'cus_mock_customer_id',
        email: 'test@example.com',
        created: Math.floor(Date.now() / 1000),
        metadata: {}
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'cus_mock_customer_id',
        email: 'test@example.com',
        created: Math.floor(Date.now() / 1000),
        metadata: {}
      }),
      update: jest.fn().mockResolvedValue({
        id: 'cus_mock_customer_id',
        email: 'updated@example.com',
        created: Math.floor(Date.now() / 1000),
        metadata: {}
      }),
      del: jest.fn().mockResolvedValue({
        id: 'cus_mock_customer_id',
        deleted: true
      })
    };

    this.subscriptions = {
      create: jest.fn().mockResolvedValue({
        id: 'sub_mock_subscription_id',
        customer: 'cus_mock_customer_id',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days
        items: {
          data: [{
            id: 'si_mock_item_id',
            price: {
              id: 'price_mock_price_id',
              unit_amount: 2000,
              currency: 'usd'
            }
          }]
        }
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'sub_mock_subscription_id',
        customer: 'cus_mock_customer_id',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000
      }),
      update: jest.fn().mockResolvedValue({
        id: 'sub_mock_subscription_id',
        customer: 'cus_mock_customer_id',
        status: 'active'
      }),
      cancel: jest.fn().mockResolvedValue({
        id: 'sub_mock_subscription_id',
        status: 'canceled'
      })
    };

    this.prices = {
      list: jest.fn().mockResolvedValue({
        data: [{
          id: 'price_mock_price_id',
          unit_amount: 2000,
          currency: 'usd',
          recurring: {
            interval: 'month'
          }
        }]
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'price_mock_price_id',
        unit_amount: 2000,
        currency: 'usd',
        recurring: {
          interval: 'month'
        }
      })
    };

    this.products = {
      list: jest.fn().mockResolvedValue({
        data: [{
          id: 'prod_mock_product_id',
          name: 'Mock Product',
          description: 'Mock product for testing'
        }]
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'prod_mock_product_id',
        name: 'Mock Product',
        description: 'Mock product for testing'
      })
    };

    this.paymentIntents = {
      create: jest.fn().mockResolvedValue({
        id: 'pi_mock_payment_intent_id',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        client_secret: 'pi_mock_payment_intent_id_secret_mock'
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_mock_payment_intent_id',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded'
      }),
      confirm: jest.fn().mockResolvedValue({
        id: 'pi_mock_payment_intent_id',
        status: 'succeeded'
      })
    };

    this.checkout = {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_mock_session_id',
          url: 'https://checkout.stripe.com/pay/cs_mock_session_id',
          payment_status: 'unpaid',
          customer: 'cus_mock_customer_id'
        }),
        retrieve: jest.fn().mockResolvedValue({
          id: 'cs_mock_session_id',
          payment_status: 'paid',
          customer: 'cus_mock_customer_id',
          subscription: 'sub_mock_subscription_id'
        })
      }
    };

    this.webhooks = {
      constructEvent: jest.fn().mockImplementation((payload, signature, secret) => {
        return {
          id: 'evt_mock_event_id',
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_mock_session_id',
              customer: 'cus_mock_customer_id',
              subscription: 'sub_mock_subscription_id'
            }
          },
          created: Math.floor(Date.now() / 1000)
        };
      })
    };

    this.invoices = {
      list: jest.fn().mockResolvedValue({
        data: [{
          id: 'in_mock_invoice_id',
          customer: 'cus_mock_customer_id',
          amount_paid: 2000,
          status: 'paid'
        }]
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'in_mock_invoice_id',
        customer: 'cus_mock_customer_id',
        amount_paid: 2000,
        status: 'paid'
      })
    };
  }

  static mockReset() {
    jest.clearAllMocks();
  }
}

module.exports = MockStripe;
module.exports.default = MockStripe;