require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  try {
    console.log('Applying performance indexes migration...');
    
    const sqlFile = path.join(__dirname, '../migrations/add_performance_indexes.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}`);
        
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });
        
        if (error) {
          console.error(`Error executing statement ${i + 1}:`, error);
          // Continue with other statements even if one fails
        } else {
          console.log(`Statement ${i + 1} executed successfully`);
        }
      }
    }
    
    console.log('Migration completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();