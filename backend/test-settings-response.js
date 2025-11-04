const supabase = require('./src/db/supabase/client');

async function fixUserSettings() {
    console.log('🔧 Fixing User Settings for b7de34ed-8524-427d-b8e4-05bc47018942');
    console.log('Expected background_image_id: ebdc31c7-0091-4dbe-8c24-05fe7f9a2fcd');
    console.log('='.repeat(80));

    const userId = 'b7de34ed-8524-427d-b8e4-05bc47018942';
    const expectedBgId = 'ebdc31c7-0091-4dbe-8c24-05fe7f9a2fcd';

    try {
        // 1. Check current settings
        console.log('\n1. Checking current settings...');
        const { data: currentSettings, error: settingsError } = await supabase
            .from('settings')
            .select('*')
            .eq('user_id', userId);

        if (settingsError) {
            console.error('❌ Settings check error:', settingsError);
            return;
        }

        console.log('📄 Current settings count:', currentSettings.length);
        if (currentSettings.length > 0) {
            console.log('📄 Current settings:', JSON.stringify(currentSettings[0], null, 2));
        }

        // 2. Check if background image exists
        console.log('\n2. Verifying background image exists...');
        const { data: bgImage, error: bgError } = await supabase
            .from('background_images')
            .select('*')
            .eq('id', expectedBgId)
            .single();

        if (bgError) {
            console.error('❌ Background image not found:', bgError);
            return;
        }

        console.log('✅ Background image found:', bgImage.name);
        console.log('   - URL:', bgImage.url);
        console.log('   - Is Active:', bgImage.is_active);

        // 3. Create or update settings
        console.log('\n3. Creating/updating settings...');
        
        const settingsData = {
            user_id: userId,
            background_image_id: expectedBgId,
            preferences: {
                theme: "dark",
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
                    default_model: "gpt-4",
                    temperature: 0.7,
                    max_tokens: 1000
                }
            },
            updated_at: new Date().toISOString()
        };

        const { data: upsertResult, error: upsertError } = await supabase
            .from('settings')
            .upsert(settingsData, {
                onConflict: 'user_id'
            })
            .select();

        if (upsertError) {
            console.error('❌ Settings upsert error:', upsertError);
            return;
        }

        console.log('✅ Settings created/updated successfully');

        // 4. Test the API query again
        console.log('\n4. Testing API query after fix...');
        const { data: testData, error: testError } = await supabase
            .from('settings')
            .select('*, background_images(id, name, url)')
            .eq('user_id', userId)
            .single();

        if (testError) {
            console.error('❌ Test query error:', testError);
            return;
        }

        console.log('✅ API query successful!');
        console.log('📄 Response:', JSON.stringify(testData, null, 2));

        // Process like the API does
        if (testData && testData.background_images) {
            testData.preferences = {
                ...testData.preferences,
                backgroundImage: {
                    id: testData.background_images.id,
                    name: testData.background_images.name,
                    url: testData.background_images.url
                }
            };
        }

        console.log('\n🎉 SUCCESS! The frontend should now receive:');
        console.log('📄 preferences.backgroundImage:', JSON.stringify(testData.preferences?.backgroundImage, null, 2));
        console.log('\n✅ Background image should now appear in the chat interface!');
        console.log('\n🔄 Please refresh the frontend to see the changes.');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

fixUserSettings();