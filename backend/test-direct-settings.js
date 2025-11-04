const express = require('express');
const supabase = require('./src/db/supabase/client');

const app = express();
app.use(express.json());

// Direct settings test route without any middleware
app.get('/test-settings', async (req, res) => {
    try {
        console.log('🔍 Direct settings test - no middleware');
        
        // Use a hardcoded user ID for testing
        const testUserId = 'de09a1fd-a004-4ebd-a501-62c56c551db7';
        
        console.log('🔍 About to query settings...');
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('user_id', testUserId);
        
        console.log('🔍 Query result:', { data, error });
        
        if (error) {
            console.log('🔍 Error details:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            return res.status(500).json({ error: error.message, code: error.code });
        }
        
        res.json({ success: true, data });
    } catch (err) {
        console.error('🔍 Caught exception:', err);
        res.status(500).json({ error: err.message });
    }
});

const port = 5000;
app.listen(port, () => {
    console.log(`🧪 Direct settings test server running on port ${port}`);
    console.log(`🧪 Test URL: http://localhost:${port}/test-settings`);
});