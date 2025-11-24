const express = require('express');
const router = express.Router();
const { generateImage, generateImageSimple, getUserImages } = require('../services/dalleService');
const { requireAuth } = require('../middlewares/authMiddleware');
const logger = require('../config/logger');

/**
 * @route POST /api/images/generate
 * @desc Generate image with DALL-E
 * @access Private
 */
router.post('/generate', requireAuth, async (req, res) => {
    try {
        const { prompt, size, quality, style } = req.body;
        const userId = req.user.id;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Validate size if provided
        const validSizes = ['1024x1024', '1792x1024', '1024x1792'];
        if (size && !validSizes.includes(size)) {
            return res.status(400).json({ error: 'Invalid size. Must be one of: ' + validSizes.join(', ') });
        }

        // Validate quality if provided
        const validQualities = ['standard', 'hd'];
        if (quality && !validQualities.includes(quality)) {
            return res.status(400).json({ error: 'Invalid quality. Must be one of: ' + validQualities.join(', ') });
        }

        // Validate style if provided
        const validStyles = ['vivid', 'natural'];
        if (style && !validStyles.includes(style)) {
            return res.status(400).json({ error: 'Invalid style. Must be one of: ' + validStyles.join(', ') });
        }

        logger.info(`Image generation request from user ${userId}: "${prompt}"`);

        const result = await generateImage(
            prompt,
            userId,
            size || '1024x1024',
            quality || 'standard',
            style || 'vivid'
        );

        if (result.success) {
            return res.json({
                success: true,
                image: {
                    id: result.imageId,
                    url: result.imageUrl,
                    prompt: result.prompt,
                    size: result.size,
                    quality: result.quality,
                    style: result.style
                }
            });
        } else {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to generate image'
            });
        }
    } catch (error) {
        logger.error('Image generation error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * @route GET /api/images/my-images
 * @desc Get user's generated images
 * @access Private
 */
router.get('/my-images', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;

        const images = await getUserImages(userId, limit);

        return res.json({
            success: true,
            images: images
        });
    } catch (error) {
        logger.error('Error fetching user images:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch images'
        });
    }
});

module.exports = router;
