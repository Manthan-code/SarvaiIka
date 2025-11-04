-- =============================================
-- Enable UUID extension
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- Profiles Table
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'plus', 'pro')),
    location TEXT,
    bio TEXT,
    phone TEXT,
    website TEXT,
    avatar_url TEXT,
    company TEXT,
    job_title TEXT,
    social_links JSONB DEFAULT '{}',
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Plans Table
-- =============================================
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    currency TEXT DEFAULT 'USD',
    billing_interval TEXT DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
    features JSONB DEFAULT '[]',
    limitations JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    stripe_price_id TEXT,
    max_messages_per_month INTEGER DEFAULT 1000,
    max_chats INTEGER DEFAULT 100,
    supports_file_upload BOOLEAN DEFAULT FALSE,
    supports_voice_input BOOLEAN DEFAULT FALSE,
    priority_support BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    trial_days INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Subscriptions Table
-- =============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'paused', 'trialing')),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    messages_used INTEGER DEFAULT 0,
    messages_limit INTEGER,
    metadata JSONB DEFAULT '{}',
    canceled_at TIMESTAMPTZ,
    pause_starts_at TIMESTAMPTZ,
    pause_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique constraint via index (one active subscription per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_user_subscription
ON subscriptions(user_id)
WHERE status = 'active';

-- =============================================
-- Subscription Invoices Table
-- =============================================
CREATE TABLE IF NOT EXISTS subscription_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_due NUMERIC(10,2) NOT NULL,
    amount_paid NUMERIC(10,2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    stripe_invoice_id TEXT UNIQUE,
    invoice_pdf_url TEXT,
    hosted_invoice_url TEXT,
    due_date TIMESTAMptz,
    period_start TIMESTAMptz,
    period_end TIMESTAMptz,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMptz DEFAULT NOW(),
    updated_at TIMESTAMptz DEFAULT NOW()
);

-- =============================================
-- Chats Table
-- =============================================
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    model_used TEXT DEFAULT 'gpt-4',
    total_messages INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    last_message_at TIMESTAMptz,
    created_at TIMESTAMptz DEFAULT NOW(),
    updated_at TIMESTAMptz DEFAULT NOW()
);

-- =============================================
-- Chat Messages Table
-- =============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tokens INTEGER DEFAULT 0,
    model_used TEXT,
    parent_message_id UUID REFERENCES chat_messages(id),
    metadata JSONB DEFAULT '{}',
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMptz,
    created_at TIMESTAMptz DEFAULT NOW()
);

-- =============================================
-- Settings Table
-- =============================================
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    preferences JSONB DEFAULT '{
        "theme": "light",
        "language": "en",
        "notifications": {
            "email": true,
            "push": true,
            "sounds": true
        },
        "privacy": {
            "data_collection": true,
            "analytics": true
        },
        "ai": {
            "default_model": "gpt-4",
            "temperature": 0.7,
            "max_tokens": 1000
        }
    }'::jsonb,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    auto_save_chats BOOLEAN DEFAULT TRUE,
    chat_history_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMptz DEFAULT NOW(),
    updated_at TIMESTAMptz DEFAULT NOW(),
    CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- =============================================
-- User Sessions Table (for tracking active sessions)
-- =============================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_info JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    last_active TIMESTAMptz DEFAULT NOW(),
    expires_at TIMESTAMptz NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMptz DEFAULT NOW()
);

