ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP NULL;