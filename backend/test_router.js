const enhancedRouterService = require('./src/services/enhancedRouterService');
const { modelRouter } = require('./src/services/enhancedRouter');
const logger = require('./src/config/logger');

// Mock logger to avoid cluttering output
logger.info = (msg, meta) => console.log(`[INFO] ${msg}`, meta ? JSON.stringify(meta) : '');
logger.warn = (msg, meta) => console.log(`[WARN] ${msg}`, meta ? JSON.stringify(meta) : '');
logger.error = (msg, meta) => console.error(`[ERROR] ${msg}`, meta ? JSON.stringify(meta) : '');

async function testRouter() {
    console.log('--- Starting Router Verification ---');

    const testCases = [
        { query: 'What is the capital of France?', expectedType: 'simple/factual' },
        { query: 'Write a Python script to scrape a website using BeautifulSoup.', expectedType: 'code' },
        { query: 'Explain the theory of relativity in simple terms.', expectedType: 'complex/info' },
        { query: 'Calculate the derivative of x^2 + 3x.', expectedType: 'math/complex' },
        { query: 'What is 2 + 2?', expectedType: 'math/simple' },
        { query: 'What is sin(30)?', expectedType: 'math/trig' },
        { query: 'Translate "Hello world" to Spanish.', expectedType: 'translation' }
    ];

    for (const test of testCases) {
        console.log(`\nTesting Query: "${test.query}"`);

        try {
            // Test 1: EnhancedRouterService (Low-level)
            const decision = await enhancedRouterService.routeQuery(test.query, { subscriptionPlan: 'free' });
            console.log(`   > Service Decision: ${decision.primaryModel}`);

            // Test 2: EnhancedModelRouter (High-level with fallback)
            const route = await modelRouter.routeQuery(test.query, 'free');
            console.log(`   > Router Result: ${route.primaryModel}`);
            console.log(`   > Fallbacks: ${JSON.stringify(route.fallbackModels)}`);

            // Verification Logic
            if (!route.primaryModel) {
                console.error('❌ FAIL: No model selected');
            } else {
                console.log('✅ PASS: Model selected');
            }

            // Check Fallback Logic
            if (['deepseek-v3', 'qwen'].includes(route.primaryModel)) {
                if (route.fallbackModels.length > 0 && ['gpt-4o-mini', 'gemini-2.5-flash'].includes(route.fallbackModels[0])) {
                    console.log('✅ PASS: Correct fallback for new model');
                } else {
                    console.error('❌ FAIL: Missing or incorrect fallback for new model');
                }
            }

        } catch (err) {
            console.error('❌ FAIL: Error during routing', err);
        }
    }

    console.log('\n--- Verification Complete ---');
    process.exit(0);
}

testRouter();