-- =============================================
-- Performance Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_plan ON profiles(subscription_plan);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_user_id ON subscription_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_subscription_id ON subscription_invoices(subscription_id);

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at);
CREATE INDEX IF NOT EXISTS idx_chats_last_message_at ON chats(last_message_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- =============================================
-- Insert Default Plans
-- =============================================
INSERT INTO plans (
    id, name, description, price, currency, billing_interval, features, limitations, 
    max_messages_per_month, max_chats, supports_file_upload, supports_voice_input, 
    priority_support, display_order, trial_days, is_active
) VALUES
(
    uuid_generate_v4(),
    'Free',
    'Basic access with limitations',
    0.00,
    'USD',
    'monthly',
    '["5 AI conversations per day", "Basic model access", "Standard response quality", "Email support"]'::jsonb,
    '["No priority access", "Limited conversation history"]'::jsonb,
    150,
    10,
    false,
    false,
    false,
    1,
    0,
    true
),
(
    uuid_generate_v4(),
    'Plus', 
    'Enhanced features for regular users',
    15.00,
    'USD',
    'monthly',
    '["50 AI conversations per day", "Advanced model access", "Improved response quality", "Priority support", "Extended conversation history", "Early feature access"]'::jsonb,
    '[]'::jsonb,
    1500,
    100,
    true,
    false,
    true,
    2,
    7,
    true
),
(
    uuid_generate_v4(),
    'Pro',
    'Complete access for power users', 
    45.00,
    'USD',
    'monthly',
    '["Unlimited AI conversations", "All model access", "Highest response quality", "24/7 dedicated support", "Full conversation history", "Custom instructions", "API access", "Team management features"]'::jsonb,
    '[]'::jsonb,
    NULL,
    NULL,
    true,
    true,
    true,
    3,
    14,
    true
)
ON CONFLICT DO NOTHING;

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Plans policies (read-only for all authenticated users)
DROP POLICY IF EXISTS "Anyone can view plans" ON plans;
CREATE POLICY "Anyone can view plans" ON plans FOR SELECT USING (true);

-- Subscriptions policies
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own subscriptions" ON subscriptions;
CREATE POLICY "Users can manage own subscriptions" ON subscriptions FOR ALL USING (auth.uid() = user_id);

-- Chats policies
DROP POLICY IF EXISTS "Users can view own chats" ON chats;
CREATE POLICY "Users can view own chats" ON chats FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own chats" ON chats;
CREATE POLICY "Users can manage own chats" ON chats FOR ALL USING (auth.uid() = user_id);

-- Chat messages policies
DROP POLICY IF EXISTS "Users can view own chat messages" ON chat_messages;
CREATE POLICY "Users can view own chat messages" ON chat_messages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own chat messages" ON chat_messages;
CREATE POLICY "Users can manage own chat messages" ON chat_messages FOR ALL USING (auth.uid() = user_id);

-- Settings policies
DROP POLICY IF EXISTS "Users can view own settings" ON settings;
CREATE POLICY "Users can view own settings" ON settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own settings" ON settings;
CREATE POLICY "Users can manage own settings" ON settings FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- Trigger Function for updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
CREATE TRIGGER update_plans_updated_at 
    BEFORE UPDATE ON plans 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at 
    BEFORE UPDATE ON subscriptions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chats_updated_at ON chats;
CREATE TRIGGER update_chats_updated_at 
    BEFORE UPDATE ON chats 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at 
    BEFORE UPDATE ON settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Profile Sync Function and Trigger
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Function to sync existing users
-- =============================================
CREATE OR REPLACE FUNCTION sync_existing_users_to_profiles()
RETURNS void AS $$
BEGIN
    INSERT INTO profiles (id, name, email, created_at, updated_at)
    SELECT 
        id, 
        COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', 'User'),
        email,
        created_at,
        NOW()
    FROM auth.users 
    WHERE id NOT IN (SELECT id FROM profiles)
    ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Helper Functions
-- =============================================
-- Function to get user's current active subscription
CREATE OR REPLACE FUNCTION get_user_active_subscription(user_uuid UUID)
RETURNS TABLE (
    subscription_id UUID,
    plan_id UUID,
    plan_name TEXT,
    status TEXT,
    current_period_end TIMESTAMPTZ,
    messages_used INTEGER,
    messages_limit INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.plan_id,
        p.name,
        s.status,
        s.current_period_end,
        s.messages_used,
        s.messages_limit
    FROM subscriptions s
    LEFT JOIN plans p ON s.plan_id = p.id
    WHERE s.user_id = user_uuid AND s.status = 'active'
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can send more messages
CREATE OR REPLACE FUNCTION can_user_send_message(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_plan TEXT;
    sub_record RECORD;
BEGIN
    -- First check the simple profile plan
    SELECT subscription_plan INTO user_plan FROM profiles WHERE id = user_uuid;
    
    -- If free plan, check message limits
    IF user_plan = 'free' THEN
        SELECT * INTO sub_record FROM get_user_active_subscription(user_uuid);
        
        -- If no subscription record or messages exceeded
        IF sub_record IS NULL OR 
           (sub_record.messages_limit IS NOT NULL AND sub_record.messages_used >= sub_record.messages_limit) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;



-- Create index for background images
CREATE INDEX IF NOT EXISTS idx_background_images_category ON background_images(category);
CREATE INDEX IF NOT EXISTS idx_background_images_tier ON background_images(tier_required);
CREATE INDEX IF NOT EXISTS idx_background_images_active ON background_images(is_active);

-- =============================================
-- Sync existing users immediately
-- =============================================
SELECT sync_existing_users_to_profiles();

-- =============================================
-- Create settings for existing users
-- =============================================
INSERT INTO settings (user_id, created_at, updated_at)
SELECT id, NOW(), NOW()
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM settings)
ON CONFLICT (user_id) DO NOTHING;