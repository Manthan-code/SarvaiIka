/**
 * Simple test script to verify the new routing logic
 */

// Set environment variables to force mock mode
process.env.NODE_ENV = 'test';
process.env.USE_MOCK_AI = 'true';
delete process.env.OPENAI_API_KEY;
delete process.env.ROUTER_OPENAI_API_KEY;

async function testRouting() {
  const { EnhancedModelRouter } = await import('./src/services/enhancedRouter.js');
  console.log('Testing Enhanced Router with Easy/Hard Difficulty System\n');
  
  const router = new EnhancedModelRouter();
  
  const testCases = [
    {
      query: 'What is the weather today?',
      userPlan: 'free',
      expected: { difficulty: 'easy', model: 'gpt-3.5-turbo' }
    },
    {
      query: 'Implement a complex machine learning algorithm with neural networks',
      userPlan: 'free',
      expected: { difficulty: 'easy', model: 'gpt-3.5-turbo' } // Free user gets downgraded
    },
    {
      query: 'What is the weather today?',
      userPlan: 'plus',
      expected: { difficulty: 'easy', model: 'gpt-3.5-turbo' }
    },
    {
      query: 'Implement a complex machine learning algorithm with neural networks',
      userPlan: 'plus',
      expected: { difficulty: 'hard', model: 'gpt-4' } // Plus user gets hard model
    },
    {
      query: 'Build a distributed microservices architecture with Kubernetes',
      userPlan: 'pro',
      expected: { difficulty: 'hard', model: 'gpt-4' }
    }
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`Test ${i + 1}: ${testCase.userPlan} user`);
    console.log(`Query: "${testCase.query}"`);
    
    try {
      const result = await router.routeQuery(testCase.query, testCase.userPlan);
      
      console.log(`Result:`);
      console.log(`  - Difficulty: ${result.difficulty}`);
      console.log(`  - Model: ${result.primaryModel}`);
      console.log(`  - Restricted: ${result.restricted}`);
      
      // Verify expectations
      const passed = result.difficulty === testCase.expected.difficulty && 
                    result.primaryModel === testCase.expected.model;
      
      console.log(`  - Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (!passed) {
        console.log(`  - Expected: ${testCase.expected.difficulty} difficulty, ${testCase.expected.model} model`);
      }
      
    } catch (error) {
      console.log(`  - Error: ${error.message}`);
    }
    
    console.log('');
  }
}

// Run the test
testRouting().catch(console.error);