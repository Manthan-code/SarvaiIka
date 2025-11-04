-- =============================================
-- Fix Background Images Tier Mismatch Migration
-- =============================================

-- Step 1: Remove the existing constraint
ALTER TABLE background_images 
DROP CONSTRAINT IF EXISTS background_images_tier_required_check;

-- Step 2: Update existing records to match the Plans table structure
-- First, store the current 'pro' tier images in a temporary table to avoid conflicts
CREATE TEMP TABLE temp_pro_images AS 
SELECT id FROM background_images WHERE tier_required = 'pro';

-- Update 'premium' to 'pro' (highest tier)
UPDATE background_images 
SET tier_required = 'pro', updated_at = NOW()
WHERE tier_required = 'premium';

-- Update the original 'pro' images to 'plus' (middle tier)
UPDATE background_images 
SET tier_required = 'plus', updated_at = NOW()
WHERE id IN (SELECT id FROM temp_pro_images);

-- Step 3: Add the new constraint with correct values
ALTER TABLE background_images 
ADD CONSTRAINT background_images_tier_required_check 
CHECK (tier_required IN ('free', 'plus', 'pro'));

-- Clean up
DROP TABLE temp_pro_images;

-- Add a comment to document the change
COMMENT ON COLUMN background_images.tier_required IS 'Subscription tier required to access this background image. Must match Plans table: free, plus, pro';