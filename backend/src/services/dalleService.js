const OpenAI = require('openai');
const dotenv = require('dotenv');
const logger = require('../config/logger.js');

dotenv.config();

// Initialize DALL-E OpenAI client
const dalleOpenAI = new OpenAI({ 
  apiKey: process.env.DALL_E_API_KEY || process.env.OPENAI_API_KEY 
});

/**
 * Generate image using DALL-E
 * @param {string} prompt - The image generation prompt
 * @param {string} size - Image size (1024x1024, 1792x1024, 1024x1792)
 * @param {string} quality - Image quality (standard, hd)
 * @param {string} style - Image style (vivid, natural)
 * @returns {Promise<{success: boolean, imageUrl?: string, error?: string}>}
 */
async function generateImage(prompt, size = '1024x1024', quality = 'standard', style = 'vivid') {
  try {
    logger.info(`🎨 Generating image with DALL-E: "${prompt}"`);
    
    const response = await dalleOpenAI.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      size: size,
      quality: quality,
      style: style,
      n: 1
    });
    
    if (response.data && response.data.length > 0) {
      const imageUrl = response.data[0].url;
      logger.info('✅ Image generated successfully');
      
      return {
        success: true,
        imageUrl: imageUrl,
        prompt: prompt,
        size: size,
        quality: quality,
        style: style
      };
    } else {
      throw new Error('No image data received from DALL-E');
    }
    
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
 * @returns {Promise<{success: boolean, imageUrl?: string, error?: string}>}
 */
async function generateImageSimple(prompt) {
  return generateImage(prompt, '1024x1024', 'standard', 'vivid');
}

/**
 * Generate high-quality image
 * @param {string} prompt - The image generation prompt
 * @returns {Promise<{success: boolean, imageUrl?: string, error?: string}>}
 */
async function generateHighQualityImage(prompt) {
  return generateImage(prompt, '1024x1024', 'hd', 'vivid');
}

module.exports = {
  generateImage,
  generateImageSimple,
  generateHighQualityImage
};