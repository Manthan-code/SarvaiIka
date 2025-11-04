import { createClient } from '@supabase/supabase-js';
import supabaseAdmin from './src/db/supabase/admin.js';
import dotenv from 'dotenv';

dotenv.config();

async function insertPlans() {
  try {
    console.log('Checking existing plans...');
    
    const { data: existingPlans, error: checkError } = await supabaseAdmin
      .from('plans')
      .select('*');
    
    if (checkError) {
      console.error('Error checking plans:', checkError);
      return;
    }
    
    console.log('Existing plans count:', existingPlans.length);
    
    if (existingPlans.length > 0) {
      console.log('Plans already exist:');
      existingPlans.forEach(plan => {
        console.log(`- ${plan.name}: $${plan.price}`);
      });
      return;
    }
    
    console.log('Inserting default plans...');
    
    const plans = [
      {
        name: 'Free',
        description: 'Basic access with limitations',
        price: 0.00,
        currency: 'USD',
        billing_interval: 'monthly',
        features: ["5 AI conversations per day", "Basic model access", "Standard response quality", "Email support"],
        limitations: ["No priority access", "Limited conversation history"],
        max_messages_per_month: 150,
        max_chats: 10,
        supports_file_upload: false,
        supports_voice_input: false,
        priority_support: false,
        display_order: 1,
        trial_days: 0,
        is_active: true
      },
      {
        name: 'Plus',
        description: 'Enhanced features for regular users',
        price: 15.00,
        currency: 'USD',
        billing_interval: 'monthly',
        features: ["50 AI conversations per day", "Advanced model access", "Improved response quality", "Priority support", "Extended conversation history", "Early feature access"],
        limitations: [],
        max_messages_per_month: 1500,
        max_chats: 100,
        supports_file_upload: true,
        supports_voice_input: false,
        priority_support: true,
        display_order: 2,
        trial_days: 7,
        is_active: true
      },
      {
        name: 'Pro',
        description: 'Complete access for power users',
        price: 45.00,
        currency: 'USD',
        billing_interval: 'monthly',
        features: ["Unlimited AI conversations", "All model access", "Highest response quality", "24/7 dedicated support", "Full conversation history", "Custom instructions", "API access", "Team management features"],
        limitations: [],
        max_messages_per_month: null,
        max_chats: null,
        supports_file_upload: true,
        supports_voice_input: true,
        priority_support: true,
        display_order: 3,
        trial_days: 14,
        is_active: true
      }
    ];
    
    const { data: insertedPlans, error: insertError } = await supabaseAdmin
      .from('plans')
      .insert(plans)
      .select();
    
    if (insertError) {
      console.error('Error inserting plans:', insertError);
      return;
    }
    
    console.log('Successfully inserted plans:');
    insertedPlans.forEach(plan => {
      console.log(`- ${plan.name}: $${plan.price} (ID: ${plan.id})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

insertPlans();