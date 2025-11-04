require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testSettingsAPI() {
  try {
    console.log('Testing settings API response...\n');
    
    // First, let's see what users exist in profiles table
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .limit(5);
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }
    
    console.log('Available users:', users);
    
    if (users.length === 0) {
      console.log('No users found in the database');
      return;
    }
    
    const userId = users[0].id;
    console.log(`\nTesting with user ID: ${userId}`);
    
    // Test the exact query from settings.js
    const { data: settings, error } = await supabaseAdmin
      .from('settings')
      .select('*, background_images(id, name, url)')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.log('Settings query error:', error);
      console.log('This might be expected if user has no settings yet');
      
      // Let's create a settings record with a background image
      const { data: bgImages, error: bgError } = await supabaseAdmin
        .from('background_images')
        .select('*')
        .limit(5);
        
      console.log('\nAvailable background images:', bgImages);
      
      if (bgImages && bgImages.length > 0) {
        console.log('\nCreating settings record with background image...');
        const { data: newSettings, error: createError } = await supabaseAdmin
          .from('settings')
          .insert({
            user_id: userId,
            background_image_id: bgImages[0].id
          })
          .select('*, background_images(id, name, url)')
          .single();
          
        if (createError) {
          console.error('Error creating settings:', createError);
          return;
        }
        
        console.log('\nCreated settings:', JSON.stringify(newSettings, null, 2));
        
        // Now test the response processing
        const defaultSettings = {
          theme: 'light',
          language: 'en',
          notifications: true,
          background_image_id: null,
          background_images: null
        };
        
        const responseData = { ...defaultSettings, ...newSettings };
        
        // Add backgroundImage to preferences if background_images exists
        if (responseData.background_images) {
          responseData.preferences = {
            ...responseData.preferences,
            backgroundImage: {
              id: responseData.background_images.id,
              name: responseData.background_images.name,
              url: responseData.background_images.url
            }
          };
        }
        
        console.log('\nProcessed response (what frontend receives):');
        console.log(JSON.stringify(responseData, null, 2));
      }
      return;
    }
    
    console.log('\nRaw settings data:', JSON.stringify(settings, null, 2));
    
    // Simulate the response processing from settings.js
    const defaultSettings = {
      theme: 'light',
      language: 'en',
      notifications: true,
      background_image_id: null,
      background_images: null
    };
    
    const responseData = { ...defaultSettings, ...settings };
    
    // Add backgroundImage to preferences if background_images exists
    if (responseData.background_images) {
      responseData.preferences = {
        ...responseData.preferences,
        backgroundImage: {
          id: responseData.background_images.id,
          name: responseData.background_images.name,
          url: responseData.background_images.url
        }
      };
    }
    
    console.log('\nProcessed response (what frontend receives):');
    console.log(JSON.stringify(responseData, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSettingsAPI();