const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function promoteUserToAdmin() {
  try {
    console.log('🔍 Looking for users to promote to admin...');
    
    // Get the most recent user (likely the one currently logged in)
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, email, role, name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }

    console.log('📋 Recent users:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'No name'} (${user.email}) - Role: ${user.role}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log('');
    });

    // Find a user that's not already admin
    const nonAdminUser = users.find(user => user.role !== 'admin');
    
    if (!nonAdminUser) {
      console.log('✅ All recent users are already admins!');
      return;
    }

    console.log(`🎯 Promoting user: ${nonAdminUser.name || 'No name'} (${nonAdminUser.email}) to admin...`);

    // Update the user's role to admin
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', nonAdminUser.id)
      .select();

    if (updateError) {
      console.error('❌ Error updating user role:', updateError);
      return;
    }

    console.log('✅ Successfully promoted user to admin!');
    console.log('Updated user:', data[0]);
    console.log('');
    console.log('🔄 You can now refresh the ManageUsers page and it should work.');

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

promoteUserToAdmin();