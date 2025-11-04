const express = require('express');
const { modelRouter } = require('../services/enhancedRouter.js');
const StreamingService = require('../services/streamingService.js');
const MockStreamingService = require('../services/mockStreamingService.js');
const { requireAuth } = require('../middlewares/authMiddleware.js');
const logger = require('../config/logger.js');

const router = express.Router();
const streamingService = new StreamingService();
const mockStreamingService = new MockStreamingService();

// Use mock service only when explicitly enabled
const USE_MOCK_AI = process.env.USE_MOCK_AI === 'true';

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
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, Pragma, X-Requested-With, Accept, Origin',
      'Vary': 'Origin'
    });
    
    // Send initial routing info, then ensure a supported Gemini model for all plans
    const computedRoute = await modelRouter.routeQuery(message, userPlan);
    // Use stable Gemini model IDs to avoid 404s on unsupported aliases
    const route = { 
      ...computedRoute, 
      // Prefer Gemini 2.5 family; avoid ambiguous '-latest' when possible
      primaryModel: 'gemini-2.5-flash', 
      fallbackModels: ['gemini-2.5-flash-lite'] 
    };
    res.write(`data: ${JSON.stringify({ type: 'routing', data: route })}\n\n`);
    if (typeof res.flush === 'function') {
      try { res.flush(); } catch {}
    }
    
    // Handle restricted content
    if (route.restricted) {
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        data: { 
          message: 'This feature requires a Pro subscription',
          upgradeRequired: true 
        }
      })}\n\n`);
      if (typeof res.flush === 'function') {
        try { res.flush(); } catch {}
      }
      res.write(`data: [DONE]\n\n`);
      return res.end();
    }
    
    // Start streaming response
    if (USE_MOCK_AI) {
      // Use mock streaming service (no API costs)
      await mockStreamingService.startStream(message, {
        context: { sessionId, userId, userPlan },
        route
      }, res);
    } else {
      // Use real AI streaming service
      await streamingService.streamResponse({
        route,
        message,
        sessionId,
        userId,
        res
      });
    }
    
  } catch (error) {
    logger.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      data: { message: 'Internal server error' }
    })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
  }
});

module.exports = router;