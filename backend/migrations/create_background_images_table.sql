-- Create background_images table for storing background image metadata
-- This table stores information about background images uploaded to Cloudinary

CREATE TABLE IF NOT EXISTS background_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    cloudinary_public_id VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    tier_required VARCHAR(20) DEFAULT 'free' CHECK (tier_required IN ('free', 'pro', 'premium')),
    is_active BOOLEAN DEFAULT true,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    format VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_background_images_category ON background_images(category);
CREATE INDEX IF NOT EXISTS idx_background_images_tier ON background_images(tier_required);
CREATE INDEX IF NOT EXISTS idx_background_images_active ON background_images(is_active);
CREATE INDEX IF NOT EXISTS idx_background_images_created_at ON background_images(created_at);

-- Create RLS policies
ALTER TABLE background_images ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active background images
CREATE POLICY "Anyone can view active background images" ON background_images
    FOR SELECT USING (is_active = true);

-- Policy: Authenticated users can view all background images
CREATE POLICY "Authenticated users can view all background images" ON background_images
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Only admins can insert background images
CREATE POLICY "Only admins can insert background images" ON background_images
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Policy: Only admins can update background images
CREATE POLICY "Only admins can update background images" ON background_images
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Policy: Only admins can delete background images
CREATE POLICY "Only admins can delete background images" ON background_images
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_background_images_updated_at 
    BEFORE UPDATE ON background_images 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration completed successfully
-- Default background images can be added later through the admin interface