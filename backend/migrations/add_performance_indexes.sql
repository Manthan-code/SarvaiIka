-- Performance indexes for cursor-based pagination and query optimization
-- This migration adds indexes to support efficient cursor-based pagination
-- and resolves performance issues with large datasets

-- Chat-related indexes for cursor-based pagination
CREATE INDEX IF NOT EXISTS idx_chats_user_updated_at 
  ON chats(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chats_user_created_at 
  ON chats(user_id, created_at DESC);

-- Chat messages indexes for efficient message loading
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_created_at 
  ON chat_messages(chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at 
  ON chat_messages(created_at DESC);

-- User-related indexes for profile and subscription queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status 
  ON subscriptions(user_id, status) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_user_usage_user_id 
  ON user_usage(user_id);

-- Composite indexes for enhanced profile queries
CREATE INDEX IF NOT EXISTS idx_profiles_id_subscription_plan 
  ON profiles(id, subscription_plan);

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_chats_last_message_at 
  ON chats(last_message_at DESC) 
  WHERE last_message_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_role_created_at 
  ON chat_messages(role, created_at DESC);

-- Analyze tables to update statistics for query planner
ANALYZE chats;
ANALYZE chat_messages;
ANALYZE profiles;
ANALYZE subscriptions;
ANALYZE user_usage;
ANALYZE plans;

-- Comments explaining the indexes
COMMENT ON INDEX idx_chats_user_updated_at IS 'Supports cursor-based pagination on chats by user and updated_at';
COMMENT ON INDEX idx_chats_user_created_at IS 'Supports cursor-based pagination on chats by user and created_at';
COMMENT ON INDEX idx_chat_messages_chat_created_at IS 'Optimizes message loading within chats with cursor pagination';
COMMENT ON INDEX idx_subscriptions_user_status IS 'Optimizes active subscription lookups for enhanced profiles';
COMMENT ON INDEX idx_user_usage_user_id IS 'Optimizes user usage data retrieval for enhanced profiles';