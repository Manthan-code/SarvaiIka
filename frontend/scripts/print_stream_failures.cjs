const fs = require('fs');
const path = require('path');
const reportPath = path.resolve(__dirname, '..', 'jest-streaming-boundary.json');
if (!fs.existsSync(reportPath)) {
  console.error('Report file not found:', reportPath);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
for (const suite of data.testResults || []) {
  for (const test of suite.assertionResults || []) {
    if (test.status === 'failed') {
      console.log('TITLE:', test.title);
      const messages = test.failureMessages || [];
      if (messages.length === 0) continue;
      // Print the first line (error message) and then the stack
      for (const msg of messages) {
        const firstLine = msg.split('\n')[0];
        console.log('MESSAGE:', firstLine);
        console.log('STACK:');
        console.log(msg);
        console.log('---');
      }
    }
  }
}