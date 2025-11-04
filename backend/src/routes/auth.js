const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = require('../db/supabase/admin.js');
const logger = require('../config/logger.js');
const { createUserSubscription } = require('../services/subscriptionService.js');

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ========== MIDDLEWARE FUNCTIONS ==========

// JWT authentication removed - using Supabase Auth exclusively

// Keep only the supabaseAuth function and export it
// Remove the early export at line 33:
// export default router;  // DELETE THIS LINE
// export { supabaseAuth }; // DELETE THIS LINE
const authorize = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    };
};

/**
 * Helper function to set CORS headers on response
 */
const setCorsHeaders = (res) => {
    const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8080').split(',').map(origin => origin.trim());
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0] || 'http://localhost:8080');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
};

const supabaseAuth = async (req, res, next) => {
    try {
        console.log(`🔍 [AUTH MIDDLEWARE] ${req.method} ${req.path} - User Agent: ${req.get('User-Agent')?.substring(0, 50)}`);
        
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log(`❌ [AUTH MIDDLEWARE] No token provided for ${req.method} ${req.path}`);
            setCorsHeaders(res);
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            logger.error('Auth error:', error);
            setCorsHeaders(res);
            return res.status(401).json({ error: 'Invalid token' });
        }

        req.user = user;
        next();
    } catch (error) {
        logger.error('Auth middleware error:', error);
        setCorsHeaders(res);
        res.status(401).json({ error: 'Authentication failed' });
    }
};

// ========== ROUTES ==========

// SIGNUP endpoint
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required',
                code: 'MISSING_CREDENTIALS'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: 'Password must be at least 6 characters long',
                code: 'WEAK_PASSWORD'
            });
        }

        logger.info('Attempting to create user with email:', email);

        // Use admin client to create user with email confirmation bypassed
        const { data: created, error: adminError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name }
        });

        if (adminError) {
            logger.error('Supabase admin createUser error:', adminError);
            return res.status(400).json({
                error: adminError.message || 'Failed to create user',
                code: adminError.name || 'SUPABASE_ADMIN_ERROR'
            });
        }

        const userId = created?.user?.id;
        logger.info('Auth successful, user created:', userId);

        // Check if profile already exists (created by database trigger)
        if (userId) {
            const { data: existingProfile } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('id', userId)
                .single();

            if (!existingProfile) {
                // Profile doesn't exist, create it manually
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .insert([{
                        id: userId,
                        email: email,
                        name: name,
                        created_at: new Date().toISOString()
                    }]);

                if (profileError) {
                    logger.error('Profile creation error:', profileError);
                }
            } else {
                logger.info('Profile already exists (created by trigger):', userId);
            }

            // Always try to create subscription regardless of profile creation method
            try {
                await createUserSubscription(userId, 'free');
                logger.info('✅ Free subscription created for new user:', userId);
            } catch (subscriptionError) {
                logger.error('❌ Failed to create subscription for new user:', subscriptionError);
                // Don't fail the signup process, but log the error
            }
        }

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: userId,
                email: email,
                name: name
            }
        });

    } catch (error) {
        logger.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// LOGIN endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        logger.info('Login attempt for:', email);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            logger.error('Login error:', error);
            return res.status(401).json({ error: error.message });
        }

        logger.info('Login successful for:', email);
        res.json({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            user: data.user
        });

    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// LOGOUT endpoint
