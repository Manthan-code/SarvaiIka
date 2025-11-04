import { apiClient } from '../utils/apiClient';

const chatsService = {
    // Get user's chat sessions with cursor-based pagination
    getChatSessions: async (params = {}) => {
        const { limit = 10, cursor, direction = 'next', _t, force, ...otherParams } = params;
        
        const queryParams = new URLSearchParams({
            limit: limit.toString(),
            ...(cursor ? { cursor, direction } : {}),
            ...otherParams,
            ...(_t ? { _t } : {}),
            ...(force ? { force: 'true' } : {})
        });
        
        return apiClient.get(`/api/chat/sessions?${queryParams}`, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            context: 'Get chat sessions'
        });
    },
    
    // Get specific chat session with messages - UPDATED ENDPOINT
    getChatSession: async (sessionId) => {
        if (!sessionId) {
            throw new Error('Session ID is required');
        }
        
        return apiClient.get(`/api/chat/${sessionId}`, {
            context: `Get chat session ${sessionId}`
        });
    },
    
    // Delete a chat session - UPDATED ENDPOINT
    deleteChatSession: async (sessionId) => {
        if (!sessionId) {
            throw new Error('Session ID is required');
        }
        
        return apiClient.delete(`/api/chat/${sessionId}`, {
            context: `Delete chat session ${sessionId}`
        });
    },

    // Update a chat session (e.g., rename title)
    updateChatSession: async (sessionId, data = {}) => {
        if (!sessionId) {
            throw new Error('Session ID is required');
        }
        if (!data || typeof data !== 'object') {
            throw new Error('Update data must be an object');
        }

        return apiClient.patch(`/api/chat/${sessionId}`, data, {
            context: `Update chat session ${sessionId}`
        });
    },
    
    // Get chat history (most recent session with messages)
    getChatHistory: async (params = {}) => {
        const { limit = 10, cursor, direction = 'next' } = params;
        
        const queryParams = new URLSearchParams({
            limit: limit.toString(),
            ...(cursor ? { cursor, direction } : {})
        });
        
        return apiClient.get(`/api/chat/history?${queryParams}`, {
            context: 'Get chat history'
        });
    },
    
    // Get chats with cursor-based pagination
    getChats: async (params = {}) => {
        const { limit = 20, cursor, direction = 'next', ...otherParams } = params;
        
        const queryParams = new URLSearchParams({
            limit: limit.toString(),
            ...(cursor ? { cursor, direction } : {}),
            ...otherParams
        });
        
        return apiClient.get(`/api/chats${queryParams.toString() ? `?${queryParams}` : ''}`, {
            context: 'Get chats with cursor pagination'
        });
    },
    
    // Create a shared snapshot of a chat and return shareId + URL
    createSharedChat: async (chatId) => {
        if (!chatId) throw new Error('Chat ID is required');
        return apiClient.post(`/api/share/chat/${chatId}`, {}, {
            context: `Create shared chat for ${chatId}`
        });
    },
    
    // Fetch a shared chat by shareId (public)
    getSharedChat: async (shareId) => {
        if (!shareId) throw new Error('Share ID is required');
        return apiClient.get(`/api/share/${shareId}`, {
            context: `Get shared chat ${shareId}`
        });
    },

    // Fork a shared chat into a new personal chat
    forkSharedChat: async (shareId) => {
        if (!shareId) throw new Error('Share ID is required');
        return apiClient.post(`/api/share/fork/${shareId}`, {}, {
            context: `Fork shared chat ${shareId}`
        });
    },
};

export default chatsService;
