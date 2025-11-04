#!/usr/bin/env node

/**
 * Bundle Analysis Script
 * Analyzes the built bundle and identifies optimization opportunities
 */

const fs = require('fs');
const path = require('path');

// Read package.json to get dependencies
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = Object.keys(packageJson.dependencies);

// Unused Radix UI components based on search results
const unusedRadixComponents = [
  '@radix-ui/react-accordion', // Used in ui component but not imported in app
  '@radix-ui/react-alert-dialog', // Used in ui component but not imported in app
  '@radix-ui/react-aspect-ratio', // Used in ui component but not imported in app
  '@radix-ui/react-checkbox', // Used in ui component but not imported in app
  '@radix-ui/react-context-menu', // Used in ui component but not imported in app
  '@radix-ui/react-hover-card', // Used in ui component but not imported in app
  '@radix-ui/react-menubar', // Used in ui component but not imported in app
  '@radix-ui/react-navigation-menu', // Used in ui component but not imported in app
  '@radix-ui/react-radio-group', // Used in ui component but not imported in app
  '@radix-ui/react-scroll-area', // Used in ui component but not imported in app
  '@radix-ui/react-slider', // Used in ui component but not imported in app
  '@radix-ui/react-toggle', // Used in ui component but not imported in app
  '@radix-ui/react-toggle-group' // Used in ui component but not imported in app
];

// Other potentially unused dependencies
const potentiallyUnused = [
  'embla-carousel-react', // Check if carousel is used
  'react-day-picker', // Check if date picker is used
  'react-resizable-panels', // Check if resizable panels are used
  'vaul', // Check if drawer component is used
  'input-otp', // Check if OTP input is used
  'cmdk' // Check if command palette is used
];

console.log('🔍 Bundle Analysis Report');
console.log('========================\n');

console.log('📦 Total Dependencies:', dependencies.length);
console.log('🗑️  Potentially Unused Radix Components:', unusedRadixComponents.length);
console.log('❓ Other Potentially Unused:', potentiallyUnused.length);

console.log('\n🗑️  Unused Radix UI Components:');
unusedRadixComponents.forEach(dep => {
  console.log(`  - ${dep}`);
});

console.log('\n❓ Other Dependencies to Review:');
potentiallyUnused.forEach(dep => {
  console.log(`  - ${dep}`);
});

// Calculate potential savings
const totalUnused = unusedRadixComponents.length + potentiallyUnused.length;
const estimatedSavings = totalUnused * 15; // Rough estimate of KB per component

console.log(`\n💾 Estimated Bundle Size Reduction: ~${estimatedSavings}KB`);
console.log('\n🚀 Recommendations:');
console.log('  1. Remove unused Radix UI components');
console.log('  2. Implement tree shaking for remaining components');
console.log('  3. Use dynamic imports for large features');
console.log('  4. Consider replacing heavy dependencies with lighter alternatives');

// Check if dist folder exists to analyze actual bundle
if (fs.existsSync('dist')) {
  console.log('\n📊 Current Bundle Analysis:');
  const distFiles = fs.readdirSync('dist/assets').filter(f => f.endsWith('.js'));
  
  distFiles.forEach(file => {
    const filePath = path.join('dist/assets', file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`  - ${file}: ${sizeKB}KB`);
  });
}

console.log('\n✅ Run this script after removing dependencies to see improvements!');