-- Migration: Add background_image_id column to settings table
-- This column will store the ID of the selected background image for each user

-- Add the background_image_id column
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS background_image_id UUID REFERENCES background_images(id) ON DELETE SET NULL;

-- Add an index for better performance when querying by background_image_id
CREATE INDEX IF NOT EXISTS idx_settings_background_image_id ON settings(background_image_id);

-- Add a comment to document the column
COMMENT ON COLUMN settings.background_image_id IS 'References the background image selected by the user';

-- Migration completed successfully