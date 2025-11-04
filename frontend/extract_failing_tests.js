import fs from 'fs';

// Read the test results file
const testResults = fs.readFileSync('all_test_results.txt', 'utf8');

// Extract failing test suites and tests
const failingSuites = [];
const failingTests = [];

// Split into lines for processing
const lines = testResults.split('\n');

let currentSuite = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  // Detect failing test suites
  if (line.includes('FAIL tests/')) {
    const match = line.match(/FAIL (tests\/.*\.test\.[jt]sx?)/);
    if (match) {
      currentSuite = match[1];
      failingSuites.push(currentSuite);
    }
  }
  
  // Detect individual failing tests (marked with ✕ or ΓùÅ)
  if ((line.includes('✕') || line.includes('ΓùÅ')) && currentSuite) {
    // Look for test names after the failure marker
    const testMatch = line.match(/[✕ΓùÅ]\s+(.+?)(?:\s+\(|\s*$)/);
    if (testMatch) {
      const testName = testMatch[1].trim();
      // Skip if it's just a suite name or contains special characters that indicate it's not a test
      if (testName && !testName.includes('│') && !testName.includes('├') && !testName.includes('└')) {
        failingTests.push({
          suite: currentSuite,
          test: testName
        });
      }
    }
  }
  
  // Also look for nested test failures with different indentation
  if (line.includes('ΓÇ║') && currentSuite) {
    const parts = line.split('ΓÇ║');
    if (parts.length > 1) {
      const testName = parts[parts.length - 1].trim();
      if (testName && !testName.includes('│') && !testName.includes('├') && !testName.includes('└')) {
        failingTests.push({
          suite: currentSuite,
          test: testName
        });
      }
    }
  }
}

// Output results
console.log('=== FAILING TEST SUITES ===');
console.log(`Total failing suites: ${failingSuites.length}`);
failingSuites.forEach((suite, index) => {
  console.log(`${index + 1}. ${suite}`);
});

console.log('\n=== INDIVIDUAL FAILING TESTS ===');
console.log(`Total failing tests: ${failingTests.length}`);

// Group by suite
const testsBySuite = {};
failingTests.forEach(test => {
  if (!testsBySuite[test.suite]) {
    testsBySuite[test.suite] = [];
  }
  testsBySuite[test.suite].push(test.test);
});

Object.keys(testsBySuite).forEach(suite => {
  console.log(`\n${suite}:`);
  testsBySuite[suite].forEach((test, index) => {
    console.log(`  ${index + 1}. ${test}`);
  });
});

// Save to file
const output = {
  summary: {
    totalFailingSuites: failingSuites.length,
    totalFailingTests: failingTests.length
  },
  failingSuites,
  failingTestsBySuite: testsBySuite
};

fs.writeFileSync('failing_tests_analysis.json', JSON.stringify(output, null, 2));
console.log('\n=== Analysis saved to failing_tests_analysis.json ===');