-- Table for storing AI-generated image metadata
CREATE TABLE IF NOT EXISTS generated_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size VARCHAR(20),
  quality VARCHAR(10),
  style VARCHAR(10),
  model VARCHAR(50) DEFAULT 'dall-e-3',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster user queries
CREATE INDEX IF NOT EXISTS idx_generated_images_user_id ON generated_images(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images(created_at DESC);

-- Enable RLS
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own generated images
CREATE POLICY "Users can view own generated images"
  ON generated_images
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own generated images
CREATE POLICY "Users can insert own generated images"
  ON generated_images
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own generated images
CREATE POLICY "Users can delete own generated images"
  ON generated_images
  FOR DELETE
  USING (auth.uid() = user_id);

-- Optional: Add a function to clean up old images (30 days)
CREATE OR REPLACE FUNCTION cleanup_old_generated_images()
RETURNS void AS $$
BEGIN
  DELETE FROM generated_images
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-old-images', '0 2 * * *', 'SELECT cleanup_old_generated_images()');
