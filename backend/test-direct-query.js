const supabase = require('./src/db/supabase/client');

async function testDirectQuery() {
    try {
        console.log('🔍 Testing direct Supabase query...');
        
        // Test user ID from our previous test
        const testUserId = 'c5898c57-6dce-4dbe-848b-e588616f4e4e';
        
        console.log(`🔍 Querying settings for user: ${testUserId}`);
        
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('user_id', testUserId);
        
        console.log('🔍 Query result:');
        console.log('Data:', data);
        console.log('Error:', error);
        
        if (error) {
            console.log('Error code:', error.code);
            console.log('Error message:', error.message);
        }
        
        if (!data || data.length === 0) {
            console.log('✅ No settings found - this is expected for new users');
            console.log('✅ This should return default settings in the API');
        } else {
            console.log('✅ Settings found:', data.length, 'records');
        }
        
    } catch (err) {
        console.error('❌ Unexpected error:', err);
    }
}

testDirectQuery();