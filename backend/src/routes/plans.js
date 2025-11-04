const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config.js');
const supabaseAdmin = require('../db/supabase/admin.js');
const { requireAuth } = require('../middlewares/authMiddleware.js');
const { supabaseAuth } = require('./auth');
const logger = require('../config/logger.js');
const { asyncHandler, dbOperation, ValidationError } = require('../utils/errorHandler');
const { safePlanNameForProfile } = require('../utils/planUtils');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        logger.info('Fetching plans from database');
        
        let plans = [];
        
        // Try direct database connection first (bypasses RLS)
        if (pool) {
            try {
                logger.info('Using direct database connection for plans');
                const result = await pool.query('SELECT * FROM plans WHERE is_active = true ORDER BY display_order');
                logger.info(`Found ${result.rows.length} plans via direct connection`);
                plans = result.rows;
            } catch (poolError) {
                logger.warn('Direct connection failed, falling back to Supabase:', poolError.message);
            }
        }
        
        // Fallback to Supabase client if direct connection failed
        if (plans.length === 0) {
            logger.info('Using Supabase client for plans');
            const { data, error } = await supabase
                .from('plans')
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true });
            
            if (error) {
                logger.error('Error fetching plans via Supabase:', error);
                throw error;
            }
            plans = data || [];
        }

        // Transform the data to use plan names as IDs for frontend compatibility
        const transformedPlans = plans.map(plan => ({
            ...plan,
            id: safePlanNameForProfile(plan.name), // Use plan name as ID
            originalId: plan.id, // Keep original UUID for reference
            price: parseFloat(plan.price) || 0, // Ensure price is a number
            price_display: `$${parseFloat(plan.price) || 0}`, // Add display format
            period: '/month' // Add period for frontend
        }));

        logger.info(`Returning ${transformedPlans.length} transformed plans`);
        res.status(200).json(transformedPlans);
    } catch (error) {
        handleError(res, error, 'Failed to fetch plans');
    }
});

// Replace all authenticate with supabaseAuth
router.post('/', supabaseAuth, async (req, res) => {
    const { name, price, features, limitations } = req.body;
    try {
        const { error } = await supabase.from('plans').insert({ name, price, features, limitations });
        if (error) throw error;

        res.status(201).json({ message: 'Plan created successfully' });
    } catch (error) {
        handleError(res, error);
    }
});

router.put('/:id', supabaseAuth, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    try {
        const { error } = await supabase.from('plans').update(updates).eq('id', id);
        if (error) throw error;

        res.status(200).json({ message: 'Plan updated successfully' });
    } catch (error) {
        handleError(res, error);
    }
});

router.delete('/:id', supabaseAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('plans').delete().eq('id', id);
        if (error) throw error;

        res.status(200).json({ message: 'Plan deleted successfully' });
    } catch (error) {
        handleError(res, error);
    }
});

module.exports = router;
