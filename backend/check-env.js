import dotenv from 'dotenv';
dotenv.config();

function checkEnvironmentVariables() {
  console.log('🔍 Checking environment variables for webhook functionality...\n');
  
  const requiredVars = {
    'STRIPE_SECRET_KEY': process.env.STRIPE_SECRET_KEY,
    'STRIPE_WEBHOOK_SECRET': process.env.STRIPE_WEBHOOK_SECRET,
    'STRIPE_CLI_WEBHOOK_SECRET': process.env.STRIPE_CLI_WEBHOOK_SECRET,
    'SUPABASE_URL': process.env.SUPABASE_URL,
    'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'NODE_ENV': process.env.NODE_ENV || 'development'
  };
  
  let allGood = true;
  
  for (const [varName, value] of Object.entries(requiredVars)) {
    if (value) {
      if (varName.includes('KEY') || varName.includes('SECRET')) {
        console.log(`✅ ${varName}: ${value.substring(0, 10)}...${value.substring(value.length - 4)}`);
      } else {
        console.log(`✅ ${varName}: ${value}`);
      }
    } else {
      console.log(`❌ ${varName}: NOT SET`);
      allGood = false;
    }
  }
  
  console.log('\n📋 Webhook Configuration Status:');
  
  if (requiredVars.STRIPE_WEBHOOK_SECRET) {
    console.log('✅ Production Stripe webhook secret configured');
  } else {
    console.log('❌ Production Stripe webhook secret missing');
  }
  
  if (requiredVars.STRIPE_CLI_WEBHOOK_SECRET) {
    console.log('✅ Stripe CLI webhook secret configured (for local development)');
  } else {
    console.log('⚠️  Stripe CLI webhook secret not configured (local development may not work)');
  }
  
  if (requiredVars.STRIPE_WEBHOOK_SECRET && requiredVars.STRIPE_CLI_WEBHOOK_SECRET) {
    console.log('🎯 Hybrid mode enabled - both production and development webhooks supported');
  } else if (requiredVars.STRIPE_WEBHOOK_SECRET || requiredVars.STRIPE_CLI_WEBHOOK_SECRET) {
    console.log('✅ Webhook signature verification will be enabled');
  } else {
    console.log('⚠️  Webhook signature verification will be disabled (development mode)');
  }
  
  if (requiredVars.STRIPE_SECRET_KEY) {
    console.log('✅ Stripe API operations will work');
  } else {
    console.log('❌ Stripe API operations will fail');
    allGood = false;
  }
  
  if (requiredVars.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('✅ Database operations will work (bypasses RLS)');
  } else {
    console.log('❌ Database operations will fail');
    allGood = false;
  }
  
  console.log('\n🚀 Next Steps:');
  
  if (allGood) {
    console.log('1. All environment variables are set correctly');
    console.log('2. Webhook processing should work properly');
    console.log('3. Test with: npm run test-webhook');
  } else {
    console.log('1. Fix missing environment variables above');
    console.log('2. Ensure .env file is properly configured');
    console.log('3. Restart the server after fixing variables');
  }
  
  return allGood;
}

// Run the check
checkEnvironmentVariables();
