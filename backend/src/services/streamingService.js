const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const conversationManager = require('./conversationManager.js');
const logger = require('../config/logger.js');

class StreamingService {
  constructor() {
    // Validate API keys
    this.hasValidOpenAIKey = this.validateOpenAIKey(process.env.OPENAI_API_KEY);
    // Support multiple env var names for Gemini API key
    this.geminiKey = process.env.FREE_MODEL_API_KEY || process.env.GEMINI_API_KEY || process.env.PAID_CHEAP_MODEL_API_KEY;
    this.hasValidGeminiKey = this.validateGeminiKey(this.geminiKey);

    // Initialize clients only if keys are valid
    if (this.hasValidOpenAIKey) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      logger.warn('Invalid or missing OpenAI API key - OpenAI models will be skipped');
    }

    if (this.hasValidGeminiKey) {
      this.freeGemini = new GoogleGenerativeAI(this.geminiKey);
    } else {
      logger.warn('Invalid or missing Gemini API key - Gemini models will be skipped');
    }

    this.conversationManager = conversationManager;
    this.resolvedGeminiModel = null; // cache resolved, supported Gemini model

    this.modelAdapters = {
      'gpt-3.5-turbo': this.streamOpenAI.bind(this),
      'gpt-4o': this.streamOpenAI.bind(this),
      'gpt-4o-mini': this.streamOpenAI.bind(this),
      'gpt-4': this.streamOpenAI.bind(this),
      // Gemini models will be routed dynamically by prefix match
      'dall-e-3': this.generateImage.bind(this),
      'dall-e-2': this.generateImage.bind(this)
    };
  }

  validateOpenAIKey(apiKey) {
    return apiKey && typeof apiKey === 'string' && apiKey.startsWith('sk-') && apiKey.length > 20;
  }

  validateGeminiKey(apiKey) {
    return apiKey && typeof apiKey === 'string' && apiKey.startsWith('AIza') && apiKey.length > 20;
  }

  // Resolve a Gemini model id robustly without relying on listModels
  async resolveGeminiModel(preferredCandidates = []) {
    if (this.resolvedGeminiModel) return this.resolvedGeminiModel;
    const strip = (name) => (name || '').replace(/^models\//, '');
    const normalize = (name) => strip((name || '').replace(/-latest$/, ''));
    const baseCandidates = [
      ...preferredCandidates,
      process.env.DEFAULT_MODEL,
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite'
    ].filter(Boolean);
    const candidates = baseCandidates.map(normalize);
    // Prefer the first candidate; SDK accepts canonical names
    this.resolvedGeminiModel = candidates[0] || 'gemini-2.0-flash';
    return this.resolvedGeminiModel;
  }

  async streamResponse({ route, message, sessionId, userId, userPlan, res }) {
    try {
      // Get conversation history (creates new chat if sessionId missing)
      const conversation = await this.conversationManager.getConversation(sessionId, userId);

      // Emit effective session id to the client (new or existing)
      const effectiveSessionId = conversation?.id || sessionId;
      try {
        res.write(`data: ${JSON.stringify({
          type: 'session',
          data: { sessionId: effectiveSessionId }
        })}\n\n`);
        if (typeof res.flush === 'function') {
          // Ensure headers/chunks are flushed promptly for SSE
          try { res.flush(); } catch { }
        }
      } catch (e) {
        logger.warn('Failed to emit session event:', e?.message || e);
      }

      // Try primary model first
      let success = false;
      let currentModel = route.primaryModel;
      let fallbackUsed = false;

      const tryModels = [route.primaryModel, ...route.fallbackModels].filter(Boolean);
      const startTime = Date.now();
      for (const model of tryModels) {
        try {
          currentModel = model;
          res.write(`data: ${JSON.stringify({
            type: 'model_selected',
            data: { model: currentModel }
          })}\n\n`);
          if (typeof res.flush === 'function') {
            try { res.flush(); } catch { }
          }

          let adapter = this.modelAdapters[model];
          if (!adapter) {
            // Dynamically route by model prefix
            if (/^gemini/i.test(model)) {
              adapter = this.streamGemini.bind(this);
            } else if (/^gpt/i.test(model)) {
              adapter = this.streamOpenAI.bind(this);
            } else {
              throw new Error(`No adapter for model: ${model}`);
            }
          }

          // Use an effective route that sets the selected model as primary for the adapter
          const effectiveRoute = { ...route, primaryModel: currentModel };
          await adapter({ route: effectiveRoute, message, conversation, userId, sessionId: effectiveSessionId, userPlan, res, startTime });
          success = true;
          fallbackUsed = currentModel !== route.primaryModel;
          break;

        } catch (error) {
          logger.warn(`Model ${model} failed:`, error.message);
          if (route.fallbackModels.length === 0) {
            throw error;
          }
        }
      }

      if (!success) {
        throw new Error('All models failed');
      }

      // Log clear fallback status after attempts
      logger.info('[Routing] Fallback status', {
        fallbackTriggered: fallbackUsed,
        originalPrimary: route.primaryModel,
        selectedModel: currentModel
      });

    } catch (error) {
      logger.error('Streaming service error:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        data: { message: error.message }
      })}\n\n`);
    } finally {
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
  }

  async streamOpenAI({ route, message, conversation, userId, sessionId, userPlan, res, startTime }) {
    if (!this.hasValidOpenAIKey || !this.openai) {
      throw new Error(`OpenAI API key is invalid or missing - cannot use model ${route.primaryModel}`);
    }

    const messages = [
      { role: 'system', content: this.getSystemPrompt(route) },
      ...conversation.messages,
      { role: 'user', content: message }
    ];

    const stream = await this.openai.chat.completions.create({
      model: route.primaryModel,
      messages,
      stream: true,
      temperature: 0.7
    });

    let fullResponse = '';
    let firstTokenTs = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;

        // Send token to client
        const ts = Date.now();
        if (!firstTokenTs) {
          firstTokenTs = ts;
          const latencyMs = ts - (startTime || ts);
          // Warn about high time-to-first-token for known slow tiers/models
          if (latencyMs > 1500) {
            const plan = (userPlan || 'unknown').toLowerCase();
            logger.warn(`Slow TTFB (${latencyMs}ms) for model ${route.primaryModel} [plan=${plan}]. Consider upgrading to a paid tier for faster streaming.`);
          }
        }
        res.write(`data: ${JSON.stringify({
          type: 'token',
          data: { content, fullResponse, ts }
        })}\n\n`);
        if (typeof res.flush === 'function') {
          try { res.flush(); } catch { }
        }

        // Save incremental progress
        // Do not await to avoid blocking streaming loop
        try { this.conversationManager.saveIncremental(sessionId, userId, content); } catch { }
      }
    }

    // Save complete conversation
    await this.conversationManager.saveMessage(sessionId, userId, message, fullResponse, route.primaryModel);
  }

  async streamGemini({ route, message, conversation, userId, sessionId, userPlan, res, startTime }) {
    if (!this.hasValidGeminiKey || !this.freeGemini) {
      throw new Error(`Gemini API key is invalid or missing - cannot use model ${route.primaryModel}`);
    }

    try {
      const modelId = await this.resolveGeminiModel([route.primaryModel]);
      const generationConfig = { temperature: 0.7, maxOutputTokens: 2048 };
      const model = this.freeGemini.getGenerativeModel({ model: modelId, generationConfig });

      // Build a simple prompt; avoid strict conversation formatting that may trigger safety blocks
      let systemPrompt = this.getSystemPrompt(route);
      let historyText = '';
      if (conversation?.messages?.length) {
        for (const msg of conversation.messages) {
          const role = (msg.role || '').toLowerCase() === 'assistant' ? 'Assistant' : 'User';
          historyText += `${role}: ${msg.content}\n`;
        }
      }
      const conversationText = `${systemPrompt}\n\n${historyText}User: ${message}`;

      // Try streaming via SDK first
      let fullText = '';
      let firstTokenTs = 0;
      let streamedAny = false;
      try {
        const result = await model.generateContentStream({
          contents: [
            { role: 'user', parts: [{ text: conversationText }] }
          ]
        });
        for await (const event of result.stream) {
          // Extract incremental text safely across SDK versions
          let piece = '';
          try {
            const parts = event?.candidates?.[0]?.content?.parts || [];
            piece = parts.map(p => p?.text || '').join('');
          } catch { }
          if (!piece && typeof event?.text === 'string') {
            piece = event.text;
          }
          if (!piece) continue;
          streamedAny = true;
          fullText += piece;
          const ts = Date.now();
          if (!firstTokenTs) {
            firstTokenTs = ts;
            const latencyMs = ts - (startTime || ts);
            if (latencyMs > 1500) {
              const plan = (userPlan || 'unknown').toLowerCase();
              logger.warn(`Slow TTFB (${latencyMs}ms) for Gemini model ${modelId} [plan=${plan}]. Upgrading to paid tier improves streaming speed.`);
            }
          }
          res.write(`data: ${JSON.stringify({ type: 'token', data: { content: piece, fullResponse: fullText, ts } })}\n\n`);
          if (typeof res.flush === 'function') {
            try { res.flush(); } catch { }
          }
          // Non-blocking incremental save
          try { this.conversationManager.saveIncremental(sessionId, userId, piece); } catch { }
        }
      } catch (streamErr) {
        logger.warn('Gemini SDK streaming failed; falling back to non-streaming generateContent:', streamErr?.message || streamErr);
      }

      if (!streamedAny) {
        // Fallback to non-streaming request, then re-chunk locally
        try {
          const result = await model.generateContent({
            contents: [
              { role: 'user', parts: [{ text: conversationText }] }
            ]
          });
          const response = await result.response;
          fullText = response?.text() || '';
        } catch (primaryErr) {
          // Fallback chain
          logger.warn('Gemini primary generateContent failed, retrying with parts array:', primaryErr?.message || primaryErr);
          try {
            const result = await model.generateContent([{ text: conversationText }]);
            const response = await result.response;
            fullText = response?.text() || '';
          } catch (secondaryErr) {
            logger.warn('Gemini secondary generateContent failed, retrying with string prompt:', secondaryErr?.message || secondaryErr);
            try {
              const result = await model.generateContent(conversationText);
              const response = await result.response;
              fullText = response?.text() || '';
            } catch (tertiaryErr) {
              logger.warn('Gemini tertiary generateContent failed, attempting REST fallback:', tertiaryErr?.message || tertiaryErr);
              fullText = await this.geminiGenerateViaRest(modelId, conversationText);
            }
          }
        }

        if (!fullText) {
          throw new Error('Gemini returned empty response');
        }

        const words = fullText.split(/(\s+)/); // keep spaces
        let assembled = '';
        for (const chunk of words) {
          if (!chunk) continue;
          assembled += chunk;
          const ts = Date.now();
          res.write(`data: ${JSON.stringify({ type: 'token', data: { content: chunk, fullResponse: assembled, ts } })}\n\n`);
          if (typeof res.flush === 'function') {
            try { res.flush(); } catch { }
          }
          try { this.conversationManager.saveIncremental(sessionId, userId, chunk); } catch { }
        }
      }

      await this.conversationManager.saveMessage(sessionId, userId, message, fullText, modelId);
    } catch (error) {
      logger.warn('Gemini streaming failed:', error?.message || error);
      if (error?.stack) {
        logger.warn('Gemini error stack:', error.stack);
      }
      throw error;
    }
  }

  async geminiGenerateViaRest(modelId, promptText) {
    const modelPath = /^models\//.test(modelId) ? modelId : `models/${modelId}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${encodeURIComponent(modelPath)}:generateContent?key=${encodeURIComponent(this.geminiKey || '')}`;
    const body = {
      contents: [
        { role: 'user', parts: [{ text: promptText }] }
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    };
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await resp.json();
      if (!resp.ok) {
        const msg = json?.error?.message || `HTTP ${resp.status}`;
        throw new Error(`Gemini REST error: ${msg}`);
      }
      const parts = json?.candidates?.[0]?.content?.parts || [];
      const text = parts.map(p => p?.text || '').join('');
      if (!text) {
        throw new Error('Gemini REST returned empty response');
      }
      return text;
    } catch (err) {
      logger.warn('Gemini REST fallback failed:', err?.message || err);
      throw err;
    }
  }

  async generateImage({ route, message, conversation, userId, sessionId, res }) {
    res.write(`data: ${JSON.stringify({
      type: 'status',
      data: { message: 'Generating image...' }
    })}\n\n`);

    const imgOptions = {
      model: route.primaryModel,
      prompt: message,
      n: 1,
      size: '1024x1024'
    };
    // Use higher quality for hard prompts when requested
    if (route.imageQuality) {
      imgOptions.quality = route.imageQuality;
    }
    const response = await this.openai.images.generate(imgOptions);

    const imageUrl = response.data[0].url;

    res.write(`data: ${JSON.stringify({
      type: 'image',
      data: { url: imageUrl, prompt: message }
    })}\n\n`);

    // Save to conversation
    await this.conversationManager.saveMessage(sessionId, userId, message, imageUrl, route.primaryModel, 'image');
  }

  getSystemPrompt(route) {
    const prompts = {
      text: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.',
      coding: 'You are an expert programming assistant. Provide clean, well-documented code with explanations.',
      image: 'You are an AI image generation assistant.',
      video: 'You are a helpful assistant. Note: Video generation is not yet available, so provide text-based guidance instead.'
    };

    return prompts[route.type] || prompts.text;
  }
}

module.exports = StreamingService;