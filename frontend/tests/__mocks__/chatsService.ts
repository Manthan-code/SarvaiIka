/**
 * Mock Chats Service
 * This mock implements all methods of the chats service with appropriate return values
 */

const chatsService = {
  // Chat retrieval methods
  getChats: jest.fn().mockResolvedValue({
    success: true,
    data: []
  }),
  
  getChat: jest.fn().mockImplementation((chatId) => {
    return Promise.resolve({
      success: true,
      data: {
        id: chatId || 'mock-chat-id',
        title: 'Mock Chat',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
  }),
  
  // Chat creation and updates
  createChat: jest.fn().mockImplementation((data) => {
    return Promise.resolve({
      success: true,
      data: {
        id: 'new-mock-chat-id',
        title: data?.title || 'New Chat',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data
      }
    });
  }),
  
  updateChat: jest.fn().mockImplementation((chatId, data) => {
    return Promise.resolve({
      success: true,
      data: {
        id: chatId || 'mock-chat-id',
        ...data,
        updatedAt: new Date().toISOString()
      }
    });
  }),
  
  deleteChat: jest.fn().mockResolvedValue({
    success: true
  }),
  
  // Message methods
  sendMessage: jest.fn().mockImplementation((chatId, message) => {
    return Promise.resolve({
      success: true,
      data: {
        id: 'mock-message-id',
        content: message.content,
        role: message.role || 'user',
        chatId: chatId,
        createdAt: new Date().toISOString()
      }
    });
  }),
  
  streamMessage: jest.fn().mockImplementation((chatId, message, onChunk) => {
    // Simulate streaming with a timeout
    setTimeout(() => {
      if (onChunk) {
        onChunk({ content: 'Streaming ', done: false });
        setTimeout(() => {
          onChunk({ content: 'response ', done: false });
          setTimeout(() => {
            onChunk({ content: 'complete', done: true });
          }, 10);
        }, 10);
      }
    }, 10);
    
    return {
      cancel: jest.fn()
    };
  }),
  
  // Chat history and management
  clearChatHistory: jest.fn().mockResolvedValue({
    success: true
  }),
  
  exportChat: jest.fn().mockResolvedValue({
    success: true,
    data: {
      url: 'mock-export-url',
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    }
  }),
  
  importChat: jest.fn().mockResolvedValue({
    success: true,
    data: {
      id: 'imported-chat-id',
      title: 'Imported Chat',
      messages: []
    }
  }),
  
  // Reset all mocks for testing
  __resetAllMocks: () => {
    Object.keys(chatsService).forEach(key => {
      if (typeof chatsService[key] === 'function' && chatsService[key].mockClear) {
        chatsService[key].mockClear();
      }
    });
  }
};

export default chatsService;