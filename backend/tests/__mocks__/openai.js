/**
 * Mock OpenAI module for testing
 * Prevents actual API calls and quota errors
 */

class MockOpenAI {
  constructor(config = {}) {
    this.apiKey = config.apiKey || 'mock-api-key';
    this.chat = {
      completions: {
        create: jest.fn().mockImplementation(async (params) => {
          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 50));
          
          const mockResponse = {
            id: 'chatcmpl-mock-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: params.model || 'gpt-3.5-turbo',
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: this.generateMockResponse(params.messages)
              },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: 50,
              completion_tokens: 100,
              total_tokens: 150
            }
          };
          
          return mockResponse;
        })
      }
    };
    
    this.images = {
      generate: jest.fn().mockImplementation(async (params) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          created: Math.floor(Date.now() / 1000),
          data: [{
            url: 'https://mock-image-url.com/generated-image.png',
            revised_prompt: params.prompt
          }]
        };
      })
    };
  }
  
  generateMockResponse(messages) {
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.content.toLowerCase();
    
    // Generate contextual mock responses
    if (content.includes('code') || content.includes('function') || content.includes('programming')) {
      return `Here's a mock code solution:\n\n\`\`\`javascript\nfunction mockSolution() {\n  // Mock implementation\n  return 'This is a mock response for coding queries';\n}\n\`\`\``;
    }
    
    if (content.includes('image') || content.includes('picture')) {
      return 'I understand you want to generate an image. This is a mock response that would normally trigger image generation.';
    }
    
    if (content.includes('complex') || content.includes('advanced')) {
      return 'This is a mock response for complex queries. In a real scenario, this would be handled by a more sophisticated model like GPT-4.';
    }
    
    // Default response
    return `This is a mock AI response to: "${lastMessage.content}". The actual AI service would provide a more detailed and contextual response.`;
  }
  
  // Mock static methods
  static mockReset() {
    // Reset all mocks
  }
}

// Mock the default export
const mockOpenAI = jest.fn().mockImplementation((config) => new MockOpenAI(config));

// Add static properties
mockOpenAI.OpenAI = MockOpenAI;

module.exports = mockOpenAI;
module.exports.default = mockOpenAI;
module.exports.OpenAI = MockOpenAI;