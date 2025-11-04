-- Create api_usage table for tracking daily API usage
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    request_count INTEGER DEFAULT 0 NOT NULL,
    token_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one record per user per day
    UNIQUE(user_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON api_usage(user_id, date);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(date);

-- Create RLS (Row Level Security) policies
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own usage records
CREATE POLICY "Users can view own usage" ON api_usage
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own usage records
CREATE POLICY "Users can insert own usage" ON api_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own usage records
CREATE POLICY "Users can update own usage" ON api_usage
    FOR UPDATE USING (auth.uid() = user_id);

-- Create function for incrementing counters
CREATE OR REPLACE FUNCTION increment(n INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(n, 0) + 1;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_api_usage_updated_at
    BEFORE UPDATE ON api_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 