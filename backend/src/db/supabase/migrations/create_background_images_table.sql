-- =============================================
-- Background Images Table Migration
-- =============================================

-- Create background_images table
CREATE TABLE IF NOT EXISTS background_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    tier_required VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (tier_required IN ('free', 'pro', 'premium')),
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    file_size INTEGER, -- in bytes
    dimensions JSONB DEFAULT '{"width": 1920, "height": 1080}',
    tags TEXT[], -- array of tags for better categorization
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_url CHECK (url ~ '^https?://'),
    CONSTRAINT valid_category CHECK (category IN ('nature', 'abstract', 'minimal', 'gradient', 'texture', 'space', 'urban', 'artistic', 'general'))
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_background_images_category ON background_images(category);
CREATE INDEX IF NOT EXISTS idx_background_images_tier ON background_images(tier_required);
CREATE INDEX IF NOT EXISTS idx_background_images_active ON background_images(is_active);
CREATE INDEX IF NOT EXISTS idx_background_images_created_at ON background_images(created_at);
CREATE INDEX IF NOT EXISTS idx_background_images_usage_count ON background_images(usage_count);

-- Enable RLS
ALTER TABLE background_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin can do everything
DROP POLICY IF EXISTS "Admins can manage all background images" ON background_images;
CREATE POLICY "Admins can manage all background images" ON background_images 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- Users can view active background images
DROP POLICY IF EXISTS "Users can view active background images" ON background_images;
CREATE POLICY "Users can view active background images" ON background_images 
FOR SELECT USING (is_active = true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_background_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_background_images_updated_at ON background_images;
CREATE TRIGGER trigger_update_background_images_updated_at
    BEFORE UPDATE ON background_images
    FOR EACH ROW
    EXECUTE FUNCTION update_background_images_updated_at();

-- Insert some default background images
INSERT INTO background_images (name, description, url, category, tier_required, is_active) VALUES
('Default Light', 'Clean light background for professional use', 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&h=1080&fit=crop', 'minimal', 'free', true),
('Default Dark', 'Elegant dark background for focused work', 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&h=1080&fit=crop', 'minimal', 'free', true),
('Ocean Waves', 'Calming ocean waves background', 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1920&h=1080&fit=crop', 'nature', 'free', true),
('Mountain Vista', 'Inspiring mountain landscape', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop', 'nature', 'pro', true),
('Abstract Gradient', 'Modern gradient design', 'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=1920&h=1080&fit=crop', 'gradient', 'pro', true),
('Space Nebula', 'Cosmic nebula background', 'https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=1920&h=1080&fit=crop', 'space', 'premium', true),
('Urban Skyline', 'City skyline at night', 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&h=1080&fit=crop', 'urban', 'premium', true),
('Artistic Texture', 'Creative textured background', 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1920&h=1080&fit=crop', 'artistic', 'premium', true)
ON CONFLICT DO NOTHING;

-- Update settings table to include background_image_id
ALTER TABLE settings ADD COLUMN IF NOT EXISTS background_image_id UUID REFERENCES background_images(id) ON DELETE SET NULL;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS custom_background_url TEXT;

-- Add index for background image reference
CREATE INDEX IF NOT EXISTS idx_settings_background_image_id ON settings(background_image_id);

-- Comment
COMMENT ON TABLE background_images IS 'Stores background images that users can select for their chat interface';
COMMENT ON COLUMN background_images.tier_required IS 'Minimum subscription tier required to use this background';
COMMENT ON COLUMN background_images.usage_count IS 'Number of times this background has been selected by users';
COMMENT ON COLUMN background_images.dimensions IS 'Image dimensions as JSON object with width and height';
COMMENT ON COLUMN background_images.tags IS 'Array of tags for categorization and search';