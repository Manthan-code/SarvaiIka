const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test function to check admin access with a sample token
async function testAdminAccess() {
  try {
    console.log('🧪 Testing admin access...');
    
    // Get all users to see who has admin role
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, email, role, name')
      .eq('role', 'admin');

    if (error) {
      console.error('❌ Error fetching admin users:', error);
      return;
    }

    console.log('👑 Admin users found:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'No name'} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${user.role}`);
      console.log('');
    });

    if (users.length === 0) {
      console.log('⚠️  No admin users found!');
      return;
    }

    // Test creating a JWT token for an admin user
    const adminUser = users[0];
    console.log(`🔑 Testing with admin user: ${adminUser.email}`);

    // Create a test JWT token (this is just for testing - in real app, Supabase handles this)
    const testPayload = {
      sub: adminUser.id,
      email: adminUser.email,
      role: 'authenticated',
      user_metadata: {
        role: adminUser.role
      }
    };

    console.log('📋 Test payload:', testPayload);
    console.log('');
    console.log('✅ Admin access test completed.');
    console.log('💡 To test the frontend:');
    console.log('   1. Make sure you are logged in as an admin user');
    console.log('   2. Check browser console for debugging logs');
    console.log('   3. Verify the session token includes admin role');

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testAdminAccess();