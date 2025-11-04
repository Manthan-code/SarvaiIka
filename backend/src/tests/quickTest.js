// Quick test to verify hybrid classifier is working
const HybridClassifier = require('../services/hybridClassifier.js');

console.log('🚀 Starting Quick Hybrid Classifier Test');

const classifier = new HybridClassifier();

try {
  console.log('Testing local classification...');
  const result = await classifier.classifyQuery('How to create a function in JavaScript?');
  console.log('Result:', result);
  console.log('✅ Test completed successfully!');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
}