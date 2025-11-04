const express = require('express');
const supabaseAdmin = require('../db/supabase/admin');
const { requireAuth } = require('../middlewares/authMiddleware.js');
const { asyncHandler, dbOperation, ValidationError } = require('../utils/errorHandler');
const router = express.Router();

// Debug middleware to log all requests to settings routes
router.use((req, res, next) => {
    console.log(`🔍 SETTINGS ROUTER: ${req.method} ${req.originalUrl} - Path: ${req.path}`);
    next();
});

// Replace all authenticate with supabaseAuth
router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const { preferences } = req.body;
    
    if (!preferences) {
        throw new ValidationError('Preferences are required');
    }
    
    const result = await dbOperation(async () => {
        const { error } = await supabaseAdmin.from('settings').insert({ user_id: req.user.id, preferences });
        if (error) throw error;
    }, 'Create settings');

    res.status(201).json({ 
        success: true,
        message: 'Settings created successfully' 
    });
}));

router.get('/', requireAuth, asyncHandler(async (req, res) => {
    console.log(`🔍 DEBUG: Settings API called for user: ${req.user.id}`);
    console.log(`🔍 DEBUG: About to query settings table`);
    
    let data;
    try {
        console.log(`🔍 DEBUG: Starting dbOperation...`);
        data = await dbOperation(async () => {
            console.log(`🔍 DEBUG: Inside dbOperation, about to query Supabase...`);
            
            // First, get the settings record
            const { data: settingsData, error: settingsError } = await supabaseAdmin
                .from('settings')
                .select('*')
                .eq('user_id', req.user.id)
                .single();
            
            console.log(`🔍 DEBUG: Settings query completed - data:`, settingsData, 'error:', settingsError);
            
            if (settingsError) {
                console.log(`🔍 DEBUG: Settings error:`, settingsError);
                throw settingsError;
            }
            
            // If there's a background_image_id, fetch the background image separately
            let backgroundImageData = null;
            if (settingsData && settingsData.background_image_id) {
                console.log(`🔍 DEBUG: Fetching background image for ID:`, settingsData.background_image_id);
                const { data: bgData, error: bgError } = await supabaseAdmin
                    .from('background_images')
                    .select('id, name, url')
                    .eq('id', settingsData.background_image_id)
                    .single();
                
                if (!bgError && bgData) {
                    backgroundImageData = bgData;
                    console.log(`🔍 DEBUG: Background image fetched:`, backgroundImageData);
                } else {
                    console.log(`🔍 DEBUG: Background image fetch error or not found:`, bgError);
                }
            }
            
            // Combine the data
            const result = settingsData ? [{ ...settingsData, background_images: backgroundImageData }] : [];
            console.log(`🔍 DEBUG: Final combined result:`, result);
            return result;
        }, 'Fetch user settings');
        
        console.log(`🔍 DEBUG: dbOperation completed successfully - data:`, data);
    } catch (error) {
        console.log(`🔍 DEBUG: Caught error in settings route:`, error);
        console.log(`🔍 DEBUG: Error type:`, typeof error);
        console.log(`🔍 DEBUG: Error constructor:`, error.constructor.name);
        console.log(`🔍 DEBUG: Error message:`, error.message);
        console.log(`🔍 DEBUG: Error code:`, error.code);
        console.log(`🔍 DEBUG: Original error:`, error.originalError);
        
        // Check for PGRST116 error (no rows returned) or similar "not found" errors
        const isNoDataError = error.code === 'PGRST116' || 
                             error.message?.includes('No rows returned') ||
                             error.message?.includes('JSON object requested, multiple') ||
                             error.isPGRST116;
        
        if (isNoDataError) {
            console.log(`🔍 DEBUG: Handling no data error gracefully`);
            data = [];
        } else {
            console.log(`🔍 DEBUG: Re-throwing non-PGRST116 error`);
            throw error; // Re-throw other errors
        }
    }
    
    // If no settings found, return default preferences
    if (!data || data.length === 0) {
        console.log(`No settings found for user ${req.user.id}, returning defaults.`);
        const defaultSettings = {
            user_id: req.user.id,
            theme: "light",
            language: "en",
            background_image_id: null,
            background_images: null,
            preferences: {
                theme: "light",
                language: "en",
                notifications: {
                    email: true,
                    push: true,
                    sounds: true
                },
                privacy: {
                    data_collection: true,
                    analytics: true
                },
                ai: {
                    default_model: "gemini-1.5-flash",
                    temperature: 0.7,
                    max_tokens: 1000
                }
            }
        };
        console.log(`Returning default settings:`, defaultSettings);
        
        res.status(200).json(defaultSettings);
        return;
    }
    
    // Take the first settings record (should only be one due to unique constraint)
    const settingsData = data[0];
    
    // Format the response to include all necessary fields
    const responseData = {
        user_id: settingsData.user_id,
        theme: settingsData.preferences?.theme || "light",
        language: settingsData.preferences?.language || "en",
        background_image_id: settingsData.background_image_id,
        background_images: settingsData.background_images || null,
        preferences: settingsData.preferences
    };
    
    // Include background image information in preferences for frontend compatibility
    if (settingsData && settingsData.background_images) {
        responseData.preferences = {
            ...responseData.preferences,
            backgroundImage: {
                id: settingsData.background_images.id,
                name: settingsData.background_images.name,
                url: settingsData.background_images.url
            }
        };
    }

    res.status(200).json(responseData);
}));

