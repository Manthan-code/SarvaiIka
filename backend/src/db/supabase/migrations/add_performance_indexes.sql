-- Chat messages performance (most critical)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_user_created 
  ON chat_messages(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_chat_created 
  ON chat_messages(chat_id, created_at DESC);

-- Chat performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chats_user_updated 
  ON chats(user_id, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chats_user_created 
  ON chats(user_id, created_at DESC);

-- Subscription queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_user_status 
  ON subscriptions(user_id, status) 
  WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_stripe_id 
  ON subscriptions(stripe_subscription_id) 
  WHERE stripe_subscription_id IS NOT NULL;

-- Profile lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_email 
  ON profiles(email) 
  WHERE email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_subscription_plan 
  ON profiles(subscription_plan) 
  WHERE subscription_plan != 'free';

-- Session management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_user_active 
  ON user_sessions(user_id, is_active, last_activity) 
  WHERE is_active = true;

-- Settings lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settings_user_key 
  ON settings(user_id, setting_key);

-- Analyze tables for better query planning
ANALYZE profiles;
ANALYZE chats;
ANALYZE chat_messages;
ANALYZE subscriptions;
ANALYZE settings;
ANALYZE user_sessions;