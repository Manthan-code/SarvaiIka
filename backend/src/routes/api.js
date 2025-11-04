/**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: Validation error
 *         message:
 *           type: string
 *           example: Email and password are required
 *     Success:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           type: object
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *           format: email
 *         name:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *     Plan:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         price:
 *           type: number
 *         features:
 *           type: array
 *           items:
 *             type: string
 *         limitations:
 *           type: object
 *     Subscription:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *           format: uuid
 *         plan_id:
 *           type: string
 *           format: uuid
 *         status:
 *           type: string
 *           enum: [active, canceled, expired]
 *         messages_limit:
 *           type: integer
 *     Chat:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *           format: uuid
 *         messages:
 *           type: array
 *           items:
 *             type: object
 *         created_at:
 *           type: string
 *           format: date-time
 *     Settings:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *           format: uuid
 *         preferences:
 *           type: object
 */

/**
 * API Routes for Supabase backend
 * Includes CRUD operations for users, plans, subscriptions, chats, and settings
 * Uses Supabase authentication for protected routes
 */

const express = require('express');
const supabase = require('../db/supabase/client.js');
const { requireAuth } = require('../middlewares/authMiddleware.js');
const { asyncHandler, dbOperation, NotFoundError, ValidationError } = require('../utils/errorHandler');
const { safePlanNameForProfile } = require('../utils/planUtils');

const router = express.Router();

// Note: Error handling is now managed by the standardized error handler

