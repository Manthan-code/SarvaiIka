const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUserRoles() {
  try {
    console.log('🔍 Checking user roles in the database...');
    
    // Get all users with their roles
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, email, role, name')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }

    console.log('👥 Users in database:');
    console.log('Total users:', users.length);
    console.log('');

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'No name'} (${user.email})`);
      console.log(`   Role: ${user.role || 'No role'}`);
      console.log(`   ID: ${user.id}`);
      console.log('');
    });

    // Count users by role
    const roleCounts = users.reduce((acc, user) => {
      const role = user.role || 'no role';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    console.log('📊 Role distribution:');
    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`   ${role}: ${count} users`);
    });

    // Check if there are any admin users
    const adminUsers = users.filter(user => user.role === 'admin');
    console.log('');
    console.log('👑 Admin users:', adminUsers.length);
    if (adminUsers.length > 0) {
      adminUsers.forEach(admin => {
        console.log(`   - ${admin.name || 'No name'} (${admin.email})`);
      });
    } else {
      console.log('⚠️  No admin users found! This explains why the admin endpoint is not accessible.');
      console.log('💡 To fix this, you need to update a user\'s role to "admin" in the database.');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkUserRoles();