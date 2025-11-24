const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const conversationManager = require('./conversationManager.js');
const logger = require('../config/logger.js');
const config = require('../config/config.js');

class StreamingService {
  constructor() {
    // Initialize Clients
    this.clients = {};

    // 1. OpenAI
    if (config.openai.apiKey) {
      this.clients.openai = new OpenAI({ apiKey: config.openai.apiKey });
    } else {
      logger.warn('OpenAI API key missing');
    }

    // 2. Gemini (Google)
    if (config.gemini.apiKey) {
      this.clients.gemini = new GoogleGenerativeAI(config.gemini.apiKey);
    } else {
      logger.warn('Gemini API key missing');
    }

    // 3. DeepSeek (OpenAI Compatible)
    if (config.deepseek.apiKey) {
      this.clients.deepseek = new OpenAI({
        apiKey: config.deepseek.apiKey,
        baseURL: 'https://api.deepseek.com'
      });
    }

    // 4. Mistral (OpenAI Compatible or SDK)
    if (config.mistral.apiKey) {
      this.clients.mistral = new OpenAI({
        apiKey: config.mistral.apiKey,
        baseURL: 'https://api.mistral.ai/v1'
      });
    }

    // 5. XAI (Grok)
    if (config.xai.apiKey) {
      this.clients.xai = new OpenAI({
        apiKey: config.xai.apiKey,
        baseURL: 'https://api.x.ai/v1'
      });
    }

    // 6. Groq
    if (config.groq.apiKey) {
      this.clients.groq = new OpenAI({
        apiKey: config.groq.apiKey,
        baseURL: 'https://api.groq.com/openai/v1'
      });
    }

    // 7. Qwen (via DashScope or compatible endpoint)
    if (config.qwen.apiKey) {
      this.clients.qwen = new OpenAI({
        apiKey: config.qwen.apiKey,
        baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
      });
    }

    this.conversationManager = conversationManager;
    this.resolvedGeminiModel = null;
  }

  /**
   * Selects the appropriate client and adapter based on the model name.
   */
  getAdapterForModel(model) {
    const m = model.toLowerCase();

    // Gemini
    if (m.startsWith('gemini')) {
      return this.streamGemini.bind(this);
    }

    // DeepSeek
    if (m.includes('deepseek')) {
      return (params) => this.streamOpenAICompatible(params, this.clients.deepseek, 'DeepSeek');
    }

    // Mistral
    if (m.includes('mistral') || m.includes('mixtral')) {
      if (this.clients.mistral) return (params) => this.streamOpenAICompatible(params, this.clients.mistral, 'Mistral');
    }

    // XAI (Grok)
    if (m.includes('grok')) {
      return (params) => this.streamOpenAICompatible(params, this.clients.xai, 'XAI');
    }

    // Groq (Llama, etc running on Groq)
    if (this.clients.groq && (m.includes('llama') || m.includes('groq'))) {
      return (params) => this.streamOpenAICompatible(params, this.clients.groq, 'Groq');
    }

    // Qwen
    if (m.includes('qwen')) {
      return (params) => this.streamOpenAICompatible(params, this.clients.qwen, 'Qwen');
    }

    // Default to OpenAI
    return (params) => this.streamOpenAICompatible(params, this.clients.openai, 'OpenAI');
  }

