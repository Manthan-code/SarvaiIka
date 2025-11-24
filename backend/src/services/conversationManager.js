const redisClient = require('../redis/unifiedRedisClient.js');
const logger = require('../config/logger.js');
const supabase = require('../db/supabase/admin.js');

class ConversationManager {
  constructor() {
    this.redisClient = redisClient;
  }

  // Basic UUID v4 format check (fallbacks to general UUID format)
  isValidUuid(id) {
    if (typeof id !== 'string') return false;
    const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const uuidGeneric = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidV4.test(id) || uuidGeneric.test(id);
  }

  // Generate a unique conversation ID
  generateConversationId() {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create a new chat session
  async createConversation(userId, title = 'New Chat') {
    try {
      // Create chat in PostgreSQL
      const { data, error } = await supabase
        .from('chats')
        .insert({
          user_id: userId,
          title,
          created_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
          total_messages: 0
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating conversation:', error);
        throw error;
      }

      // Cache conversation in Redis
      await this.redisClient.setex(
        `chat:${data.id}`,
        3600, // 1 hour TTL
        JSON.stringify({
          id: data.id,
          userId,
          title,
          messages: [],
          createdAt: data.created_at,
          updatedAt: data.last_message_at
        })
      );

      return data;
    } catch (error) {
      logger.error('Error in createConversation:', error);
      throw error;
    }
  }

  // Get chat by ID (or create if not exists)
  async getConversation(conversationId, userId) {
    try {
      // If missing or not a valid UUID, create a new conversation
      if (!conversationId || !this.isValidUuid(conversationId)) {
        if (conversationId && !this.isValidUuid(conversationId)) {
          logger.warn('Invalid sessionId format detected, creating new conversation instead:', conversationId);
        }
        // Create a new chat if no session provided
        const created = await this.createConversation(userId);
        return { id: created.id, user_id: userId, title: created.title, messages: [] };
      }

      // Try Redis cache first
      const cached = await this.redisClient.get(`chat:${conversationId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fallback to PostgreSQL: fetch chat metadata
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (chatError) {
        logger.error('Error fetching chat:', chatError);
        throw chatError;
      }

      // Fetch messages for the chat
      const { data: msgRows, error: msgError } = await supabase
        .from('chat_messages')
        .select('id, content, role, model_used, created_at, metadata')
        .eq('chat_id', conversationId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (msgError) {
        logger.error('Error fetching chat messages:', msgError);
        throw msgError;
      }

      // Filter out legacy summary messages (cleanup)
      const cleanMessages = (msgRows || []).filter(m => {
        const content = m.content || '';
        if (m.role === 'assistant' && (
          content.startsWith('The conversation involves') ||
          content.startsWith('The conversation features') ||
          content.startsWith('The user confirms') ||
          content.startsWith('The user asks') ||
          content.includes('summarize paragraph for cotext')
        )) {
          return false;
        }
        return true;
      });

      const conversation = {
        id: chat.id,
        user_id: chat.user_id,
        title: chat.title,
        summary: chat.summary, // Return the summary field
        messages: cleanMessages.map(m => ({
          role: m.role,
          content: m.content,
          model: m.model_used, // Map for frontend
          model_used: m.model_used,
          created_at: m.created_at
        }))
      };

      // Cache the result
      await this.redisClient.setex(
        `chat:${conversationId}`,
        3600,
        JSON.stringify(conversation)
      );

      return conversation;
    } catch (error) {
      logger.error('Error in getConversation:', error);
      throw error;
    }
  }

  // Update conversation summary in DB
  async updateSummary(conversationId, summary) {
    try {
      const { error } = await supabase
        .from('chats')
        .update({ summary })
        .eq('id', conversationId);

      if (error) {
        logger.error('Error updating summary:', error);
        throw error;
      }

      // Invalidate cache
      await this.redisClient.del(`chat:${conversationId}`);
    } catch (error) {
      logger.error('Error in updateSummary:', error);
      // Don't throw, just log - summary update failure shouldn't break the chat
    }
  }

  // Add message to chat (non-streaming helper, now using chat tables)
  async addMessage(conversationId, message) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: conversationId,
          user_id: message.userId,
          content: message.content,
          role: message.role,
          model_used: message.modelUsed,
          metadata: message.metadata || {},
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        logger.error('Error adding message:', error);
        throw error;
      }

      // Update Redis cache
      const cached = await this.redisClient.get(`chat:${conversationId}`);
      if (cached) {
        const conversation = JSON.parse(cached);
        conversation.messages = conversation.messages || [];
        conversation.messages.push({
          role: data.role,
          content: data.content,
          model: data.model_used, // Map for frontend
          model_used: data.model_used,
          created_at: data.created_at
        });
        conversation.updatedAt = new Date().toISOString();

        await this.redisClient.setex(
          `chat:${conversationId}`,
          3600,
          JSON.stringify(conversation)
        );
      }

      // Update conversation timestamp
      await supabase
        .from('chats')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      return data;
    } catch (error) {
      logger.error('Error in addMessage:', error);
      throw error;
    }
  }

  // Update message content (for streaming updates)
  async updateMessage(messageId, content, metadata = {}) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .update({
          content,
          metadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating message:', error);
        throw error;
      }

      // Invalidate Redis cache for the conversation
      const conversationId = data.chat_id;
      await this.redisClient.del(`chat:${conversationId}`);

      return data;
    } catch (error) {
      logger.error('Error in updateMessage:', error);
      throw error;
    }
  }

  // Get user's chat list
  async getUserConversations(userId, limit = 50, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('id, title, created_at, last_message_at, total_messages')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error fetching user conversations:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error in getUserConversations:', error);
      throw error;
    }
  }

  // Delete chat
  async deleteConversation(conversationId) {
    try {
      // Delete from PostgreSQL (messages will be deleted via CASCADE)
      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', conversationId);

      if (error) {
        logger.error('Error deleting conversation:', error);
        throw error;
      }

      // Remove from Redis cache
      await this.redisClient.del(`chat:${conversationId}`);

      return { success: true };
    } catch (error) {
      logger.error('Error in deleteConversation:', error);
      throw error;
    }
  }

  // Update chat title
  async updateConversationTitle(conversationId, title) {
    try {
      const { data, error } = await supabase
        .from('chats')
        .update({
          title,
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating conversation title:', error);
        throw error;
      }

      // Update Redis cache
      const cached = await this.redisClient.get(`chat:${conversationId}`);
      if (cached) {
        const conversation = JSON.parse(cached);
        conversation.title = title;
        conversation.updatedAt = data.last_message_at;

        await this.redisClient.setex(
          `chat:${conversationId}`,
          3600,
          JSON.stringify(conversation)
        );
      }

      return data;
    } catch (error) {
      logger.error('Error in updateConversationTitle:', error);
      throw error;
    }
  }

  // Streaming helpers expected by StreamingService
  async saveIncremental(sessionId, userId, content) {
    try {
      // Accumulate partial assistant response in Redis only
      const key = `chat:partial:${sessionId}:${userId}`;
      const existing = await this.redisClient.get(key);
      const updated = (existing || '') + content;
      await this.redisClient.setex(key, 600, updated); // 10 minutes TTL
      return { success: true };
    } catch (error) {
      logger.warn('saveIncremental error (non-fatal):', error);
      return { success: false };
    }
  }

  async saveMessage(sessionId, userId, userMessage, assistantMessage, modelUsed, type = 'text') {
    try {
      // Ensure chat exists
      const { data: chat, error: chatErr } = await supabase
        .from('chats')
        .select('id, total_messages')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      let currentSessionId = sessionId;
      let totalMessages = 0;
      if (chatErr || !chat) {
        const created = await this.createConversation(userId, String(userMessage).substring(0, 50));
        currentSessionId = created.id;
        totalMessages = 0;
      } else {
        totalMessages = chat.total_messages || 0;
      }

      // Insert user message
      await supabase
        .from('chat_messages')
        .insert({
          chat_id: currentSessionId,
          user_id: userId,
          role: 'user',
          content: userMessage,
          tokens: String(userMessage || '').split(/\s+/).length,
          model_used: modelUsed,
          metadata: { type }
        });

      // Insert assistant message
      await supabase
        .from('chat_messages')
        .insert({
          chat_id: currentSessionId,
          user_id: userId,
          role: 'assistant',
          content: assistantMessage,
          tokens: String(assistantMessage || '').split(/\s+/).length,
          model_used: modelUsed,
          metadata: { type }
        });

      // Update chat metadata
      await supabase
        .from('chats')
        .update({
          last_message_at: new Date().toISOString(),
          total_messages: totalMessages + 2,
          title: totalMessages === 0 ? String(userMessage).substring(0, 50) : undefined
        })
        .eq('id', currentSessionId)
        .eq('user_id', userId);

      // Invalidate Redis cache for chat
      await this.redisClient.del(`chat:${currentSessionId}`);

      return { id: currentSessionId };
    } catch (error) {
      logger.error('Error in saveMessage:', error);
      // Non-fatal: allow streaming to succeed even if persistence fails
      return { id: sessionId, error: error?.message };
    }
  }
}

module.exports = new ConversationManager();