/**
 * Represents a chat session between the user and the AI.
 */
class ChatSession {
  constructor({ id, userId, messages, modelUsed, createdAt }) {
    this.id = id;
    this.userId = userId;
    this.messages = messages || []; // [{ role: 'user', content: '...' }]
    this.modelUsed = modelUsed || 'gemini-1.5-flash-latest';
    this.createdAt = createdAt || new Date().toISOString();
  }
}

module.exports = ChatSession;