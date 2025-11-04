const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = require('./src/db/supabase/admin.js');
require('dotenv').config();

async function createAdminUser() {
  try {
    const email = process.argv[2] || 'admin@test.com';
    const password = process.argv[3] || 'admin123456';
    const name = process.argv[4] || 'Admin User';

    console.log(`Creating admin user with email: ${email}`);

    // First, try to create the user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });

    if (authError && !authError.message.includes('already registered')) {
      console.error('Error creating auth user:', authError);
      return;
    }

    const userId = authUser?.user?.id || authError?.user?.id;
    
    if (!userId) {
      // Try to get existing user
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers.users.find(u => u.email === email);
      
      if (!existingUser) {
        console.error('Could not create or find user');
        return;
      }
      
      console.log('User already exists, updating profile...');
      userId = existingUser.id;
    }

    // Create or update the profile with admin role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        name: name,
        role: 'admin',
        subscription_plan: 'plus',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating/updating profile:', profileError);
      return;
    }

    console.log('✅ Admin user created/updated successfully:');
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${name}`);
    console.log(`   Role: ${profile.role}`);
    console.log(`   Subscription: ${profile.subscription_plan}`);
    console.log(`   User ID: ${userId}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Usage: node create-admin.js [email] [password] [name]
// Example: node create-admin.js admin@test.com mypassword "Admin User"
createAdminUser();