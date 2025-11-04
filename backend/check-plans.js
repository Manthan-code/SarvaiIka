import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkPlans() {
  try {
    console.log('Fetching all plans...');
    
    const { data: plans, error } = await supabase
      .from('plans')
      .select('*');
    
    if (error) {
      console.error('Error fetching plans:', error);
      return;
    }
    
    console.log('All plans:');
    plans.forEach(plan => {
      console.log(`- ID: ${plan.id}, Name: "${plan.name}", Price: ${plan.price}`);
    });
    
    console.log('\nTesting case-insensitive search for "plus"...');
    const { data: plusPlan, error: plusError } = await supabase
      .from('plans')
      .select('*')
      .ilike('name', 'plus')
      .single();
    
    if (plusError) {
      console.error('Error searching for plus plan:', plusError);
    } else {
      console.log('Found plus plan:', plusPlan);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPlans();