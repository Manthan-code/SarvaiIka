const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../db/supabase/admin');
const { requireAdmin } = require('../middlewares/authMiddleware');
const logger = require('../config/logger');

// Handle CORS preflight requests before authentication
router.options('*', (req, res) => {
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8080').split(',').map(origin => origin.trim());
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0] || 'http://localhost:8080');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// Apply admin middleware to all routes except OPTIONS
router.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  requireAdmin(req, res, next);
});

// GET /api/admin/users - Get all users
router.get('/users', async (req, res) => {
  try {
    console.log('🔍 Admin users endpoint called');
    console.log('🔍 Request user:', req.user?.email);
    console.log('🔍 Request profile:', req.profile?.email, req.profile?.role);
    
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching users:', error);
      logger.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    console.log('✅ Users fetched successfully:', users.length);
    console.log('📤 Sending response with users array');
    res.json({ users });
  } catch (error) {
    console.error('❌ Admin users fetch error:', error);
    logger.error('Admin users fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/users/:userId/role - Update user role
router.patch('/users/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select();

    if (error) {
      logger.error('Error updating user role:', error);
      return res.status(500).json({ error: 'Failed to update user role' });
    }

    logger.info(`User role updated by admin`, { 
      adminId: req.user.id, 
      userId, 
      newRole: role 
    });

    res.json({ user: data[0] });
  } catch (error) {
    logger.error('Admin user role update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/system/config - Get system configuration
router.get('/system/config', async (req, res) => {
  try {
    // Return default system configuration
    const config = {
      site_name: process.env.SITE_NAME || 'AI Agent Platform',
      site_description: process.env.SITE_DESCRIPTION || 'Advanced AI Agent Platform',
      maintenance_mode: process.env.MAINTENANCE_MODE === 'true',
      registration_enabled: process.env.REGISTRATION_ENABLED !== 'false',
      max_users: parseInt(process.env.MAX_USERS) || 1000,
      max_chat_history: parseInt(process.env.MAX_CHAT_HISTORY) || 100,
      default_model: process.env.DEFAULT_MODEL || 'gemini-1.5-flash',
      rate_limit_per_minute: parseInt(process.env.RATE_LIMIT_PER_MINUTE) || 60,
      max_message_length: parseInt(process.env.MAX_MESSAGE_LENGTH) || 4000,
      session_timeout: parseInt(process.env.SESSION_TIMEOUT) || 3600,
      password_min_length: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
      require_email_verification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
      enable_2fa: process.env.ENABLE_2FA === 'true',
      cache_ttl: parseInt(process.env.CACHE_TTL) || 300,
      max_concurrent_requests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 100,
      database_pool_size: parseInt(process.env.DATABASE_POOL_SIZE) || 10,
      enable_background_images: process.env.ENABLE_BACKGROUND_IMAGES !== 'false',
      enable_subscriptions: process.env.ENABLE_SUBSCRIPTIONS !== 'false',
      enable_analytics: process.env.ENABLE_ANALYTICS !== 'false',
      enable_file_uploads: process.env.ENABLE_FILE_UPLOADS !== 'false'
    };

    res.json({ config });
  } catch (error) {
    logger.error('Admin system config fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/system/config - Update system configuration
router.put('/system/config', async (req, res) => {
  try {
    const { config } = req.body;
    
    // In a real implementation, you would save this to a database or config file
    // For now, we'll just log the update
    logger.info('System configuration updated by admin', { 
      adminId: req.user.id, 
      config 
    });

    res.json({ message: 'Configuration updated successfully' });
  } catch (error) {
    logger.error('Admin system config update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/system/stats - Get system statistics
router.get('/system/stats', async (req, res) => {
  try {
    // Get basic system stats
    const { data: userCount } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    const { data: chatCount } = await supabaseAdmin
      .from('chat_sessions')
      .select('id', { count: 'exact', head: true });

    const stats = {
      total_users: userCount?.length || 0,
      total_chats: chatCount?.length || 0,
      active_users_24h: 0, // Would need to implement tracking
      server_uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      cpu_usage: 0, // Would need to implement CPU monitoring
      database_connections: 0, // Would need to implement connection monitoring
      cache_hit_rate: 0, // Would need to implement cache monitoring
      error_rate: 0, // Would need to implement error rate monitoring
      response_time_avg: 0 // Would need to implement response time monitoring
    };

    res.json({ stats });
  } catch (error) {
    logger.error('Admin system stats fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/system/restart - Restart system (placeholder)
router.post('/system/restart', async (req, res) => {
  try {
    logger.warn('System restart requested by admin', { adminId: req.user.id });
    
    // In a real implementation, you would implement graceful restart
    // For now, just return a success message
    res.json({ message: 'System restart initiated' });
  } catch (error) {
    logger.error('Admin system restart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/background-images - Get background images
router.get('/background-images', async (req, res) => {
  try {
    const { data: images, error } = await supabaseAdmin
      .from('background_images')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching background images:', error);
      return res.status(500).json({ error: 'Failed to fetch background images' });
    }

    res.json({ images: images || [] });
  } catch (error) {
    logger.error('Admin background images fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/background-images - Add background image
router.post('/background-images', async (req, res) => {
  try {
    const imageData = req.body;
    
    const { data, error } = await supabaseAdmin
      .from('background_images')
      .insert(imageData)
      .select();

    if (error) {
      logger.error('Error adding background image:', error);
      return res.status(500).json({ error: 'Failed to add background image' });
    }

    logger.info('Background image added by admin', { 
      adminId: req.user.id, 
      imageId: data[0].id 
    });

    res.json({ image: data[0] });
  } catch (error) {
    logger.error('Admin background image add error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/background-images/:imageId - Update background image
router.put('/background-images/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const updateData = req.body;
    
    const { data, error } = await supabaseAdmin
      .from('background_images')
      .update(updateData)
      .eq('id', imageId)
      .select();

    if (error) {
      logger.error('Error updating background image:', error);
      return res.status(500).json({ error: 'Failed to update background image' });
    }

    logger.info('Background image updated by admin', { 
      adminId: req.user.id, 
      imageId 
    });

    res.json({ image: data[0] });
  } catch (error) {
    logger.error('Admin background image update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/background-images/:imageId - Update background image (alternative method)
router.patch('/background-images/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const updateData = req.body;
    
    const { data, error } = await supabaseAdmin
      .from('background_images')
      .update(updateData)
      .eq('id', imageId)
      .select();

    if (error) {
      logger.error('Error updating background image:', error);
      return res.status(500).json({ error: 'Failed to update background image' });
    }

    logger.info('Background image updated by admin', { 
      adminId: req.user.id, 
      imageId 
    });

    res.json({ image: data[0] });
  } catch (error) {
    logger.error('Admin background image update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/background-images/:imageId - Delete background image
router.delete('/background-images/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    
    const { error } = await supabaseAdmin
      .from('background_images')
      .delete()
      .eq('id', imageId);

    if (error) {
      logger.error('Error deleting background image:', error);
      return res.status(500).json({ error: 'Failed to delete background image' });
    }

    logger.info('Background image deleted by admin', { 
      adminId: req.user.id, 
      imageId 
    });

    res.json({ message: 'Background image deleted successfully' });
  } catch (error) {
    logger.error('Admin background image delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;