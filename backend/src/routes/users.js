const express = require('express');
const supabase = require('../db/supabase/client');
const { handleError } = require('./utils');
const { check, validationResult } = require('express-validator');
// Replace the import
const { supabaseAuth } = require('./auth');
const { safePlanNameForProfile } = require('../utils/planUtils');
// Remove JWT import - no longer needed
// const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/signup', [
    check('email').isEmail().withMessage('Invalid email address'),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    check('name').notEmpty().withMessage('Name is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;
    try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        const { error: insertError } = await supabase
            .from('users')
            .insert({ id: data.user.id, email, name });
        if (insertError) throw insertError;

        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        handleError(res, error);
    }
});

router.post('/login', [
    check('email').isEmail().withMessage('Invalid email address'),
    check('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Return Supabase session instead of custom JWT
        res.status(200).json({ 
            session: data.session,
            user: data.user,
            token: data.session?.access_token
        });
    } catch (error) {
        handleError(res, error);
    }
});

router.get('/profile', supabaseAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.user.id)
            .single();
        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        handleError(res, error);
    }
});

// GET /api/user/subscription - Get user's current subscription
router.get('/subscription', supabaseAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get user's current subscription with plan details
        const { data: subscription, error: subError } = await supabase
            .from('subscriptions')
            .select(`
                *,
                plans (
                    id,
                    name,
                    price,
                    features,
                    max_messages_per_month
                )
            `)
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (subError && subError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
            throw subError;
        }

        // If no active subscription, check user's profile for default plan
        if (!subscription) {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('subscription_plan')
                .eq('id', userId)
                .single();

            if (profileError) throw profileError;

            // Return default free plan structure
            return res.status(200).json({
                plan: profile?.subscription_plan || 'free',
                status: 'active',
                current_period_end: null,
                cancel_at_period_end: false,
                plan_details: {
                    name: 'Free',
                    price: 0,
                    features: ['100 messages per month', 'Basic AI models', 'Community support']
                }
            });
        }

        // Return subscription with plan details
        res.status(200).json({
            plan: safePlanNameForProfile(subscription.plans.name),
            status: subscription.status,
            current_period_end: subscription.current_period_end,
            cancel_at_period_end: subscription.cancel_at_period_end || false,
            plan_details: {
                name: subscription.plans.name,
                price: subscription.plans.price,
                features: subscription.plans.features
            }
        });

    } catch (error) {
        console.error('Error fetching user subscription:', error);
        handleError(res, error, 'Failed to fetch subscription');
    }
});

// POST /api/user/subscription - Update user's subscription
router.post('/subscription', supabaseAuth, [
    check('plan').isIn(['free', 'plus', 'pro']).withMessage('Invalid plan type')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { plan } = req.body;
        const userId = req.user.id;

        // Get plan details from database
        const { data: planData, error: planError } = await supabase
            .from('plans')
            .select('*')
            .eq('name', plan.charAt(0).toUpperCase() + plan.slice(1))
            .single();

        if (planError) {
            return res.status(400).json({ error: 'Invalid plan selected' });
        }

        // Update user's profile subscription_plan
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ subscription_plan: plan })
            .eq('id', userId);

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
        if (plan !== 'free') {
            const { data: newSubscription, error: subscriptionError } = await supabase
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
                })
                .select()
                .single();

            if (subscriptionError) throw subscriptionError;
        }

        res.status(200).json({
            success: true,
            message: `Successfully updated to ${plan} plan`,
            plan: plan,
            status: 'active'
        });

    } catch (error) {
        console.error('Error updating user subscription:', error);
        handleError(res, error, 'Failed to update subscription');
    }
});

module.exports = router;
