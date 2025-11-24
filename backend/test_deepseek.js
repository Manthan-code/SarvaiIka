require('dotenv').config({ path: './backend/.env' });
const OpenAI = require('openai');

async function testDeepSeek() {
    console.log('Testing DeepSeek API...');

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        console.error('❌ DEEPSEEK_API_KEY is missing in .env');
        return;
    }
    console.log(`Key found: ${apiKey.substring(0, 4)}...`);

    const client = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://api.deepseek.com'
    });

    try {
        const stream = await client.chat.completions.create({
            model: 'deepseek-chat', // Trying standard model first to verify key
            messages: [{ role: 'user', content: 'Hello, are you working?' }],
            stream: true
        });

        process.stdout.write('Response: ');
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            process.stdout.write(content);
        }
        console.log('\n\n✅ DeepSeek (deepseek-chat) Success!');

    } catch (error) {
        console.error('\n❌ DeepSeek Failed:', error.message);
        if (error.response) {
            console.error('Error Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testDeepSeek();
