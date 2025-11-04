const { Pool } = require('pg');
require('dotenv').config();

// Initialize PostgreSQL connection using Supabase URL
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testPlusBackgrounds() {
  const userId = 'b7de34ed-8524-427d-b8e4-05bc47018942'; // Plus user
  
  console.log('🧪 Testing Plus Member Background Images');
  console.log('=====================================');
  
  try {
    // 1. Get user's current tier
    const userResult = await pool.query(
      'SELECT subscription_plan FROM profiles WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const userTier = userResult.rows[0].subscription_plan;
    console.log('✅ User tier:', userTier);
    
    // 2. Get all background images available to plus users
    const bgResult = await pool.query(`
      SELECT * FROM background_images 
      WHERE is_active = true 
      AND tier_required IN ('free', 'plus')
      ORDER BY tier_required ASC
    `);
    
    console.log('✅ Available background images:', bgResult.rows.length);
    
    // 3. Find a plus-tier background image
    const plusImage = bgResult.rows.find(img => img.tier_required === 'plus');
    if (!plusImage) {
      console.log('❌ No plus-tier background images found');
      return;
    }
    
    console.log('✅ Plus-tier image found:', plusImage.name, '(ID:', plusImage.id + ')');
    
    // 4. Test setting the plus background image
    const settingsResult = await pool.query(
      'SELECT preferences FROM settings WHERE user_id = $1',
      [userId]
    );
    
    const currentPreferences = settingsResult.rows.length > 0 ? settingsResult.rows[0].preferences || {} : {};
    const newPreferences = {
      ...currentPreferences,
      backgroundImage: {
        id: plusImage.id,
        name: plusImage.name,
        url: plusImage.url
      }
    };
    
    // Update or insert settings
    await pool.query(`
      INSERT INTO settings (user_id, preferences) 
      VALUES ($1, $2) 
      ON CONFLICT (user_id) 
      DO UPDATE SET preferences = $2
    `, [userId, JSON.stringify(newPreferences)]);
    
    console.log('✅ Successfully set plus background image');
    
    // 5. Verify the setting was saved
    const verifyResult = await pool.query(
      'SELECT preferences FROM settings WHERE user_id = $1',
      [userId]
    );
    
    if (verifyResult.rows.length === 0) {
      console.log('❌ Settings not found after save');
      return;
    }
    
    const savedBackground = verifyResult.rows[0].preferences?.backgroundImage;
    if (savedBackground && savedBackground.id === plusImage.id) {
      console.log('✅ Background image setting verified');
      console.log('📸 Current background:', savedBackground.name, '(' + savedBackground.url + ')');
    } else {
      console.log('❌ Background image setting not saved correctly');
      console.log('Saved:', savedBackground);
    }
    
    console.log('\n🎉 Plus member background test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

testPlusBackgrounds();