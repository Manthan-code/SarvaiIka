const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

const BASE_URL = 'http://localhost:5000';

// You'll need to replace this with a valid auth token
// Get it from your frontend by logging in and checking localStorage or cookies
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'YOUR_AUTH_TOKEN_HERE';

async function testImageGeneration() {
    console.log('🧪 Testing Image Generation API...\n');

    try {
        console.log('📝 Sending request to generate image...');
        const response = await axios.post(
            `${BASE_URL}/api/images/generate`,
            {
                prompt: 'A serene mountain landscape at sunset with vibrant colors',
                size: '1024x1024',
                quality: 'standard',
                style: 'vivid'
            },
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Image generated successfully!\n');
        console.log('Response:', JSON.stringify(response.data, null, 2));
        console.log('\n📸 Image URL:', response.data.image.url);
        console.log('🆔 Image ID:', response.data.image.id);
        console.log('📝 Prompt:', response.data.image.prompt);
        console.log('📏 Size:', response.data.image.size);
        console.log('✨ Quality:', response.data.image.quality);
        console.log('🎨 Style:', response.data.image.style);

        return response.data;
    } catch (error) {
        console.error('❌ Test failed!');

        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data);

            if (error.response.status === 401) {
                console.error('\n⚠️  Authentication failed!');
                console.error('Please set a valid AUTH_TOKEN in .env as TEST_AUTH_TOKEN');
                console.error('You can get a token by logging into the frontend and checking the browser\'s localStorage or network requests.');
            }
        } else {
            console.error('Error:', error.message);
        }

        throw error;
    }
}

async function testGetUserImages() {
    console.log('\n🧪 Testing Get User Images API...\n');

    try {
        console.log('📝 Fetching user\'s generated images...');
        const response = await axios.get(
            `${BASE_URL}/api/images/my-images?limit=5`,
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`
                }
            }
        );

        console.log('✅ Images retrieved successfully!\n');
        console.log(`Found ${response.data.images.length} images`);

        if (response.data.images.length > 0) {
            console.log('\nMost recent images:');
            response.data.images.forEach((img, index) => {
                console.log(`\n${index + 1}. ${img.prompt.substring(0, 50)}...`);
                console.log(`   URL: ${img.image_url}`);
                console.log(`   Created: ${img.created_at}`);
            });
        }

        return response.data;
    } catch (error) {
        console.error('❌ Test failed!');

        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }

        throw error;
    }
}

async function runTests() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  IMAGE GENERATION API TEST SUITE');
    console.log('═══════════════════════════════════════════════════════\n');

    if (AUTH_TOKEN === 'YOUR_AUTH_TOKEN_HERE') {
        console.error('⚠️  WARNING: No auth token provided!');
        console.error('Please set TEST_AUTH_TOKEN in backend/.env');
        console.error('\nTo get a token:');
        console.error('1. Open your frontend in browser');
        console.error('2. Login to your account');
        console.error('3. Open browser DevTools → Application → Local Storage');
        console.error('4. Copy the auth token value');
        console.error('5. Add to backend/.env: TEST_AUTH_TOKEN=your_token_here\n');
        process.exit(1);
    }

    try {
        // Test 1: Generate Image
        await testImageGeneration();

        // Test 2: Get User Images
        await testGetUserImages();

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('  ✅ ALL TESTS PASSED!');
        console.log('═══════════════════════════════════════════════════════\n');

    } catch (error) {
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('  ❌ TESTS FAILED');
        console.log('═══════════════════════════════════════════════════════\n');
        process.exit(1);
    }
}

runTests();