  async streamResponse({ route, message, sessionId, userId, userPlan, res }) {
    try {
      const conversation = await this.conversationManager.getConversation(sessionId, userId);
      const effectiveSessionId = conversation?.id || sessionId;

      this.emitEvent(res, 'session', { sessionId: effectiveSessionId });

      let success = false;
      let currentModel = route.primaryModel;
      let fullResponseText = '';

      const tryModels = [route.primaryModel, ...route.fallbackModels].filter(Boolean);
      const startTime = Date.now();

      for (const model of tryModels) {
        try {
          currentModel = model;
          this.emitEvent(res, 'model_selected', { model: currentModel });

          const adapter = this.getAdapterForModel(model);

          const effectiveRoute = { ...route, primaryModel: currentModel };
          fullResponseText = await adapter({
            route: effectiveRoute,
            message,
            conversation,
            userId,
            sessionId: effectiveSessionId,
            userPlan,
            res,
            startTime
          });

          success = true;
          break;
        } catch (error) {
          logger.warn(`Model ${model} failed:`, error.message);
          if (route.fallbackModels.length === 0) throw error;
        }
      }

      if (!success) throw new Error('All models failed');

      this.trackQuery(userId, message, route, fullResponseText, currentModel);

    } catch (error) {
      logger.error('Streaming service error:', error);
      this.emitEvent(res, 'error', { message: error.message });
    } finally {
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
  }

  // Map internal model names to provider-specific API IDs
  MODEL_ID_MAPPING = {
    'deepseek-v3.2': 'deepseek-chat', // Updated to working API ID
    'codestral': 'codestral-latest',
    'mistral-small': 'mistral-small-2506',
    'llama-3.1-8b': 'llama-3.1-8b-instant', // Groq ID
    'grok-4': 'grok-beta', // Updated to working API ID
    'qwen': 'qwen-turbo', // Default Qwen model
    'gpt-4o': 'gpt-4o',
    'gpt-4o-mini': 'gpt-4o-mini'
  };

  // Generic handler for all OpenAI-compatible APIs
  async streamOpenAICompatible({ route, message, conversation, userId, sessionId, userPlan, res, startTime, attachments }, client, providerName) {
    if (!client) throw new Error(`${providerName} client not initialized (missing API key)`);

    const contextManager = require('./contextManager');
    const { messages: contextMessages, contextInstructions } = await contextManager.constructContext(userId, sessionId, message, route.primaryModel);

    let systemPrompt = this.getSystemPrompt(route);
    if (contextInstructions) systemPrompt += contextInstructions;

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...contextMessages
    ];

    // Handle attachments (images)
    if (attachments && attachments.length > 0) {
      const userMessage = {
        role: 'user',
        content: [
          { type: 'text', text: message }
        ]
      };

      // Add images to the message
      for (const attachment of attachments) {
        if (attachment.type.startsWith('image/')) {
          userMessage.content.push({
            type: 'image_url',
            image_url: { url: attachment.url }
          });
        }
      }

      messages.push(userMessage);
    } else {
      messages.push({ role: 'user', content: message });
    }

    // Resolve the correct API model ID
    const apiModelId = this.MODEL_ID_MAPPING[route.primaryModel] || route.primaryModel;

    const stream = await client.chat.completions.create({
      model: apiModelId,
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
        const ts = Date.now();
        if (!firstTokenTs) firstTokenTs = ts;

        this.emitEvent(res, 'token', { content, fullResponse, ts });
        try { this.conversationManager.saveIncremental(sessionId, userId, content); } catch { }
      }
    }

    await this.conversationManager.saveMessage(sessionId, userId, message, fullResponse, route.primaryModel);
    return fullResponse;
  }

  // Helper for SSE events
  emitEvent(res, type, data) {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    if (typeof res.flush === 'function') {
      try { res.flush(); } catch { }
    }
  }

