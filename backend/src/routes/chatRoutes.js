const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = require('../db/supabase/admin.js'); // Add this import
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../config/logger.js');
const { modelRouter } = require('../services/enhancedRouter.js');
const { generateImageSimple } = require('../services/dalleService.js');
const { generateDiagram, isLucidchartAvailable } = require('../services/lucidchartService.js');
const { generateChatResponse } = require('../services/vectorService.js');
const { requireAuth } = require('../middlewares/authMiddleware.js');
const { trackUsage, updateUsage } = require('../middlewares/usageMiddleware.js');
const { getCachedResponse, cacheResponse, invalidateCache } = require('../redis/redisHelpers.js');
const { asyncHandler, dbOperation, ValidationError, DatabaseError } = require('../utils/errorHandler');

const router = express.Router();
// Replace this line:
// const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
// With this:
const supabase = supabaseAdmin;

// Initialize Gemini AI clients
const freeGemini = new GoogleGenerativeAI(process.env.FREE_MODEL_API_KEY);
const paidCheapGemini = new GoogleGenerativeAI(process.env.PAID_CHEAP_MODEL_API_KEY);
const paidExpensiveGemini = new GoogleGenerativeAI(process.env.PAID_EXPENSIVE_MODEL_API_KEY);

// GET /api/chats - Get user's chats with cursor-based pagination
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const cursor = req.query.cursor; // timestamp cursor
    const direction = req.query.direction || 'next'; // 'next' or 'prev'

    let query = supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // Get one extra to check if there's more

    // Apply cursor filtering
    if (cursor) {
      if (direction === 'next') {
        query = query.lt('created_at', cursor);
      } else {
        query = query.gt('created_at', cursor);
      }
    }

    const { data: chats, error } = await query;

    if (error) {
      console.error('Error fetching chats:', error);
      logger.error('Error fetching chats:', error);
      return res.status(500).json({ error: 'Failed to fetch chats' });
    }

    // Check if there are more results
    const hasMore = chats.length > limit;
    const results = hasMore ? chats.slice(0, limit) : chats;

    // Generate next cursor
    const nextCursor = results.length > 0 ? results[results.length - 1].created_at : null;
    const prevCursor = results.length > 0 ? results[0].created_at : null;

    res.status(200).json({
      chats: results,
      pagination: {
        hasMore,
        nextCursor,
        prevCursor,
        limit
      }
    });
  } catch (error) {
    console.error('Error in chats route:', error);
    logger.error('Error in chats route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// GET /api/chat/sessions - Get user's chat sessions with cursor-based pagination
router.get('/sessions', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const limit = parseInt(req.query.limit) || 20;
  const cursor = req.query.cursor;
  const direction = req.query.direction || 'next';
  const { force } = req.query;
  const cacheKey = `chat:sessions:${userId}:${cursor || 'initial'}:${limit}:${direction}`;

  // Skip cache if force refresh is requested
  if (!force) {
    const cachedSessions = await getCachedResponse(userId, cacheKey);
    if (cachedSessions) {
      return res.status(200).json({
        ...cachedSessions,
        cached: true
      });
    }
  }

  let query = supabase
    .from('chats')
    .select('id, title, created_at, last_message_at, total_messages')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit + 1); // Get one extra to check if there's more

  // Apply cursor filtering
  if (cursor) {
    if (direction === 'next') {
      query = query.lt('created_at', cursor);
    } else {
      query = query.gt('created_at', cursor);
    }
  }

  const { data: sessions, error } = await query;

  if (error) {
    logger.error('Error fetching chat sessions:', error);
    throw new DatabaseError('Failed to fetch chat sessions');
  }

  // Check if there are more results
  const hasMore = sessions.length > limit;
  const results = hasMore ? sessions.slice(0, limit) : sessions;

  // Generate cursors
  const nextCursor = results.length > 0 ? results[results.length - 1].created_at : null;
  const prevCursor = results.length > 0 ? results[0].created_at : null;

  const responseData = {
    data: results,
    pagination: {
      hasMore,
      nextCursor,
      prevCursor,
      limit
    },
    cached: false
  };

  // Cache the results with 60-second TTL
  await cacheResponse(userId, cacheKey, responseData, 60);

  res.status(200).json(responseData);
}));


