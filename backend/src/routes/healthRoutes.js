// File: backend/src/routes/healthRoutes.js
const express = require('express');
const redisClient = require('../redis/unifiedRedisClient.js');
const qdrantClient = require('../db/qdrant/client.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

// GET /health
router.get('/', async (req, res, next) => {
  try {
    // Redis status
    let redisStatus = 'disconnected';
    try {
      const status = redisClient.getStatus();
      if (status.isConnected) {
        redisStatus = 'connected';
      } else if (status.useFallback) {
        redisStatus = 'fallback';
      }
    } catch (error) {
      redisStatus = 'disconnected';
    }

    // Qdrant test
    let qdrantStatus = 'disconnected';
    try {
      await qdrantClient.getCollections();
      qdrantStatus = 'connected';
    } catch {}

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        redis: redisStatus,
        qdrant: qdrantStatus,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /health/ai - Check Gemini free-tier availability
router.get('/ai', async (req, res, next) => {
  try {
    const apiKey = process.env.FREE_MODEL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ status: 'error', error: 'FREE_MODEL_API_KEY not set' });
    }

    const client = new GoogleGenerativeAI(apiKey);
    let resolvedModel = process.env.DEFAULT_MODEL || 'gemini-1.0-pro';
    try {
      const list = await client.listModels?.();
      const models = Array.isArray(list?.models) ? list.models : Array.isArray(list) ? list : [];
      const supported = models.filter(m => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'));
      const strip = (name) => (name || '').replace(/^models\//, '');
      // Prefer flash, then pro, else first supported
      const preferredOrder = ['gemini-1.5-flash', 'gemini-1.0-pro'];
      for (const p of preferredOrder) {
        const match = supported.find(m => strip(m.name) === p);
        if (match) { resolvedModel = strip(match.name); break; }
      }
      if (!preferredOrder.includes(resolvedModel) && supported[0]) {
        resolvedModel = strip(supported[0].name);
      }
    } catch {}
    const model = client.getGenerativeModel({ model: resolvedModel });

    try {
      const result = await model.generateContent('Ping');
      const text = await result.response.text();
      return res.json({ status: 'ok', model: resolvedModel, sample: text.slice(0, 60) });
    } catch (err) {
      return res.status(500).json({ status: 'error', error: err.message || String(err) });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