  async streamGemini({ route, message, conversation, userId, sessionId, userPlan, res, startTime }) {
    if (!this.clients.gemini) {
      throw new Error(`Gemini API key is invalid or missing - cannot use model ${route.primaryModel}`);
    }

    try {
      const modelId = await this.resolveGeminiModel([route.primaryModel]);
      const generationConfig = { temperature: 0.7, maxOutputTokens: 2048 };
      const model = this.clients.gemini.getGenerativeModel({ model: modelId, generationConfig });

      const contextManager = require('./contextManager');
      const { messages: contextMessages, contextInstructions } = await contextManager.constructContext(userId, sessionId, message, route.primaryModel);

      let systemPrompt = this.getSystemPrompt(route);
      if (contextInstructions) {
        systemPrompt += contextInstructions;
      }

      let historyText = '';
      if (contextMessages && contextMessages.length) {
        for (const msg of contextMessages) {
          const role = (msg.role || '').toLowerCase() === 'assistant' ? 'Assistant' : 'User';
          historyText += `${role}: ${msg.content}\n`;
        }
      }
      const conversationText = `${systemPrompt}\n\n${historyText}User: ${message}`;

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
          let piece = '';
          try {
            const parts = event?.candidates?.[0]?.content?.parts || [];
            piece = parts.map(p => p?.text || '').join('');
          } catch { }
          if (!piece && typeof event?.text === 'string') piece = event.text;
          if (!piece) continue;

          streamedAny = true;
          fullText += piece;
          const ts = Date.now();
          if (!firstTokenTs) firstTokenTs = ts;

          this.emitEvent(res, 'token', { content: piece, fullResponse: fullText, ts });
          try { this.conversationManager.saveIncremental(sessionId, userId, piece); } catch { }
        }
      } catch (streamErr) {
        logger.warn('Gemini SDK streaming failed; falling back to non-streaming:', streamErr?.message);
      }

      if (!streamedAny) {
        // Fallback logic (simplified for brevity but retaining core)
        const result = await model.generateContent(conversationText);
        const response = await result.response;
        fullText = response?.text() || '';

        if (!fullText) throw new Error('Gemini returned empty response');

        this.emitEvent(res, 'token', { content: fullText, fullResponse: fullText, ts: Date.now() });
      }

      await this.conversationManager.saveMessage(sessionId, userId, message, fullText, modelId);
      return fullText;
    } catch (error) {
      logger.warn('Gemini streaming failed:', error?.message);
      throw error;
    }
  }

  async resolveGeminiModel(preferredCandidates = []) {
    if (this.resolvedGeminiModel) return this.resolvedGeminiModel;
    const strip = (name) => (name || '').replace(/^models\//, '');
    const normalize = (name) => strip((name || '').replace(/-latest$/, ''));
    const baseCandidates = [
      ...preferredCandidates,
      'gemini-2.5-flash',
      'gemini-2.0-flash'
    ].filter(Boolean);
    const candidates = baseCandidates.map(normalize);
    this.resolvedGeminiModel = candidates[0] || 'gemini-2.0-flash';
    return this.resolvedGeminiModel;
  }

  async generateImage({ route, message, conversation, userId, sessionId, res }) {
    this.emitEvent(res, 'status', { message: 'Generating image...' });

    const imgOptions = {
      model: route.primaryModel,
      prompt: message,
      n: 1,
      size: '1024x1024'
    };
    if (route.imageQuality) imgOptions.quality = route.imageQuality;

    const response = await this.clients.openai.images.generate(imgOptions);
    const imageUrl = response.data[0].url;

    this.emitEvent(res, 'image', { url: imageUrl, prompt: message });
    await this.conversationManager.saveMessage(sessionId, userId, message, imageUrl, route.primaryModel, 'image');
  }

  getSystemPrompt(route) {
    const prompts = {
      text: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.',
      coding: 'You are an expert programming assistant. Provide clean, well-documented code with explanations.',
      image: 'You are an AI image generation assistant.',
      video: 'You are a helpful assistant. Note: Video generation is not yet available.'
    };
    return prompts[route.type] || prompts.text;
  }

  trackQuery(userId, message, route, fullResponseText, currentModel) {
    (async () => {
      try {
        const enhancedQdrantService = require('./enhancedQdrantService');
        if (fullResponseText) {
          await enhancedQdrantService.storeQueryContext(userId, message, {
            queryType: route.type,
            response: fullResponseText,
            model: currentModel
          });
        } else {
          await enhancedQdrantService.trackUserQuery(userId, message, {
            model: currentModel,
            queryType: route.type
          });
        }
      } catch (err) {
        logger.warn('[StreamingService] Failed to track query in Qdrant:', err.message);
      }
    })();
  }
}

module.exports = StreamingService;