const OpenAI = require('openai');
const dotenv = require('dotenv');
const logger = require('../config/logger.js');
const { downloadAndStoreImage } = require('./fileStorageService.js');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

// Initialize DALL-E OpenAI client
const dalleOpenAI = new OpenAI({
  apiKey: process.env.DALL_E_API_KEY || process.env.OPENAI_API_KEY
});

// Initialize Supabase client for database operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

/**
 * Generate image using DALL-E and store permanently
 * @param {string} prompt - The image generation prompt
 * @param {string} userId - User ID for storage organization
 * @param {string} size - Image size (1024x1024, 1792x1024, 1024x1792)
 * @param {string} quality - Image quality (standard, hd)
 * @param {string} style - Image style (vivid, natural)
 * @returns {Promise<{success: boolean, imageUrl?: string, imageId?: string, error?: string}>}
 */
async function generateImage(prompt, userId, size = '1024x1024', quality = 'standard', style = 'vivid') {
  try {
    logger.info(`🎨 Generating image with DALL-E: "${prompt}"`);

    // Generate image with DALL-E
    const response = await dalleOpenAI.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      size: size,
      quality: quality,
      style: style,
      n: 1
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No image data received from DALL-E');
    }

    const temporaryUrl = response.data[0].url;
    logger.info('✅ Image generated, downloading and storing...');

    // Download and store image permanently
    const filename = prompt.substring(0, 50).replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const storageResult = await downloadAndStoreImage(temporaryUrl, userId, filename);

    if (!storageResult.success) {
      throw new Error(storageResult.error || 'Failed to store image');
    }

    // Save metadata to database
    const { data: imageRecord, error: dbError } = await supabase
      .from('generated_images')
      .insert({
        user_id: userId,
        prompt: prompt,
        image_url: storageResult.url,
        storage_path: storageResult.path,
        size: size,
        quality: quality,
        style: style,
        model: 'dall-e-3'
      })
      .select()
      .single();

    if (dbError) {
      logger.error('Failed to save image metadata:', dbError);
      // Don't fail the request if metadata save fails
    }

    logger.info('✅ Image stored permanently');

    return {
      success: true,
      imageUrl: storageResult.url,
      imageId: imageRecord?.id,
      prompt: prompt,
      size: size,
      quality: quality,
      style: style
    };

  } catch (error) {
    logger.error('❌ DALL-E image generation failed:', error);

    return {
      success: false,
      error: error.message || 'Failed to generate image',
      prompt: prompt
    };
  }
}

/**
 * Generate image with default settings
 * @param {string} prompt - The image generation prompt
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, imageUrl?: string, error?: string}>}
 */
async function generateImageSimple(prompt, userId) {
  return generateImage(prompt, userId, '1024x1024', 'standard', 'vivid');
}

/**
 * Generate high-quality image
 * @param {string} prompt - The image generation prompt
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, imageUrl?: string, error?: string}>}
 */
async function generateHighQualityImage(prompt, userId) {
  return generateImage(prompt, userId, '1024x1024', 'hd', 'vivid');
}

/**
 * Get user's generated images
 * @param {string} userId - User ID
 * @param {number} limit - Number of images to retrieve
 * @returns {Promise<Array>}
 */
async function getUserImages(userId, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('generated_images')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch user images:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Error fetching user images:', error);
    return [];
  }
}

module.exports = {
  generateImage,
  generateImageSimple,
  generateHighQualityImage,
  getUserImages
};