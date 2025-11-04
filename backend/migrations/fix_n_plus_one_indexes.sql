-- Migration: Fix N+1 Query Performance Issues
-- Created: 2024-01-XX
-- Description: Add database indexes to support optimized queries and prevent N+1 issues

-- Index for chat messages by chat_id (for chat/:id route optimization)
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id_created_at 
ON chat_messages(chat_id, created_at DESC);

-- Index for chat messages by user_id for faster user-specific queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_lookup 
ON chat_messages(chat_id) 
WHERE chat_id IN (SELECT id FROM chats WHERE user_id IS NOT NULL);

-- Index for chats by user_id and updated_at (for history route optimization)
CREATE INDEX IF NOT EXISTS idx_chats_user_updated_at 
ON chats(user_id, updated_at DESC);

-- Index for subscriptions by user_id and status (for subscription route optimization)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status 
ON subscriptions(user_id, status) 
WHERE status = 'active';

-- Index for subscriptions by user_id and created_at (for subscription listing)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_created_at 
ON subscriptions(user_id, created_at DESC);

-- Index for user_usage by user_id (for profile route optimization)
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id 
ON user_usage(user_id);

-- Index for plans table (frequently joined)
CREATE INDEX IF NOT EXISTS idx_plans_name 
ON plans(name);

-- Composite index for chat ownership verification
CREATE INDEX IF NOT EXISTS idx_chats_id_user_id 
ON chats(id, user_id);

-- Index for profiles by subscription_plan (for plan-based queries)
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_plan 
ON profiles(subscription_plan) 
WHERE subscription_plan IS NOT NULL;

-- Analyze tables to update statistics after index creation
ANALYZE chats;
ANALYZE chat_messages;
ANALYZE subscriptions;
ANALYZE plans;
ANALYZE user_usage;
ANALYZE profiles;

-- Comments for documentation
COMMENT ON INDEX idx_chat_messages_chat_id_created_at IS 'Optimizes chat message retrieval by chat_id with ordering';
COMMENT ON INDEX idx_chats_user_updated_at IS 'Optimizes user chat history queries';
COMMENT ON INDEX idx_subscriptions_user_status IS 'Optimizes active subscription lookups';
COMMENT ON INDEX idx_user_usage_user_id IS 'Optimizes user usage statistics retrieval';
COMMENT ON INDEX idx_plans_name IS 'Optimizes plan lookups by name';
COMMENT ON INDEX idx_chats_id_user_id IS 'Optimizes chat ownership verification';