router.put('/', requireAuth, asyncHandler(async (req, res) => {
    console.log('🔍 PUT /settings route called');
    const updates = req.body;
    
    console.log('🔍 PUT /settings received updates:', JSON.stringify(updates, null, 2));
    
    if (!updates || Object.keys(updates).length === 0) {
        throw new ValidationError('Update data is required');
    }

    // Create service role client first
    const { createClient } = require('@supabase/supabase-js');
    const adminClient = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            },
            db: {
                schema: 'public'
            }
        }
    );

    // First, try to get existing settings using service role
    const { data: existingSettingsData } = await adminClient
        .from('settings')
        .select('preferences, background_image_id')
        .eq('user_id', req.user.id);

    const existingSettings = existingSettingsData && existingSettingsData.length > 0 ? existingSettingsData[0] : null;

    let newPreferences = {};
    let backgroundImageId = null;
    
    // If we have existing settings, merge with new preferences
    if (existingSettings) {
        newPreferences = {
            ...existingSettings.preferences,
            ...(updates.preferences || {})
        };
        // Start with existing background_image_id, but allow it to be updated
        backgroundImageId = existingSettings.background_image_id;
    } else {
        // If no existing settings, use the new preferences
        newPreferences = updates.preferences || {};
    }

    // Extract background image ID from preferences and save to dedicated column
    console.log('🔍 Checking background image conditions:');
    console.log('  - updates.preferences exists:', !!updates.preferences);
    console.log('  - updates.preferences.backgroundImage !== undefined:', updates.preferences && updates.preferences.backgroundImage !== undefined);
    if (updates.preferences) {
        console.log('  - updates.preferences.backgroundImage value:', updates.preferences.backgroundImage);
    }
    
    if (updates.preferences && updates.preferences.backgroundImage !== undefined) {
        // Handle both old format (URL string) and new format (object with id)
        if (typeof updates.preferences.backgroundImage === 'string') {
            // Legacy support - ignore URL strings, they should use background image IDs
            console.warn('Received background image URL instead of ID, ignoring:', updates.preferences.backgroundImage);
        } else if (updates.preferences.backgroundImage && updates.preferences.backgroundImage.id) {
            // New format - extract the ID and update it
            backgroundImageId = updates.preferences.backgroundImage.id;
            console.log('Setting background_image_id to:', backgroundImageId);
        } else if (updates.preferences.backgroundImage === null) {
            // Explicitly setting to null
            backgroundImageId = null;
            console.log('Setting background_image_id to null');
        }
        // Remove from preferences to avoid duplication
        delete newPreferences.backgroundImage;
    }

    // Prepare the update data
    const updateData = {
        preferences: newPreferences,
        background_image_id: backgroundImageId,
        updated_at: new Date().toISOString()
    };

    console.log('🔍 Updating settings with data:', JSON.stringify(updateData, null, 2));
    console.log('🔍 User ID for update:', req.user.id);
    console.log('🔍 User object:', JSON.stringify(req.user, null, 2));
    
    // Try service role client with RLS bypass first

    
    try {
        const upsertData = { ...updateData, user_id: req.user.id };
        
        // Direct upsert with service role (bypasses RLS)
        const { data: updateResult, error: updateError } = await adminClient
            .from('settings')
            .upsert(upsertData)
            .select();
            
        if (updateError) {
            throw updateError;
        }
        
        if (updateError) {
            throw updateError;
        }
        
        // Success! Return early
        res.status(200).json({ 
            success: true,
            message: 'Settings updated successfully with service role',
            data: updateResult[0]
        });
        return;
    } catch (serviceRoleError) {
        console.log('🔍 Service role update failed:', serviceRoleError);
        // Continue with original approach below
    }

    const result = await dbOperation(async () => {
        
        // Test admin client configuration
        console.log('🔍 Testing admin client...');
        const { data: testData, error: testError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .limit(1);
        console.log('🔍 Admin client test - data:', testData);
        console.log('🔍 Admin client test - error:', testError);

        // Query current settings for debugging
        const { data: currentSettings, error: selectError } = await supabaseAdmin
            .from('settings')
            .select('*')
            .eq('user_id', req.user.id)
            .single();
        
        console.log('🔍 Current settings in DB:', JSON.stringify(currentSettings, null, 2));
        console.log('🔍 Select error:', selectError);

        // Use update instead of upsert to avoid RLS issues
        const { error } = await supabaseAdmin
            .from('settings')
            .update(updateData)
            .eq('user_id', req.user.id);
            
        if (error) throw error;
    }, 'Update user settings');

    res.status(200).json({ 
        success: true,
        message: 'Settings updated successfully' 
    });
}));

module.exports = router;