// PATCH /api/chat/:id - Update a chat session title
router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    let { title } = req.body;

    if (typeof title !== 'string') {
      return res.status(400).json({ error: 'Title must be a string' });
    }
    title = title.trim();
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (title.length > 200) {
      return res.status(400).json({ error: 'Title is too long' });
    }

    const { data: updated, error } = await supabase
      .from('chats')
      .update({
        title,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, title, created_at, last_message_at, total_messages, updated_at')
      .single();

    if (error) {
      logger.error('Error updating chat session:', error);
      return res.status(500).json({ error: 'Failed to update chat session' });
    }

    try {
      await invalidateCache(`chat:sessions:${userId}:*`);
      logger.info(`🗑️ Invalidated chat sessions cache after title update for chat: ${id}`);
    } catch (cacheError) {
      logger.warn('Failed to invalidate chat sessions cache:', cacheError);
    }

    return res.status(200).json(updated);
  } catch (error) {
    logger.error('Error in PATCH /api/chat/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// DELETE /api/chat/:id - Delete a chat session (UPDATED ROUTE)
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.error('Error deleting chat session:', error);
      return res.status(500).json({ error: 'Failed to delete chat session' });
    }

    // Invalidate chat sessions cache after deletion
    try {
      await invalidateCache(`chat:sessions:${userId}:*`);
      logger.info(`🗑️ Invalidated chat sessions cache after deletion for user: ${userId}`);
    } catch (cacheError) {
      logger.warn('Failed to invalidate chat sessions cache:', cacheError);
    }

    res.status(200).json({ message: 'Chat session deleted successfully' });
  } catch (error) {
    logger.error('Error in DELETE /api/chat/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// GET /api/chat/:id - Get specific chat session with messages (OPTIMIZED - NO N+1)
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    // Single optimized query to get chat session with messages in one go
    const { data: chatData, error } = await supabase
      .from('chats')
      .select(`
        id, 
        title, 
        created_at, 
        last_message_at, 
        total_messages, 
        user_id,
        chat_messages(
          id, 
          role, 
          content, 
          tokens, 
          model_used, 
          created_at
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .order('created_at', { foreignTable: 'chat_messages', ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1, { foreignTable: 'chat_messages' })
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Chat not found' });
      }
      logger.error('Error fetching chat session with messages:', error);
      return res.status(500).json({ error: 'Failed to fetch chat session' });
    }

    // Extract messages and reverse to get chronological order
    const messages = chatData.chat_messages?.reverse() || [];

    // Remove messages from chat object to avoid duplication
    const { chat_messages, ...session } = chatData;

    res.status(200).json({
      ...session,
      messages,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: session.total_messages || 0,
        has_more: (parseInt(offset) + parseInt(limit)) < (session.total_messages || 0)
      }
    });

  } catch (error) {
    logger.error('Error in GET /api/chat/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));


// POST /api/chat - Send a message
router.post('/', requireAuth, trackUsage, asyncHandler(async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const userId = req.user.id;
    const userPlan = req.profile.subscription_plan || 'free'; // Fixed: use req.profile instead of req.user

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Route using enhanced model router (includes nano-classification logging internally)
    const computedRoute = await modelRouter.routeQuery(message, userPlan);

    // The router now returns the exact model to use
    const model = computedRoute.primaryModel;
    const intent = computedRoute.type;
    const difficulty = computedRoute.difficulty;
    const allowed = computedRoute.allowed;

    logger.info('[ChatRoutes] Routing decision', {
      intent,
      difficulty,
      model,
      subscriptionPlan: userPlan,
    });

    if (!allowed) {
      return res.status(403).json({
        error: 'This feature requires a higher subscription plan',
        requiredPlan: 'plus'
      });
    }

    // Route to appropriate handler based on intent
    switch (intent) {
      case 'text':
      case 'coding':
        return await handleText({ message, sessionId, userId, userPlan, intent, difficulty, model, allowed, downgraded, routing: computedRoute, res });
      case 'image':
        return await handleImage({ message, userId, userPlan, intent, difficulty, allowed, res });
      case 'diagram':
        return await handleDiagram({ message, userId, userPlan, intent, difficulty, content_type: 'diagram', allowed, res });
      default:
        return await handleText({ message, sessionId, userId, userPlan, intent, difficulty, model, allowed, downgraded, routing: computedRoute, res });
    }

  } catch (error) {
    logger.error('Error in POST /api/chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

async function handleText({ message, sessionId, userId, userPlan, intent, difficulty, model, allowed, downgraded, routing, res }) {
  try {
    // Determine provider and normalize Gemini aliases only
    const isOpenAIModel = (m) => {
      const s = String(m || '').toLowerCase();
      return s.startsWith('gpt') || s.startsWith('o') || s.includes('openai');
    };

    function normalizeGemini(inputModel) {
      const m = (inputModel || '').toLowerCase().trim();
      const defaultByPlan = () => process.env.DEFAULT_MODEL || 'gemini-1.5-flash-latest';

      if (!m) return defaultByPlan();
      const geminiAliasMap = {
        'gemini-pro': 'gemini-1.0-pro-latest',
        'gemini-1.5-pro': 'gemini-1.5-pro-latest',
        'gemini-1.5-flash': 'gemini-1.5-flash-latest',
      };
      const normalizedGemini = geminiAliasMap[m] || m;
      if (normalizedGemini.startsWith('gemini-')) {
        if (normalizedGemini.endsWith('-latest')) return normalizedGemini;
        return 'gemini-1.5-flash-latest';
      }
      return defaultByPlan();
    }

    const modelUsed = isOpenAIModel(model) ? model : normalizeGemini(model);
    const cacheKey = `chat:${userId}:${crypto.createHash('md5').update(message).digest('hex')}`;
    const cacheTTL = 3600; // 1 hour

    // Check cache first
    const cachedResponse = await getCachedResponse(userId, cacheKey);
    if (cachedResponse) {
      const out = cachedResponse.output;
      const isErrorLike = typeof out === 'string' && (
        out.includes('issue with the API configuration') ||
        out.includes('API rate limit') ||
        out.includes('model is unavailable') ||
        out.includes('network error') ||
        out.includes("I'm having trouble processing your request")
      );
      if (isErrorLike) {
        try { await invalidateCache(cacheKey); } catch (_) { }
      } else {
        return res.status(200).json({
          output: out,
          sessionId: cachedResponse.sessionId,
          model: modelUsed,
          cached: true
        });
      }
    }

    let currentSessionId = sessionId;
    let conversationHistory = [];
    let isNewChat = false;

    // Treat placeholder or invalid sessionId values as new chat
    const placeholderIds = new Set(['new', 'new-chat', 'draft', 'temp', 'placeholder', '']);
    const isPlaceholder = !currentSessionId || placeholderIds.has(String(currentSessionId).trim());

    // Create new chat session immediately if no valid sessionId provided
    if (!currentSessionId || isPlaceholder) {
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          user_id: userId,
          title: 'New Chat', // Initial placeholder as required
          model_used: modelUsed,
          total_messages: 0, // Will be updated after messages are saved
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (chatError) {
        logger.error('Error creating chat session:', chatError);
        return res.status(500).json({ error: 'Failed to create chat session' });
      }

      currentSessionId = newChat.id;
      isNewChat = true;

      // Invalidate chat sessions cache immediately
      try {
        // Use more specific pattern that matches the actual cache key
        await invalidateCache(`chat:sessions:${userId}:*`);
        // Also invalidate the specific recent cache key
        await invalidateCache(`chat:sessions:${userId}:recent`);
        logger.info(`🗑️ Invalidated chat sessions cache for new chat: ${currentSessionId}`);
      } catch (cacheError) {
        logger.warn('Failed to invalidate chat sessions cache:', cacheError);
      }
    } else {
      // Get existing session and messages if sessionId provided
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('chat_id', currentSessionId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (messages) conversationHistory = messages;
    }

    // Select appropriate Gemini client based on model and user plan
    function getGeminiClient(/* model, userPlan */) {
      return freeGemini;
    }

    // Track effective model/client and downgrade state for graceful fallback
    let effectiveModel = modelUsed;
    let geminiClient = getGeminiClient(effectiveModel, userPlan);
    let wasDowngraded = false;

    logger.info('[ChatRoutes] Provider selection', {
      provider: isOpenAIModel(modelUsed) ? 'openai' : 'gemini',
      model: modelUsed,
      userPlan
    });

    // Resolve a supported Gemini model by listing available models once
    async function resolveGeminiModel(preferredCandidates = []) {
      try {
        const strip = (name) => (name || '').replace(/^models\//, '');
        const client = geminiClient;
        const candidates = [...preferredCandidates, process.env.DEFAULT_MODEL, 'gemini-1.5-flash', 'gemini-1.0-pro'].filter(Boolean);
        const list = await client.listModels?.();
        const models = Array.isArray(list?.models) ? list.models : Array.isArray(list) ? list : [];
        const supported = models.filter(m => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'));
        for (const c of candidates) {
          const match = supported.find(m => strip(m.name) === strip(c));
          if (match) return strip(match.name);
        }
        if (supported.length > 0) return strip(supported[0].name);
      } catch (e) {
        // ignore and fallback
      }
      return preferredCandidates[0] || process.env.DEFAULT_MODEL || 'gemini-1.0-pro';
    }

    // Generate AI response using Gemini API
    async function generateRealResponse(message, conversationHistory = []) {
      try {
        // Get the generative model
        const resolved = await resolveGeminiModel([effectiveModel || (process.env.DEFAULT_MODEL || 'gemini-1.5-flash')]);
        const model = geminiClient.getGenerativeModel({
          model: resolved,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        });

        // Format conversation history for Gemini
        let conversationText = 'You are a helpful assistant that provides accurate and concise responses.\n\n';

        // Add conversation history
        if (conversationHistory && conversationHistory.length > 0) {
          for (const msg of conversationHistory) {
            const role = msg.role.toLowerCase() === 'assistant' ? 'Assistant' : 'User';
            conversationText += `${role}: ${msg.content}\n`;
          }
        }

        // Add current user message
        conversationText += `User: ${message}\nAssistant:`;

        // Call Gemini API
        const result = await model.generateContent(conversationText);
        const response = await result.response;

        return response.text();
      } catch (error) {
        console.error('Error calling Gemini API:', error);

        // Check if it's an API key error
        if (error.message && (error.message.includes('API key') || error.message.includes('API_KEY'))) {
          return "There seems to be an issue with the API configuration. Please check your Gemini API key settings.";
        }

        // Check if it's a rate limit error
        if (error.message && (error.message.includes('rate limit') || error.message.includes('quota'))) {
          return "The API rate limit has been reached. Please try again in a few moments.";
        }

        // Check for invalid or deprecated model errors and gracefully fallback to flash
        if (error.message && (error.message.includes('Invalid model') || error.message.includes('not found') || error.message.includes('does not exist'))) {
          try {
            // Fallback to a widely available model determined dynamically
            effectiveModel = await resolveGeminiModel(['gemini-1.5-flash', 'gemini-1.0-pro']);
            geminiClient = getGeminiClient(effectiveModel, userPlan);
            wasDowngraded = true;

            const fallbackModel = geminiClient.getGenerativeModel({
              model: effectiveModel,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
              }
            });

            let conversationText = 'You are a helpful assistant that provides accurate and concise responses.\n\n';
            if (conversationHistory && conversationHistory.length > 0) {
              for (const msg of conversationHistory) {
                const role = msg.role.toLowerCase() === 'assistant' ? 'Assistant' : 'User';
                conversationText += `${role}: ${msg.content}\n`;
              }
            }
            conversationText += `User: ${message}\nAssistant:`;

            const result = await fallbackModel.generateContent(conversationText);
            const response = await result.response;
            return response.text();
          } catch (fallbackError) {
            console.error('Fallback to Gemini model failed:', fallbackError);
            return "The selected AI model is unavailable. Please switch to a supported Gemini model and try again.";
          }
        }

        // Check for network errors
        if (error.message && (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') || error.message.includes('network'))) {
          return "There was a network error connecting to the Gemini AI service. Please check your internet connection and try again.";
        }

        // For all other errors, provide a more helpful message
        return "I'm having trouble processing your request right now. This could be due to high demand or a temporary service issue. Please try again in a few moments.";
      }
    }

    // Generate AI response using selected provider
    let assistantReply;
    if (isOpenAIModel(modelUsed)) {
      try {
        const contextStr = (conversationHistory || [])
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n');
        assistantReply = await generateChatResponse({
          message,
          modelName: modelUsed,
          context: contextStr
        });
      } catch (error) {
        logger.error('Error calling OpenAI:', error);
        assistantReply = "I'm having trouble processing your request right now. Please try again.";
      }
    } else {
      try {
        const ragResponse = await generateRealResponse(message, conversationHistory);
        assistantReply = ragResponse || "I'm having trouble processing your request right now. Please try again.";
      } catch (error) {
        console.error('Error generating response:', error);
        return res.status(500).json({ error: 'Failed to generate AI response' });
      }
    }

    // Cache response only if it's not an error-like message
    const isErrorLike = typeof assistantReply === 'string' && (
      assistantReply.includes('issue with the API configuration') ||
      assistantReply.includes('API rate limit') ||
      assistantReply.includes('model is unavailable') ||
      assistantReply.includes('network error') ||
      assistantReply.includes("I'm having trouble processing your request")
    );
    if (!isErrorLike) {
      await cacheResponse(userId, cacheKey, { output: assistantReply, sessionId: currentSessionId }, cacheTTL);
    }

    // Update usage (approx token count)
    await updateUsage(userId, assistantReply.split(' ').length);

    // Save user message
    {
      const { error: userMsgError } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: currentSessionId,
          user_id: userId,
          role: 'user',
          content: message,
          tokens: message.split(' ').length
        });
      if (userMsgError) {
        logger.error('Error saving user message:', userMsgError);
        return res.status(500).json({ error: 'Failed to save user message' });
      }
    }

    // Save assistant message
    {
      const { error: assistantMsgError } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: currentSessionId,
          user_id: userId,
          role: 'assistant',
          content: assistantReply,
          tokens: assistantReply.split(' ').length,
          model_used: modelUsed
        });
      if (assistantMsgError) {
        logger.error('Error saving assistant message:', assistantMsgError);
        return res.status(500).json({ error: 'Failed to save assistant message' });
      }
    }

    // Update chat session with final message count and potentially update title
    const finalMessageCount = conversationHistory.length + 2; // user + assistant
    let updateData = {
      last_message_at: new Date().toISOString(),
      total_messages: finalMessageCount
    };

    // For new chats, update title with first message content (truncated)
    if (isNewChat) {
      updateData.title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
    }

    {
      const { error: updateError } = await supabase
        .from('chats')
        .update(updateData)
        .eq('id', currentSessionId)
        .eq('user_id', userId);
      if (updateError) {
        logger.warn('Failed to update chat session metadata:', updateError);
      }
    }

    // Invalidate cache again after updates
    try {
      await invalidateCache(`chat:sessions:${userId}:*`);
      logger.info(`🗑️ Invalidated chat sessions cache after update for chat: ${currentSessionId}`);
    } catch (cacheError) {
      logger.warn('Failed to invalidate chat sessions cache:', cacheError);
    }

    res.status(200).json({
      output: assistantReply,
      sessionId: currentSessionId,
      model: isOpenAIModel(modelUsed) ? modelUsed : effectiveModel,
      downgraded: Boolean(downgraded) || wasDowngraded,
      isNewChat: isNewChat,
      routing: routing ? {
        type: routing.type,
        difficulty: routing.difficulty,
        aiAnalyzedDifficulty: routing.aiAnalyzedDifficulty,
        primaryModel: routing.primaryModel,
        fallbackModels: routing.fallbackModels,
        allowed: routing.allowed,
        downgraded: routing.downgraded,
        confidence: routing.confidence,
        nano: routing.enhancedAnalysis?.routingMetadata?.nanoClassification || null,
        provider: isOpenAIModel(modelUsed) ? 'openai' : 'gemini'
      } : undefined
    });

  } catch (error) {
    logger.error('Error in handleText:', error);
    res.status(500).json({ error: 'Failed to process text request' });
  }
}

async function handleImage({ message, userId, userPlan, intent, difficulty, allowed, res }) {
  try {
    const imageResponse = await generateImageSimple(message);

    res.status(200).json({
      output: imageResponse,
      type: 'image',
      model: 'dall-e-3'
    });

  } catch (error) {
    logger.error('Error in handleImage:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
}

async function handleDiagram({ message, userId, userPlan, intent, difficulty, content_type, allowed, res }) {
  try {
    if (!isLucidchartAvailable()) {
      return res.status(503).json({ error: 'Diagram service temporarily unavailable' });
    }

    const diagramResponse = await generateDiagram(message);

    res.status(200).json({
      output: diagramResponse,
      type: 'diagram',
      model: 'lucidchart'
    });

  } catch (error) {
    logger.error('Error in handleDiagram:', error);
    res.status(500).json({ error: 'Failed to generate diagram' });
  }
}

// GET /api/chat/history - Get chat history (most recent session with messages) - OPTIMIZED
router.get('/history', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    const userId = req.user.id;

    const cacheKey = `chat:history:${userId}:${limit}:${offset}`;
    const cachedHistory = await getCachedResponse(userId, cacheKey);

    if (cachedHistory) {
      return res.status(200).json(cachedHistory);
    }

    // Single optimized query to get the most recent chat session with all its messages
    const { data: chatData, error } = await supabase
      .from('chats')
      .select(`
        id, 
        title, 
        model_used, 
        created_at, 
        updated_at,
        chat_messages(
          id, 
          role, 
          content, 
          tokens, 
          model_used, 
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .order('created_at', { foreignTable: 'chat_messages', ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('Error fetching chat history:', error);
      return res.status(500).json({ error: 'Failed to fetch chat history' });
    }

    let messages = [];
    let sessionId = null;

    if (chatData) {
      sessionId = chatData.id;
      messages = chatData.chat_messages || [];
    }

    // Get total session count for user (separate lightweight query)
    const { count: totalSessions, error: countError } = await supabase
      .from('chats')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      logger.warn('Error getting total sessions count:', countError);
    }

    const historyResponse = {
      messages: messages,
      sessionId: sessionId,
      totalSessions: totalSessions || 0
    };

    await cacheResponse(userId, cacheKey, historyResponse, 1800); // Cache for 30 minutes
    res.status(200).json(historyResponse);

  } catch (error) {
    logger.error('Error in GET /api/chat/history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));
module.exports = router;