// Users Routes
/**
 * @swagger
 * /api/users/signup:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: Create a new user account with email, password, and name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: securePassword123
 *               name:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User created successfully
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.post('/users/signup', asyncHandler(async (req, res) => {
    // Set cache headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const { email, password, name } = req.body;
    
    // Validate required fields
    if (!email || !password) {
        throw new ValidationError('Email and password are required');
    }
    if (!name) {
        throw new ValidationError('Name is required');
    }
    
    const userData = await dbOperation(async () => {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        return data;
    }, 'Sign up user');

    await dbOperation(async () => {
        const { error: insertError } = await supabase
            .from('users')
            .insert({ id: userData.user.id, email, name });
        if (insertError) throw insertError;
    }, 'Create user profile');

    res.status(201).json({ 
        success: true,
        message: 'User created successfully' 
    });
}));

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     tags: [Authentication]
 *     summary: User login
 *     description: Authenticate user with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: securePassword123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 session:
 *                   type: object
 *                   description: Supabase session object
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
router.post('/users/login', asyncHandler(async (req, res) => {
    // Set cache headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
        throw new ValidationError('Email and password are required');
    }
    
    const authData = await dbOperation(async () => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    }, 'User login');

    // Return Supabase session instead of custom JWT
    res.status(200).json({ 
        success: true,
        session: authData.session,
        user: authData.user 
    });
}));

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get user profile
 *     description: Retrieve the authenticated user's profile information
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/users/profile', requireAuth, asyncHandler(async (req, res) => {
    const userData = await dbOperation(async () => {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.user.id)
            .single();
        if (error) throw error;
        return data;
    }, 'Fetch user profile');

    res.status(200).json({
        success: true,
        data: userData
    });
}));

/**
 * @swagger
 * /api/user/subscription:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get user's current subscription
 *     description: Retrieve the authenticated user's current subscription details
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     plan:
 *                       type: string
 *                       example: free
 *                     status:
 *                       type: string
 *                       example: active
 *                     current_period_end:
 *                       type: string
 *                       nullable: true
 *                     cancel_at_period_end:
 *                       type: boolean
 *                       example: false
 *                     plan_details:
 *                       $ref: '#/components/schemas/Plan'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/user/subscription', requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get user's profile
    const profile = await dbOperation(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_plan')
        .eq('id', userId)
        .single();
  
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      return data;
    }, 'Fetch user profile');

    const userPlan = profile?.subscription_plan || 'free';
  
    // Get plan details using the plan name
    const { planDetails, planError } = await dbOperation(async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .ilike('name', userPlan)
        .single();
      return { planDetails: data, planError: error };
    }, 'Fetch plan details');
  
      // Default plans as fallback
      const defaultPlans = {
        free: {
          name: "Free",
          price: 0,
          features: ["100 messages per month", "Basic AI models", "Community support"]
        },
        plus: {
          name: "Plus", 
          price: 19,
          features: ["1,000 messages per month", "Advanced AI models", "Priority support", "Faster response time", "Custom templates"]
        },
        pro: {
          name: "Pro",
          price: 49,
          features: ["Unlimited messages", "All AI models", "24/7 priority support", "Fastest response time", "Custom integrations", "Advanced analytics"]
        }
      };
  
      let finalPlanDetails;
      if (planError || !planDetails) {
        finalPlanDetails = defaultPlans[userPlan] || defaultPlans.free;
      } else {
        finalPlanDetails = {
          name: planDetails.name,
          price: parseFloat(planDetails.price) || 0,
          features: Array.isArray(planDetails.features) 
            ? planDetails.features 
            : (() => {
                try {
                  return JSON.parse(planDetails.features || '[]');
                } catch (e) {
                  return defaultPlans[userPlan]?.features || [];
                }
              })()
        };
      }
  
    // Return with consistent ID format
    res.json({
      success: true,
      data: {
        plan: userPlan, // This will be 'free', 'plus', or 'pro'
        status: 'active',
        current_period_end: null,
        cancel_at_period_end: false,
        plan_details: {
          ...finalPlanDetails,
          id: userPlan // Ensure consistent ID format
        }
      }
    });
}));

/**
 * @swagger
 * /api/user/subscription:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Update user's subscription
 *     description: Update the authenticated user's subscription plan
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plan
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [free, plus, pro]
 *                 example: plus
 *     responses:
 *       200:
 *         description: Subscription updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Successfully updated to plus plan
 *                 plan:
 *                   type: string
 *                   example: plus
 *                 status:
 *                   type: string
 *                   example: active
 *       400:
 *         description: Invalid plan type
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/user/subscription', requireAuth, asyncHandler(async (req, res) => {
    try {
        const { plan } = req.body;
        const userId = req.user.id;

        if (!plan || !['free', 'plus', 'pro'].includes(safePlanNameForProfile(plan))) {
            return res.status(400).json({ error: 'Invalid plan type' });
        }

        const planName = plan.charAt(0).toUpperCase() + plan.slice(1);

        // Get plan details from database
        const { data: planData, error: planError } = await supabase
            .from('plans')
            .select('*')
            .ilike('name', planName)
            .single();

        if (planError && plan !== 'free') {
            return res.status(400).json({ error: 'Invalid plan selected' });
        }

        // Update user's profile subscription_plan
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({ 
                id: userId,
                subscription_plan: safePlanNameForProfile(plan) 
            }, { 
                onConflict: 'id' 
            });

        if (profileError) throw profileError;

        // Cancel existing active subscriptions
        const { error: cancelError } = await supabase
            .from('subscriptions')
            .update({ 
                status: 'canceled',
                canceled_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('status', 'active');

        if (cancelError) throw cancelError;

        // Create new subscription if not free plan
        if (safePlanNameForProfile(plan) !== 'free' && planData) {
            const { error: subscriptionError } = await supabase
                .from('subscriptions')
                .insert({
                    user_id: userId,
                    plan_id: planData.id,
                    status: 'active',
                    messages_limit: planData.max_messages_per_month,
                    current_period_start: new Date().toISOString(),
                    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (subscriptionError) throw subscriptionError;
        }

        res.status(200).json({
            success: true,
            message: `Successfully updated to ${safePlanNameForProfile(plan)} plan`,
            plan: safePlanNameForProfile(plan),
            status: 'active'
        });

    } catch (error) {
        console.error('Subscription API error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));



/**
 * @swagger
 * /api/plans:
 *   get:
 *     tags: [Plans]
 *     summary: Get all available plans
 *     description: Retrieve all active subscription plans
 *     responses:
 *       200:
 *         description: Plans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Plan'
 *       500:
 *         description: Internal server error
 */
