// Test script for usage tracking
// Run with: node test_usage.js

import dotenv from 'dotenv';
import supabase from './src/db/supabase/client.js';
import logger from './src/config/logger.js';

dotenv.config();

async function testUsageTracking() {
  logger.info('Testing usage tracking...');
  
  try {
    // Test 1: Check if api_usage table exists
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'api_usage');
    
    if (error) {
      logger.error('Error checking table:', error);
      return;
    }
    
    if (tables.length === 0) {
      logger.warn('api_usage table not found. Please run the migration first.');
      logger.info('Run this SQL in your Supabase dashboard:');
      logger.info('   backend/src/db/supabase/migrations/create_api_usage_table.sql');
      return;
    }
    
    logger.info('api_usage table exists');
    
    // Test 2: Check table structure
    const { data: columns, error: colError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'api_usage');
    
    if (colError) {
      logger.error('Error checking columns:', colError);
      return;
    }
    
    logger.info('Table structure:', columns);
    
    logger.info('Usage tracking system is ready!');
    logger.info('You can now test the /chat endpoint with different user types.');
    
  } catch (error) {
    logger.error('Test failed:', error);
  }
}

testUsageTracking();