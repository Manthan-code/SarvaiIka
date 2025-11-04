const express = require('express');
const { modelRouter } = require('../services/enhancedRouter.js');

const router = express.Router();

// Dynamic AI Model Routing
router.post('/route', async (req, res) => {
  try {
    const { userMessage, subscriptionPlan } = req.body;
    if (!userMessage || !subscriptionPlan) {
      return res.status(400).json({ error: 'userMessage and subscriptionPlan are required' });
    }

    // Use enhanced router for unified routing
    const route = await modelRouter.routeQuery(userMessage, subscriptionPlan);

    // Transform to legacy response shape expected by clients/tests
    const endpoint = (subscriptionPlan && subscriptionPlan.toLowerCase() === 'pro')
      ? '/api/pro'
      : '/api/free';

    const legacyResponse = {
      intent: route.intent || 'general',
      contentType: route.type || 'text',
      difficulty: route.difficulty || 'easy',
      model: route.primaryModel || 'gpt-3.5-turbo',
      endpoint,
      allowed: route.allowed !== undefined ? route.allowed : true,
      downgraded: !!route.downgraded,
      plan: subscriptionPlan ? subscriptionPlan.toLowerCase() : 'free'
    };

    return res.status(200).json(legacyResponse);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to route query', details: err.message });
  }
});

module.exports = router;
