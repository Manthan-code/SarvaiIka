-- Fix the background_images table constraint to allow 'plus' tier
-- This script manually updates the constraint to match the Plans table structure

-- Drop the existing constraint
ALTER TABLE background_images DROP CONSTRAINT background_images_tier_required_check;

-- Add the new constraint with correct tier values
ALTER TABLE background_images ADD CONSTRAINT background_images_tier_required_check 
    CHECK (tier_required IN ('free', 'plus', 'pro'));

-- Update any remaining 'pro' tier images to 'plus' tier
UPDATE background_images 
SET tier_required = 'plus', updated_at = NOW()
WHERE tier_required = 'pro';

-- Verify the final state
SELECT tier_required, COUNT(*) as count 
FROM background_images 
GROUP BY tier_required 
ORDER BY tier_required;