router.post('/logout', supabaseAuth, async (req, res) => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            logger.error('Logout error:', error);
            return res.status(400).json({ error: error.message });
        }
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        logger.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// REFRESH TOKEN endpoint
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        // Use Supabase to refresh the session
        const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refreshToken
        });

        if (error) {
            logger.error('Token refresh error:', error);
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }

        if (!data.session) {
            return res.status(401).json({ error: 'Failed to refresh session' });
        }

        logger.info('Token refreshed successfully for user:', data.user?.id);

        res.json({
            token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            user: data.user
        });

    } catch (error) {
        logger.error('Refresh token error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PROFILE endpoint
router.get('/profile', supabaseAuth, async (req, res) => {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', req.user.id)
            .single();

        if (error && error.code === 'PGRST116') {
            // Profile not found, try to create one automatically
            // First, double-check if profile exists to prevent race conditions
            const { data: existingProfile } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .eq('id', req.user.id)
                .single();
            
            if (existingProfile) {
                // Profile was created by another request, return it
                logger.info('Profile found on second check (race condition avoided):', req.user.id);
                return res.json({ user: existingProfile });
            }
            
            logger.info('Profile not found, creating new profile for user:', req.user.id);
            
            // Ensure we have required fields
            const email = req.user.email;
            const name = req.user.user_metadata?.name || 
                        req.user.user_metadata?.full_name || 
                        (email ? email.split('@')[0] : 'User');
            
            if (!email) {
                logger.error('Cannot create profile: missing email');
                return res.status(400).json({ error: 'User email is required' });
            }
            
            // Check if user has an active subscription before setting defaults
            const { data: subscription } = await supabaseAdmin
                .from('subscriptions')
                .select(`
                    status,
                    current_period_end,
                    plans (
                        name
                    )
                `)
                .eq('user_id', req.user.id)
                .eq('status', 'active')
                .single();
            
            let subscriptionPlan = 'free';
            let userRole = 'user';
            
            // If user has an active subscription, use that plan and set appropriate role
            if (subscription && subscription.plans) {
                const now = new Date();
                const expiryDate = new Date(subscription.current_period_end);
                
                // Only use subscription plan if it's not expired
                if (expiryDate > now) {
                    subscriptionPlan = subscription.plans.name;
                    userRole = subscription.plans.name.toLowerCase() === 'plus' ? 'admin' : 'user';
                }
            }

            const profileData = {
                id: req.user.id,
                email: email,
                name: name,
                subscription_plan: subscriptionPlan,
                role: userRole,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            logger.info('Creating profile with data:', profileData);
            
            try {
                const { data: newProfile, error: createError } = await supabaseAdmin
                    .from('profiles')
                    .insert([profileData])
                    .select('*')
                    .single();

                if (createError) {
                    // If insert fails due to duplicate key, try to fetch the existing profile
                    if (createError.code === '23505') { // Unique constraint violation
                        logger.info('Profile already exists (duplicate key), fetching existing profile');
                        const { data: existingProfile } = await supabaseAdmin
                            .from('profiles')
                            .select('*')
                            .eq('id', req.user.id)
                            .single();
                        
                        if (existingProfile) {
                            return res.json({ user: existingProfile });
                        }
                    }
                    
                    logger.error('Failed to create profile:', createError);
                    return res.status(500).json({ 
                        error: 'Failed to create user profile',
                        details: createError.message 
                    });
                }

                logger.info('Profile created successfully for user:', req.user.id);
                return res.json({ user: newProfile });
            } catch (insertError) {
                logger.error('Profile creation error:', insertError);
                return res.status(500).json({ 
                    error: 'Failed to create user profile',
                    details: insertError.message 
                });
            }
        }

        if (error) {
            logger.error('Profile fetch error:', error);
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Console logger for testing - shows user role and subscription info
        console.log('=== USER ROLE TEST ===');
        console.log('User ID:', profile.id);
        console.log('User Email:', profile.email);
        console.log('User Role:', profile.role);
        console.log('Subscription Plan:', profile.subscription_plan);
        console.log('Subscription Status:', profile.subscription_status);
        console.log('======================');

        res.json({ user: profile });

    } catch (error) {
        logger.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ADMIN CHECK endpoint
router.get('/admin', supabaseAuth, async (req, res) => {
    try {
        // Check if user has admin role in their profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', req.user.id)
            .single();

        if (error || !profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.status(200).json({ message: 'Admin access granted', user: req.user.email });

    } catch (error) {
        logger.error('Admin check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Keep legacy register endpoint for compatibility
router.post('/register', async (req, res) => {
    try {
        const result = await supabase.auth.signUp({
            email: req.body.email,
            password: req.body.password,
            options: {
                data: {
                    name: req.body.name
                }
            }
        });

        if (result.error) {
            return res.status(400).json({ error: result.error.message });
        }

        res.status(201).json({
            message: 'User registered successfully',
            user: result.data.user
        });
    } catch (error) {
        logger.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// UPDATE PROFILE endpoint
router.put('/profile', supabaseAuth, async (req, res) => {
    try {
        const { name, bio, website, location, phone, company, job_title, avatar } = req.body;
        
        logger.info('Profile update request for user:', req.user.id, 'with data:', { name, bio, website, location, phone, company, job_title, avatar });
        
        // First, get the existing profile to preserve role and subscription
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('role, subscription_plan')
            .eq('id', req.user.id)
            .single();
        
        // Prepare the profile data for upsert
        const profileData = {
            id: req.user.id,
            email: req.user.email,
            name: name || req.user.user_metadata?.name || req.user.user_metadata?.full_name || req.user.email?.split('@')[0] || 'User',
            bio: bio || null,
            website: website || null,
            location: location || null,
            phone: phone || null,
            company: company || null,
            job_title: job_title || null,
            avatar_url: avatar || null,
            subscription_plan: existingProfile?.subscription_plan || 'free',
            role: existingProfile?.role || 'user',
            updated_at: new Date().toISOString()
        };
        
        // Use upsert to either insert or update the profile
        const { data: profile, error: upsertError } = await supabaseAdmin
            .from('profiles')
            .upsert(profileData, {
                onConflict: 'id',
                ignoreDuplicates: false
            })
            .select('*')
            .single();
        
        if (upsertError) {
            logger.error('Profile upsert error:', {
                error: upsertError,
                code: upsertError.code,
                message: upsertError.message,
                details: upsertError.details,
                profileData: profileData
            });
            return res.status(400).json({ 
                error: 'Failed to update profile',
                details: upsertError.message 
            });
        }
        
        logger.info('Profile upserted successfully for user:', req.user.id);
        res.json({ user: profile });

    } catch (error) {
        logger.error('Profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// At the end of the file (line 428), fix the exports:
module.exports = router;
module.exports.authorize = authorize;
module.exports.supabaseAuth = supabaseAuth; // Remove 'authenticate' since it's commented out