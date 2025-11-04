const supabase = require('./src/db/supabase/client.js');
const supabaseAdmin = require('./src/db/supabase/admin.js');
const logger = require('./src/config/logger.js');

async function testDatabaseConnection() {
  console.log('Testing Supabase database connection...');
  
  try {
    // Test 1: Basic connection with client
    console.log('\n1. Testing basic client connection...');
    const { data: clientTest, error: clientError } = await supabase
      .from('chats')
      .select('id')
      .limit(1);
    
    if (clientError) {
      console.error('Client connection error:', clientError);
    } else {
      console.log('✅ Client connection successful');
    }
    
    // Test 2: Admin connection
    console.log('\n2. Testing admin connection...');
    const { data: adminTest, error: adminError } = await supabaseAdmin
      .from('chats')
      .select('id')
      .limit(1);
    
    if (adminError) {
      console.error('Admin connection error:', adminError);
    } else {
      console.log('✅ Admin connection successful');
    }
    
    // Test 3: Specific chat query that's failing
    console.log('\n3. Testing specific chat query...');
    const chatId = 'd51a4486-42d3-477e-98e9-fef5e34d22ed';
    const { data: chatData, error: chatError } = await supabaseAdmin
      .from('chats')
      .select('id, title, created_at, last_message_at, total_messages, user_id')
      .eq('id', chatId)
      .single();
    
    if (chatError) {
      console.error('Chat query error:', chatError);
      console.error('Error code:', chatError.code);
      console.error('Error details:', chatError.details);
    } else {
      console.log('✅ Chat query successful:', chatData);
    }
    
    // Test 4: Check if chat exists at all
    console.log('\n4. Checking if chat exists...');
    const { data: existsData, error: existsError } = await supabaseAdmin
      .from('chats')
      .select('id')
      .eq('id', chatId);
    
    if (existsError) {
      console.error('Exists check error:', existsError);
    } else {
      console.log('Chat exists check result:', existsData);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testDatabaseConnection();