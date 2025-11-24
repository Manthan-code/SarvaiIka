const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth } = require('../middlewares/authMiddleware');
const { uploadFile } = require('../services/fileStorageService');
const logger = require('../config/logger');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow images and documents
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'application/pdf',
            'text/plain'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF, TXT'));
        }
    }
});

/**
 * @route POST /api/files/upload
 * @desc Upload file for chat attachment
 * @access Private
 */
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.user.id;
        const file = req.file;

        logger.info(`File upload from user ${userId}: ${file.originalname} (${file.mimetype})`);

        // Upload to Supabase Storage
        const result = await uploadFile(
            file.buffer,
            userId,
            file.originalname,
            file.mimetype,
            'chat-uploads'
        );

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to upload file'
            });
        }

        logger.info(`✅ File uploaded successfully: ${result.path}`);

        return res.json({
            success: true,
            file: {
                url: result.url,
                path: result.path,
                name: file.originalname,
                type: file.mimetype,
                size: file.size
            }
        });
    } catch (error) {
        logger.error('File upload error:', error);

        if (error.message.includes('Invalid file type')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Failed to upload file'
        });
    }
});

/**
 * @route POST /api/files/upload-multiple
 * @desc Upload multiple files for chat
 * @access Private
 */
router.post('/upload-multiple', requireAuth, upload.array('files', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const userId = req.user.id;
        const uploadedFiles = [];
        const errors = [];

        for (const file of req.files) {
            try {
                const result = await uploadFile(
                    file.buffer,
                    userId,
                    file.originalname,
                    file.mimetype,
                    'chat-uploads'
                );

                if (result.success) {
                    uploadedFiles.push({
                        url: result.url,
                        path: result.path,
                        name: file.originalname,
                        type: file.mimetype,
                        size: file.size
                    });
                } else {
                    errors.push({
                        file: file.originalname,
                        error: result.error
                    });
                }
            } catch (error) {
                errors.push({
                    file: file.originalname,
                    error: error.message
                });
            }
        }

        return res.json({
            success: uploadedFiles.length > 0,
            files: uploadedFiles,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        logger.error('Multiple file upload error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to upload files'
        });
    }
});

module.exports = router;
