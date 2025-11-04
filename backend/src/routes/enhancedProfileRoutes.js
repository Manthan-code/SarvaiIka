const express = require('express');
const { requireAuth } = require('../middlewares/authMiddleware.js');
const supabaseAdmin = require('../db/supabase/admin.js');
const { getCachedResponse, cacheResponse, invalidateCache } = require('../redis/redisHelpers.js');
const logger = require('../config/logger.js');

const router = express.Router();
const supabase = supabaseAdmin;

// GET /api/enhanced-profile - Get user profile with caching
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { force } = req.query;
    const cacheKey = `enhanced:user_profile:${userId}`;
    
    // Console logger for testing - track enhanced profile calls
    console.log('=== ENHANCED PROFILE CALLED ===');
    console.log('User ID:', userId);
    console.log('Force refresh:', force);
    console.log('Cache key:', cacheKey);
    console.log('===============================');
    
    // Check cache first
    if (!force) {
      const cachedProfile = await getCachedResponse(userId, cacheKey);
      if (cachedProfile) {
        console.log('=== ENHANCED PROFILE CACHE HIT ===');
        console.log('Returning cached profile with role:', cachedProfile.user?.role);
        console.log('Returning cached profile with plan:', cachedProfile.user?.subscription_plan);
        console.log('==================================');
        return res.status(200).json({
          ...cachedProfile,
          cached: true
        });
      }
    }
    
    // Single optimized query to fetch profile with related data (OPTIMIZED - NO N+1)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        name,
        bio,
        avatar_url,
        subscription_plan,
        role,
        created_at,
        updated_at,
        website,
        location,
        phone,
        company,
        job_title,
        subscriptions!left(
          id,
          plan_id,
          status,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          plans(
            name,
            price,
            features
          )
        ),
        user_usage!left(
          messages_used,
          messages_limit,
          tokens_used,
          tokens_limit
        )
      `)
      .eq('id', userId);

    if (profileError) {
      logger.error('Error fetching enhanced user profile:', profileError);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    // Check if profile exists
    if (!profileData || profileData.length === 0) {
      logger.error('Profile not found for user:', userId);
      return res.status(404).json({ error: 'User profile not found' });
    }

    const profile = profileData[0];

    // Filter active subscriptions manually
    if (profile.subscriptions) {
      profile.subscriptions = profile.subscriptions.filter(sub => sub.status === 'active');
    }

    console.log('=== ENHANCED PROFILE FRESH DATA ===');
    console.log('Profile from DB - Role:', profile.role);
    console.log('Profile from DB - Plan:', profile.subscription_plan);
    console.log('Profile from DB - Subscriptions:', profile.subscriptions?.length || 0);
    console.log('===================================');

    // Extract subscription and usage from profile data
    const subscription = profile.subscriptions?.[0] || null;
    const usage = profile.user_usage?.[0] || null;
    
    // Clean up profile object
    const { subscriptions, user_usage, ...cleanProfile } = profile;

    const enhancedProfile = {
      user: cleanProfile,
      subscription: subscription || {
        plan_id: null,
        status: 'free',
        plans: {
          name: cleanProfile.subscription_plan || 'free',
          price: 0,
          features: ['Basic features']
        }
      },
      usage: usage || {
        messages_used: 0,
        messages_limit: 100,
        tokens_used: 0,
        tokens_limit: 10000
      },
      cached: false,
      timestamp: new Date().toISOString()
    };

    // Cache with 15-minute TTL
    await cacheResponse(userId, cacheKey, enhancedProfile, 900);
    
    res.status(200).json(enhancedProfile);
    
  } catch (error) {
    logger.error('Error in enhanced profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/enhanced-profile - Update user profile
router.put('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, bio, website, location, phone, company, job_title, avatar_url } = req.body;
    
    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update({
        name,
        bio,
        website,
        location,
        phone,
        company,
        job_title,
        avatar_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      logger.error('Profile update error:', error);
      return res.status(400).json({ error: 'Failed to update profile' });
    }

    // Invalidate profile cache
    await invalidateCache(`enhanced:user_profile:${userId}`);
    
    res.json({ user: updatedProfile });
    
  } catch (error) {
    logger.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;