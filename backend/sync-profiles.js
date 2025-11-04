import { createClient } from '@supabase/supabase-js';
import supabaseAdmin from './src/db/supabase/admin.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

async function syncExistingUsers() {
  try {
    console.log('🔄 Syncing existing users to profiles...');
    
    // First, get all users from auth.users using admin client
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    console.log(`📋 Found ${authUsers.users.length} users in auth.users`);
    
    // Get existing profiles
    const { data: existingProfiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id');
    
    if (profilesError) {
      console.error('❌ Error fetching existing profiles:', profilesError);
      return;
    }
    
    const existingProfileIds = new Set(existingProfiles.map(p => p.id));
    console.log(`📋 Found ${existingProfiles.length} existing profiles`);
    
    // Filter users who don't have profiles
    const usersWithoutProfiles = authUsers.users.filter(user => !existingProfileIds.has(user.id));
    console.log(`👤 Found ${usersWithoutProfiles.length} users without profiles`);
    
    if (usersWithoutProfiles.length === 0) {
      console.log('✅ All users already have profiles!');
      return;
    }
    
    // Create profiles for users who don't have them
    const profilesToCreate = usersWithoutProfiles.map(user => ({
      id: user.id,
      name: user.user_metadata?.name || user.user_metadata?.full_name || user.email || 'User',
      email: user.email,
      created_at: user.created_at,
      updated_at: new Date().toISOString()
    }));
    
    console.log('📝 Creating profiles for users without them...');
    
    // Insert profiles in batches
    const batchSize = 10;
    let created = 0;
    
    for (let i = 0; i < profilesToCreate.length; i += batchSize) {
      const batch = profilesToCreate.slice(i, i + batchSize);
      
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .insert(batch)
        .select();
      
      if (error) {
        console.error(`❌ Error creating batch ${Math.floor(i/batchSize) + 1}:`, error);
        continue;
      }
      
      created += data.length;
      console.log(`✅ Created ${data.length} profiles (batch ${Math.floor(i/batchSize) + 1})`);
    }
    
    console.log(`🎉 Successfully created ${created} new profiles!`);
    
    // Check final count
    const { data: finalProfiles, error: finalError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, name')
      .order('created_at', { ascending: false });
    
    if (finalError) {
      console.error('Error fetching final profiles:', finalError);
      return;
    }
    
    console.log(`📊 Total profiles in database: ${finalProfiles.length}`);
    if (finalProfiles.length > 0) {
      console.log('Latest profiles:');
      finalProfiles.slice(0, 3).forEach(profile => {
        console.log(`  - ${profile.email} (${profile.name})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Sync error:', error);
  }
}

syncExistingUsers();