router.get('/plans', asyncHandler(async (req, res) => {
    const plans = await dbOperation(async () => {
        const { data, error } = await supabase
            .from('plans')
            .select('*')
            .order('display_order', { ascending: true })
            .eq('is_active', true);
        
        if (error) throw error;
        return data;
    }, 'Fetch plans');
    
    // Transform the data to use plan names as IDs for frontend compatibility
    const transformedPlans = plans.map(plan => ({
        ...plan,
        id: safePlanNameForProfile(plan.name), // Use plan name as ID
        originalId: plan.id, // Keep original UUID for reference
        price: parseFloat(plan.price) || 0, // Ensure price is a number
        price_display: `$${parseFloat(plan.price) || 0}`, // Add display format
        period: '/month' // Add period for frontend
    }));
    
    res.json({
        success: true,
        data: transformedPlans
    });
}));

router.post('/plans', requireAuth, asyncHandler(async (req, res) => {
    const { name, price, features, limitations } = req.body;
    
    // Validate required fields
    if (!name || !price) {
        throw new ValidationError('Name and price are required');
    }
    
    await dbOperation(async () => {
        const { error } = await supabase.from('plans').insert({ 
            name, 
            price, 
            features, 
            limitations 
        });
        if (error) throw error;
    }, 'Create plan');

    res.status(201).json({ 
        success: true,
        message: 'Plan created successfully' 
    });
}));

router.put('/plans/:id', requireAuth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const { error } = await supabase.from('plans').update(updates).eq('id', id);
    if (error) throw error;

    res.status(200).json({ message: 'Plan updated successfully' });
}));

router.delete('/plans/:id', requireAuth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('plans').delete().eq('id', id);
    if (error) throw error;

    res.status(200).json({ message: 'Plan deleted successfully' });
}));

// Subscriptions Routes
router.post('/subscriptions', requireAuth, asyncHandler(async (req, res) => {
    const { plan_id, status, messages_limit } = req.body;
    const { error } = await supabase
        .from('subscriptions')
        .insert({ user_id: req.user.id, plan_id, status, messages_limit });
    if (error) throw error;

    res.status(201).json({ message: 'Subscription created successfully' });
}));

router.put('/subscriptions/:id', requireAuth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const { error } = await supabase.from('subscriptions').update(updates).eq('id', id);
    if (error) throw error;

    res.status(200).json({ message: 'Subscription updated successfully' });
}));

router.delete('/subscriptions/:id', requireAuth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('subscriptions').delete().eq('id', id);
    if (error) throw error;

    res.status(200).json({ message: 'Subscription canceled successfully' });
}));

router.get('/subscriptions', requireAuth, asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', req.user.id);
    if (error) throw error;

    res.status(200).json(data);
}));

