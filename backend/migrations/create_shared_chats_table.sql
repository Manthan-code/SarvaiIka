-- Migration: Create shared_chats table for public sharing
-- Description: Stores immutable snapshots of chats for public viewing

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create shared_chats table
CREATE TABLE IF NOT EXISTS shared_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_id TEXT UNIQUE NOT NULL,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  is_public BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shared_chats_share_id ON shared_chats(share_id);
CREATE INDEX IF NOT EXISTS idx_shared_chats_owner_id ON shared_chats(owner_id);
CREATE INDEX IF NOT EXISTS idx_shared_chats_chat_id ON shared_chats(chat_id);

-- Enable RLS
ALTER TABLE shared_chats ENABLE ROW LEVEL SECURITY;

-- Policies
-- Anyone can view public shared chats
DROP POLICY IF EXISTS "Anyone can view public shared chats" ON shared_chats;
CREATE POLICY "Anyone can view public shared chats" ON shared_chats
FOR SELECT USING (is_public = TRUE);

-- Owners can insert their shared chats
DROP POLICY IF EXISTS "Owners can insert shared chats" ON shared_chats;
CREATE POLICY "Owners can insert shared chats" ON shared_chats
FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Owners can update their shared chats (e.g., toggle is_public or set expires_at)
DROP POLICY IF EXISTS "Owners can update shared chats" ON shared_chats;
CREATE POLICY "Owners can update shared chats" ON shared_chats
FOR UPDATE USING (auth.uid() = owner_id);

-- Owners can delete their shared chats
DROP POLICY IF EXISTS "Owners can delete shared chats" ON shared_chats;
CREATE POLICY "Owners can delete shared chats" ON shared_chats
FOR DELETE USING (auth.uid() = owner_id);