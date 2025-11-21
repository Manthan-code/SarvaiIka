const express = require('express');
const { modelRouter } = require('../services/enhancedRouter.js');
const StreamingService = require('../services/streamingService.js');
const { requireAuth } = require('../middlewares/authMiddleware.js');
const logger = require('../config/logger.js');

const router = express.Router();
const streamingService = new StreamingService();

// Always use real streaming service; mock streaming disabled

// POST /api/chat/stream - Streaming chat endpoint
router.post('/stream', requireAuth, async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const userId = req.user.id;
    const userPlan = req.profile?.subscription_plan || 'free';

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Set up SSE headers (align with global CORS)
    const origin = req.headers.origin || process.env.CORS_ORIGINS?.split(',')[0] || 'http://localhost:8080';
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      // Disable proxy buffering (e.g., Nginx) to ensure real-time chunks
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, Pragma, X-Requested-With, Accept, Origin',
      'Vary': 'Origin'
    });

    // 1. Get routing decision
    const computedRoute = await modelRouter.routeQuery(message, {
      subscriptionPlan: userPlan,
      userId
    });

    // 2. Send routing event to client (for debugging/transparency)
    const routingPayload = {
      type: 'routing',
      data: {
        primaryModel: computedRoute.primaryModel,
        type: computedRoute.type,
        difficulty: computedRoute.difficulty,
        debug: {
          systemPrompt: computedRoute.systemPrompt,
          userQuery: message
        }
      }
    };
    res.write(`data: ${JSON.stringify(routingPayload)}\n\n`);
    if (typeof res.flush === 'function') {
      try { res.flush(); } catch { }
    }

    // 3. Prepare route for streaming service
    const effectiveRoute = {
      ...computedRoute,
      userId,
      userPlan
    };

    // Handle restricted content
    if (computedRoute.restricted) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        data: {
          message: 'This feature requires a Pro subscription',
          upgradeRequired: true
        }
      })}\n\n`);
      if (typeof res.flush === 'function') {
        try { res.flush(); } catch { }
      }
      res.write(`data: [DONE]\n\n`);
      return res.end();
    }

    // Start streaming response using real AI streaming service only
    // Trust the EnhancedRouterService decision which already accounts for plan and difficulty
    const selectedRoute = { ...effectiveRoute };

    // Use the model already selected by the router
    const chosenModel = computedRoute.primaryModel || 'gemini-2.5-flash-lite';
    selectedRoute.primaryModel = chosenModel;

    // Fallback models can be generic based on plan
    const plan = String(userPlan || 'free').toLowerCase();
    selectedRoute.fallbackModels = plan === 'free'
      ? ['gemini-2.5-flash-lite', 'gpt-4o-mini']
      : ['gemini-2.5-flash-lite', 'gpt-4o-mini']; // Simplified fallbacks

    // Plan-aware image quality
    if (selectedRoute.type === 'image') {
      // Default to standard, upgrade to hd if explicitly requested or hard difficulty
      const isHard = computedRoute.difficulty === 'hard';
      selectedRoute.imageQuality = plan === 'free' ? 'standard' : (isHard ? 'hd' : 'standard');
    }

    logger.info('[RouterAI] Using router decision', {
      userPlan: plan,
      routerOutputModel: chosenModel,
      type: selectedRoute.type,
      imageQuality: selectedRoute.imageQuality
    });

    await streamingService.streamResponse({
      route: selectedRoute,
      message,
      sessionId,
      userId,
      userPlan,
      res
    });

  } catch (error) {
    logger.error('Streaming error:', error);
    const message = error?.message || 'Internal server error';
    res.write(`data: ${JSON.stringify({
      type: 'error',
      data: { message }
    })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
  }
});

// Explicit CORS preflight handler for streaming route to ensure proper headers
router.options('/stream', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || ['http://localhost:8080'];
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(204).end();
});

module.exports = router;