/**
 * @swagger
 * /api/chats:
 *   post:
 *     tags: [Chats]
 *     summary: Create a new chat
 *     description: Create a new chat session for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                 example: [{"role": "user", "content": "Hello"}]
 *     responses:
 *       201:
 *         description: Chat created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Chat created successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *   get:
 *     tags: [Chats]
 *     summary: Get user's chats
 *     description: Retrieve all chats for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Chats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Chat'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/chats', requireAuth, asyncHandler(async (req, res) => {
    const { messages } = req.body;
    const { error } = await supabase.from('chats').insert({ user_id: req.user.id, messages });
    if (error) throw error;

    res.status(201).json({ message: 'Chat created successfully' });
}));

router.get('/chats', requireAuth, asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', req.user.id);
    if (error) throw error;

    res.status(200).json(data);
}));

// POST /api/chat - Send a message (frontend expects this endpoint)
// Removed conflicting /chat route - chat functionality is handled by dedicated chatRoutes.js
// This route was causing conflicts with the main chat endpoint
// router.post('/chat', requireAuth, asyncHandler(async (req, res) => {
//     const { content, sessionId } = req.body;
//     
//     if (!content) {
//         throw new ValidationError('Message content is required');
//     }
//     
//     try {
//         // For now, return a simple response
//         // TODO: Integrate with chat service for AI responses
//         res.status(200).json({
//             success: true,
//             data: {
//                 id: Date.now().toString(),
//                 content: `Echo: ${content}`,
//                 role: 'assistant',
//                 timestamp: new Date().toISOString()
//             }
//         });
//     } catch (error) {
//         throw new Error('Failed to send message');
//     }
// }));

// Chat functionality is handled by dedicated chatRoutes.js mounted at /api/chat

router.delete('/chats/:id', requireAuth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('chats').delete().eq('id', id);
    if (error) throw error;

    res.status(200).json({ message: 'Chat deleted successfully' });
}));

/**
 * @swagger
 * /api/settings:
 *   post:
 *     tags: [Settings]
 *     summary: Create user settings
 *     description: Create settings for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - preferences
 *             properties:
 *               preferences:
 *                 type: object
 *                 example: {"theme": "dark", "notifications": true}
 *     responses:
 *       201:
 *         description: Settings created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Settings created successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *   get:
 *     tags: [Settings]
 *     summary: Get user settings
 *     description: Retrieve settings for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Settings'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *   put:
 *     tags: [Settings]
 *     summary: Update user settings
 *     description: Update settings for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferences:
 *                 type: object
 *                 example: {"theme": "light", "notifications": false}
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Settings updated successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/background-images:
 *   get:
 *     tags: [Background Images]
 *     summary: Get available background images for user
 *     description: Retrieve background images available to the authenticated user based on their tier
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Background images retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 images:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       url:
 *                         type: string
 *                       thumbnail_url:
 *                         type: string
 *                       category:
 *                         type: string
 *                       tier_required:
 *                         type: string
 *                         enum: [free, pro, premium]
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/background-images', requireAuth, asyncHandler(async (req, res) => {
    try {
        console.log('🔍 DEBUG: JWT User ID:', req.user.id);
        console.log('🔍 DEBUG: User object:', req.user);
        console.log('🔍 DEBUG: Profile from auth middleware:', req.profile);
        
        // Use profile data from auth middleware instead of querying again
        const userTier = req.profile?.subscription_plan || 'free';
        
        // Debug logging
        console.log('🔍 Background Images API Debug:');
        console.log('  User ID from JWT:', req.user.id);
        console.log('  Profile from auth middleware:', req.profile);
        console.log('  User tier:', userTier);
        
        // Define tier hierarchy - map subscription plans to background image tiers
        // Note: Both Plans table and background_images table now use: free, plus, pro
        const tierHierarchy = {
            'free': ['free'], // free subscription can only access free backgrounds
            'plus': ['free', 'plus'], // plus subscription can access free and plus backgrounds  
            'pro': ['free', 'plus', 'pro'] // pro subscription can access all backgrounds
        };

        const allowedTiers = tierHierarchy[userTier] || ['free'];
        console.log('  Allowed tiers:', allowedTiers);

        // Fetch background images available to user's tier
        const { data: images, error } = await supabase
            .from('background_images')
            .select('id, name, description, url, thumbnail_url, category, tier_required')
            .eq('is_active', true)
            .in('tier_required', allowedTiers)
            .order('tier_required', { ascending: true })
            .order('name', { ascending: true });

        console.log('  Query result - Images count:', images?.length || 0);
        if (images) {
            images.forEach((img, index) => {
                console.log(`    ${index + 1}. ${img.name} (${img.tier_required})`);
            });
        }

        if (error) {
            console.error('Error fetching background images:', error);
            return res.status(500).json({ error: 'Failed to fetch background images' });
        }

        res.json({ images: images || [] });
    } catch (error) {
        console.error('Background images fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));

module.exports = router;