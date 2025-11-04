import { createClient } from '@supabase/supabase-js';
import supabaseAdmin from './src/db/supabase/admin.js';
import dotenv from 'dotenv';

dotenv.config();

const userId = '4ac7f58d-193e-4252-bb06-fb14ef708682';

async function checkAndFixProfile() {
  try {
    console.log('Checking profile for user:', userId);
    
    // Check if profile exists
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileError && profileError.code === 'PGRST116') {
      console.log('Profile not found, checking auth user...');
      
      // Get user from auth
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (authError) {
        console.error('Auth user not found:', authError);
        return;
      }
      
      console.log('Auth user found:', authUser.user.email);
      
      // Create profile
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert([
          {
            id: userId,
            email: authUser.user.email,
            name: authUser.user.user_metadata?.name || authUser.user.email.split('@')[0],
            subscription_plan: 'plus', // Set to plus as requested
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();
      
      if (createError) {
        console.error('Failed to create profile:', createError);
        return;
      }
      
      console.log('Profile created successfully:', newProfile);
    } else if (profileError) {
      console.error('Profile query error:', profileError);
    } else {
      console.log('Profile found:', profile);
      
      // Update subscription plan to plus if it's not already
      if (profile.subscription_plan !== 'plus') {
        const { data: updatedProfile, error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ subscription_plan: 'plus' })
          .eq('id', userId)
          .select()
          .single();
        
        if (updateError) {
          console.error('Failed to update profile:', updateError);
        } else {
          console.log('Profile updated to plus plan:', updatedProfile);
        }
      } else {
        console.log('Profile already has plus plan');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAndFixProfile();