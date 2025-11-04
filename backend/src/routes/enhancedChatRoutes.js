const express = require('express');
const { requireAuth } = require('../middlewares/authMiddleware.js');
const supabaseAdmin = require('../db/supabase/admin.js');
const { getCachedResponse, cacheResponse, invalidateCache } = require('../redis/redisHelpers.js');
const logger = require('../config/logger.js');

const router = express.Router();
const supabase = supabaseAdmin;

// GET /api/enhanced-chat/recent - Get recent chats with enhanced caching
router.get('/recent', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10, force } = req.query;
    const cacheKey = `enhanced:recent_chats:${userId}:${limit}`;
    
    // Check cache first (unless force refresh)
    if (!force) {
      const cachedChats = await getCachedResponse(userId, cacheKey);
      if (cachedChats) {
        return res.status(200).json({
          data: cachedChats,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Fetch recent chats with enhanced metadata
    const { data: chats, error } = await supabase
      .from('chats')
      .select(`
        id,
        title,
        created_at,
        last_message_at,
        total_messages,
        model_used,
        chat_messages!inner(
          id,
          content,
          role,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      logger.error('Error fetching recent chats:', error);
      return res.status(500).json({ error: 'Failed to fetch recent chats' });
    }

    // Process and enhance chat data
    const enhancedChats = chats?.map(chat => {
      // Get last message preview
      const lastMessage = chat.chat_messages
        ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      
      return {
        id: chat.id,
        title: chat.title,
        created_at: chat.created_at,
        last_message_at: chat.last_message_at,
        total_messages: chat.total_messages,
        model_used: chat.model_used,
        last_message_preview: lastMessage ? {
          content: lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? '...' : ''),
          role: lastMessage.role,
          created_at: lastMessage.created_at
        } : null
      };
    }) || [];

    // Cache with 5-minute TTL
    await cacheResponse(userId, cacheKey, enhancedChats, 300);
    
    res.status(200).json({
      data: enhancedChats,
      cached: false,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error in enhanced recent chats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/enhanced-chat/:id/messages - Get chat messages with capping
router.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { limit = 5, offset = 0, force } = req.query;
    const cacheKey = `enhanced:chat_messages:${id}:${limit}:${offset}`;
    
    // Check cache first
    if (!force) {
      const cachedMessages = await getCachedResponse(userId, cacheKey);
      if (cachedMessages) {
        return res.status(200).json({
          ...cachedMessages,
          cached: true
        });
      }
    }
    
    // Verify chat ownership
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, user_id, total_messages')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Fetch messages with pagination (most recent first)
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('id, role, content, tokens, model_used, created_at')
      .eq('chat_id', id)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (messagesError) {
      logger.error('Error fetching chat messages:', messagesError);
      return res.status(500).json({ error: 'Failed to fetch chat messages' });
    }

    // Reverse to get chronological order
    const chronologicalMessages = messages?.reverse() || [];
    
    const responseData = {
      chat_id: id,
      messages: chronologicalMessages,
      total_messages: chat.total_messages,
      has_more: (parseInt(offset) + parseInt(limit)) < chat.total_messages,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: chat.total_messages
      }
    };

    // Cache with 10-minute TTL
    await cacheResponse(userId, cacheKey, responseData, 600);
    
    res.status(200).json({
      ...responseData,
      cached: false
    });
    
  } catch (error) {
    logger.error('Error in enhanced chat messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;