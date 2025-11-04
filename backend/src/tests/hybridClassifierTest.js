/**
 * Test script for Hybrid Query Classification System
 * Measures performance improvements and accuracy
 */

const HybridClassifier = require('../services/hybridClassifier.js');
const EnhancedRouterService = require('../services/enhancedRouterService.js');
const logger = require('../config/logger.js');

class HybridClassifierTest {
  constructor() {
    this.hybridClassifier = new HybridClassifier();
    this.routerService = new EnhancedRouterService();
    this.testQueries = [
      // Easy coding queries
      { query: "How to create a function in JavaScript?", expectedType: 'coding', expectedDifficulty: 'easy' },
      { query: "What is a variable in Python?", expectedType: 'coding', expectedDifficulty: 'easy' },
      
      // Hard coding queries
      { query: "Implement a distributed microservices architecture with event sourcing", expectedType: 'coding', expectedDifficulty: 'hard' },
      { query: "Debug this complex algorithm performance issue", expectedType: 'coding', expectedDifficulty: 'hard' },
      
      // Easy image queries
      { query: "Generate an image of a sunset", expectedType: 'image', expectedDifficulty: 'easy' },
      { query: "Create a simple logo design", expectedType: 'image', expectedDifficulty: 'easy' },
      
      // Easy text queries
      { query: "What is the weather like?", expectedType: 'text', expectedDifficulty: 'easy' },
      { query: "Explain photosynthesis", expectedType: 'text', expectedDifficulty: 'easy' },
      
      // Hard text queries
      { query: "Analyze the geopolitical implications of quantum computing on international security", expectedType: 'text', expectedDifficulty: 'hard' },
      { query: "Compare and contrast multiple economic theories with detailed analysis", expectedType: 'text', expectedDifficulty: 'hard' }
    ];
  }

  async runPerformanceTest() {
    console.log('🚀 Starting Hybrid Classification Performance Test\n');
    
    const results = {
      totalQueries: this.testQueries.length,
      correctClassifications: 0,
      localClassifications: 0,
      gptFallbacks: 0,
      totalResponseTime: 0,
      averageResponseTime: 0
    };

    for (const testCase of this.testQueries) {
      const startTime = Date.now();
      
      try {
        const classification = await this.hybridClassifier.classifyQuery(testCase.query);
        const responseTime = Date.now() - startTime;
        
        results.totalResponseTime += responseTime;
        
        // Check accuracy
        const typeCorrect = classification.type === testCase.expectedType;
        const difficultyCorrect = classification.difficulty === testCase.expectedDifficulty;
        
        if (typeCorrect && difficultyCorrect) {
          results.correctClassifications++;
        }
        
        // Track classification method
        if (classification.method === 'local') {
          results.localClassifications++;
        } else {
          results.gptFallbacks++;
        }
        
        console.log(`✅ Query: "${testCase.query.substring(0, 50)}..."`);
        console.log(`   Expected: ${testCase.expectedType}/${testCase.expectedDifficulty}`);
        console.log(`   Got: ${classification.type}/${classification.difficulty}`);
        console.log(`   Method: ${classification.method} | Time: ${responseTime}ms | Confidence: ${classification.confidence}\n`);
        
      } catch (error) {
        console.error(`❌ Error testing query: ${testCase.query}`, error.message);
      }
    }
    
    results.averageResponseTime = Math.round(results.totalResponseTime / results.totalQueries);
    
    return results;
  }

  async runIntegrationTest() {
    console.log('🔧 Testing Enhanced Router Service Integration\n');
    
    const testQuery = "Create a React component with TypeScript";
    
    try {
      const routingDecision = await this.routerService.routeQuery(testQuery, { sessionId: 'test-session' });
      
      console.log('📊 Routing Decision:');
      console.log(`   Type: ${routingDecision.type}`);
      console.log(`   Difficulty: ${routingDecision.difficulty}`);
      console.log(`   Model: ${routingDecision.primaryModel}`);
      console.log(`   Method: ${routingDecision.classificationMethod}`);
      console.log(`   Response Time: ${routingDecision.responseTime}ms`);
      console.log(`   Confidence: ${routingDecision.confidence}\n`);
      
      return routingDecision;
    } catch (error) {
      console.error('❌ Integration test failed:', error.message);
      return null;
    }
  }

  displayResults(results) {
    console.log('📈 HYBRID CLASSIFICATION PERFORMANCE RESULTS');
    console.log('=' .repeat(50));
    console.log(`Total Queries Tested: ${results.totalQueries}`);
    console.log(`Correct Classifications: ${results.correctClassifications}/${results.totalQueries} (${Math.round(results.correctClassifications/results.totalQueries*100)}%)`);
    console.log(`Local Classifications: ${results.localClassifications}/${results.totalQueries} (${Math.round(results.localClassifications/results.totalQueries*100)}%)`);
    console.log(`GPT Fallbacks: ${results.gptFallbacks}/${results.totalQueries} (${Math.round(results.gptFallbacks/results.totalQueries*100)}%)`);
    console.log(`Average Response Time: ${results.averageResponseTime}ms`);
    
    // Get performance stats from classifier
    const performanceStats = this.hybridClassifier.getPerformanceStats();
    console.log('\n📊 CLASSIFIER PERFORMANCE METRICS');
    console.log('=' .repeat(50));
    console.log(`Speed Improvement: ${performanceStats.speedImprovement}`);
    console.log(`Local Hit Rate: ${performanceStats.localHitRate}`);
    console.log(`Average Response Time: ${performanceStats.averageResponseTime}ms`);
  }

  async runFullTest() {
    try {
      // Run performance test
      const performanceResults = await this.runPerformanceTest();
      
      // Run integration test
      await this.runIntegrationTest();
      
      // Display results
      this.displayResults(performanceResults);
      
      console.log('\n✅ Hybrid Classification Test Completed Successfully!');
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  }
}

// Export for use in other modules
module.exports = HybridClassifierTest;

// Run test if this file is executed directly
if (require.main === module) {
  const test = new HybridClassifierTest();
  test.runFullTest();
}