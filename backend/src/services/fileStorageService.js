const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const logger = require('../config/logger');
const config = require('../config/config');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Storage bucket names
const BUCKETS = {
    GENERATED_IMAGES: 'ai-generated-images',
    CHAT_UPLOADS: 'chat-uploads'
};

/**
 * Ensure storage buckets exist
 */
async function ensureBucketsExist() {
    try {
        const { data: buckets, error } = await supabase.storage.listBuckets();

        if (error) {
            logger.error('Failed to list buckets:', error);
            return;
        }

        const existingBuckets = buckets.map(b => b.name);

        // Create generated images bucket if it doesn't exist
        if (!existingBuckets.includes(BUCKETS.GENERATED_IMAGES)) {
            const { error: createError } = await supabase.storage.createBucket(BUCKETS.GENERATED_IMAGES, {
                public: true,
                fileSizeLimit: 10485760 // 10MB
            });

            if (createError) {
                logger.error('Failed to create generated images bucket:', createError);
            } else {
                logger.info(`✅ Created bucket: ${BUCKETS.GENERATED_IMAGES}`);
            }
        }

        // Create chat uploads bucket if it doesn't exist
        if (!existingBuckets.includes(BUCKETS.CHAT_UPLOADS)) {
            const { error: createError } = await supabase.storage.createBucket(BUCKETS.CHAT_UPLOADS, {
                public: false,
                fileSizeLimit: 10485760 // 10MB
            });

            if (createError) {
                logger.error('Failed to create chat uploads bucket:', createError);
            } else {
                logger.info(`✅ Created bucket: ${BUCKETS.CHAT_UPLOADS}`);
            }
        }
    } catch (error) {
        logger.error('Error ensuring buckets exist:', error);
    }
}

/**
 * Download image from URL and upload to Supabase Storage
 * @param {string} imageUrl - URL of the image to download
 * @param {string} userId - User ID for file organization
 * @param {string} filename - Desired filename
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function downloadAndStoreImage(imageUrl, userId, filename) {
    try {
        // Download image from URL
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000
        });

        const buffer = Buffer.from(response.data);
        const contentType = response.headers['content-type'] || 'image/png';

        // Generate unique filename
        const timestamp = Date.now();
        const extension = contentType.split('/')[1] || 'png';
        const storagePath = `${userId}/${timestamp}-${filename}.${extension}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(BUCKETS.GENERATED_IMAGES)
            .upload(storagePath, buffer, {
                contentType: contentType,
                upsert: false
            });

        if (error) {
            logger.error('Failed to upload image to storage:', error);
            return { success: false, error: error.message };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKETS.GENERATED_IMAGES)
            .getPublicUrl(storagePath);

        logger.info(`✅ Image stored successfully: ${storagePath}`);

        return {
            success: true,
            url: urlData.publicUrl,
            path: storagePath
        };
    } catch (error) {
        logger.error('Error downloading and storing image:', error);
        return {
            success: false,
            error: error.message || 'Failed to download and store image'
        };
    }
}

/**
 * Upload file buffer to Supabase Storage
 * @param {Buffer} buffer - File buffer
 * @param {string} userId - User ID
 * @param {string} filename - Original filename
 * @param {string} contentType - MIME type
 * @param {string} bucket - Bucket name (default: chat-uploads)
 * @returns {Promise<{success: boolean, url?: string, path?: string, error?: string}>}
 */
async function uploadFile(buffer, userId, filename, contentType, bucket = BUCKETS.CHAT_UPLOADS) {
    try {
        const timestamp = Date.now();
        const extension = filename.split('.').pop();
        const storagePath = `${userId}/${timestamp}-${filename}`;

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(storagePath, buffer, {
                contentType: contentType,
                upsert: false
            });

        if (error) {
            logger.error('Failed to upload file:', error);
            return { success: false, error: error.message };
        }

        // Get URL (public or signed based on bucket)
        let fileUrl;
        if (bucket === BUCKETS.GENERATED_IMAGES) {
            const { data: urlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(storagePath);
            fileUrl = urlData.publicUrl;
        } else {
            const { data: urlData, error: urlError } = await supabase.storage
                .from(bucket)
                .createSignedUrl(storagePath, 3600); // 1 hour expiry

            if (urlError) {
                logger.error('Failed to create signed URL:', urlError);
                return { success: false, error: urlError.message };
            }
            fileUrl = urlData.signedUrl;
        }

        logger.info(`✅ File uploaded successfully: ${storagePath}`);

        return {
            success: true,
            url: fileUrl,
            path: storagePath
        };
    } catch (error) {
        logger.error('Error uploading file:', error);
        return {
            success: false,
            error: error.message || 'Failed to upload file'
        };
    }
}

/**
 * Delete file from storage
 * @param {string} path - File path in storage
 * @param {string} bucket - Bucket name
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteFile(path, bucket = BUCKETS.CHAT_UPLOADS) {
    try {
        const { error } = await supabase.storage
            .from(bucket)
            .remove([path]);

        if (error) {
            logger.error('Failed to delete file:', error);
            return { success: false, error: error.message };
        }

        logger.info(`✅ File deleted: ${path}`);
        return { success: true };
    } catch (error) {
        logger.error('Error deleting file:', error);
        return { success: false, error: error.message };
    }
}

// Initialize buckets on module load
ensureBucketsExist();

module.exports = {
    BUCKETS,
    downloadAndStoreImage,
    uploadFile,
    deleteFile,
    ensureBucketsExist
};
