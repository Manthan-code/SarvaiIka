const { Pool } = require('pg');
require('dotenv').config();

async function testConstraint() {
  let client;
  try {
    console.log('🧪 Testing background images constraint...');
    
    // Create PostgreSQL connection
    const pool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    client = await pool.connect();
    
    // Check current tier distribution
    const tierResult = await client.query(`
      SELECT tier_required, COUNT(*) as count 
      FROM background_images 
      GROUP BY tier_required 
      ORDER BY tier_required
    `);
    
    console.log('📊 Current tier distribution:');
    tierResult.rows.forEach(row => {
      console.log(`  ${row.tier_required}: ${row.count}`);
    });
    
    // Try to insert a test record with 'plus' tier to verify constraint
    console.log('🧪 Testing constraint by attempting to insert a "plus" tier record...');
    
    try {
      await client.query(`
        INSERT INTO background_images (name, description, url, tier_required) 
        VALUES ('Test Plus Image', 'Test description', 'https://example.com/test.jpg', 'plus')
      `);
      console.log('✅ Successfully inserted "plus" tier record - constraint is working!');
      
      // Clean up the test record
      await client.query(`DELETE FROM background_images WHERE name = 'Test Plus Image'`);
      console.log('🧹 Test record cleaned up');
      
    } catch (insertError) {
      if (insertError.code === '23514') {
        console.log('❌ Constraint still doesn\'t allow "plus" tier');
        console.log('Error:', insertError.message);
      } else {
        console.log('❌ Other error occurred:', insertError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (client) {
      client.release();
    }
    process.exit(0);
  }
}

testConstraint();