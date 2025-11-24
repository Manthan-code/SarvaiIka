const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function initializeSchema() {
    console.log('🔧 Initializing database schema for generated_images...\n');

    try {
        // First, check if table exists
        const { data: existingTable, error: checkError } = await supabase
            .from('generated_images')
            .select('id')
            .limit(1);

        if (!checkError || checkError.code !== 'PGRST116') {
            console.log('✅ Table "generated_images" already exists!');
            return;
        }

        console.log('📝 Table does not exist. Creating via SQL file...\n');
        console.log('⚠️  Supabase client cannot execute DDL statements directly.');
        console.log('📋 Please run the following SQL in your Supabase SQL Editor:\n');
        console.log('─'.repeat(60));

        const sqlPath = path.join(__dirname, 'backend', 'src', 'db', 'supabase', 'schema', 'generated_images.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(sql);
        console.log('─'.repeat(60));
        console.log('\n📍 Location: Supabase Dashboard → SQL Editor → New Query');
        console.log('📍 Or visit: https://supabase.com/dashboard/project/YOUR_PROJECT/sql');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

initializeSchema();
