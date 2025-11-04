const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('../config/logger');

/**
 * Validate Stripe webhook signature
 * Ensures webhooks are actually from Stripe and haven't been tampered with
 */
const validateStripeWebhook = (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook configuration error' });
  }

  if (!sig) {
    logger.error('Missing Stripe signature header');
    return res.status(400).json({ error: 'Missing webhook signature' });
  }

  try {
    // Construct and verify the event using Stripe's built-in verification
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      endpointSecret
    );
    
    // Attach the verified event to the request object
    req.stripeEvent = event;
    
    logger.info('Webhook signature verified:', { 
      type: event.type, 
      id: event.id,
      created: event.created
    });
    
    next();
  } catch (err) {
    logger.error('Webhook signature verification failed:', {
      error: err.message,
      signature: sig ? 'present' : 'missing',
      hasSecret: !!endpointSecret
    });
    
    return res.status(400).json({ 
      error: 'Webhook signature verification failed',
      details: err.message
    });
  }
};

/**
 * Development webhook middleware for Stripe CLI
 * Uses different webhook secret for local development
 */
const validateStripeWebhookDev = (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_CLI_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    logger.error('No webhook secret configured for development');
    return res.status(500).json({ error: 'Development webhook configuration error' });
  }

  if (!sig) {
    logger.error('Missing Stripe signature header in development');
    return res.status(400).json({ error: 'Missing webhook signature' });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      endpointSecret
    );
    
    req.stripeEvent = event;
    
    logger.info('Development webhook signature verified:', { 
      type: event.type, 
      id: event.id,
      environment: 'development'
    });
    
    next();
  } catch (err) {
    logger.error('Development webhook signature verification failed:', {
      error: err.message,
      signature: sig ? 'present' : 'missing'
    });
    
    return res.status(400).json({ 
      error: 'Development webhook signature verification failed',
      details: err.message
    });
  }
};

/**
 * Smart webhook validator that chooses the right secret based on environment
 */
const validateStripeWebhookSmart = (req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment && process.env.STRIPE_CLI_WEBHOOK_SECRET) {
    return validateStripeWebhookDev(req, res, next);
  } else {
    return validateStripeWebhook(req, res, next);
  }
};

module.exports = {
  validateStripeWebhook,
  validateStripeWebhookDev,
  validateStripeWebhookSmart
};