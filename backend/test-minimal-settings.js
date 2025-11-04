const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testMinimalSettings() {
  console.log('🧪 Testing minimal settings query...');
  
  // Use a test user ID (this will be empty but should not cause PGRST116)
  const testUserId = '00000000-0000-0000-0000-000000000000';
  
  // Test the exact query from settings route
  try {
    console.log('🔍 Testing settings query...');
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', testUserId);
    
    console.log('✅ Query successful!');
    console.log('📄 Data:', data);
    console.log('❌ Error:', error);
    
  } catch (err) {
    console.error('❌ Query failed:', err);
  }
}

testMinimalSettings().catch(console.error);