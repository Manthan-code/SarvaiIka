interface ChatMessage {
  id: string;
  chat_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tokens?: number;
  model_used?: string;
  parent_message_id?: string;
  metadata?: Record<string, unknown>;
}

interface ChatHistoryDB {
  messages: ChatMessage[];
  chats: {
    id: string;
    title: string;
    created_at: string;
    last_message_at: string;
    message_count: number;
  }[];
}

class ChatHistoryStorage {
  private dbName = 'ChatHistoryDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Messages store with compound indexes
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('chat_id', 'chat_id', { unique: false });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
          messageStore.createIndex('chat_timestamp', ['chat_id', 'timestamp'], { unique: false });
          messageStore.createIndex('user_id', 'user_id', { unique: false });
        }

        // Chat metadata store
        if (!db.objectStoreNames.contains('chats')) {
          const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
          chatStore.createIndex('last_message_at', 'last_message_at', { unique: false });
          chatStore.createIndex('user_id', 'user_id', { unique: false });
        }

        // Storage metadata for cleanup
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  async getMessages(chatId: string, limit: number = 30, offset: number = 0): Promise<ChatMessage[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('chat_timestamp');
      
      const range = IDBKeyRange.bound([chatId, ''], [chatId, '\uffff']);
      const request = index.openCursor(range, 'prev'); // Get newest first
      
      const messages: ChatMessage[] = [];
      let count = 0;
      let skipped = 0;
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && count < limit) {
          if (skipped >= offset) {
            messages.push(cursor.value);
            count++;
          } else {
            skipped++;
          }
          cursor.continue();
        } else {
          resolve(messages.reverse()); // Return in chronological order
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getLatestMessages(chatId: string, limit: number = 30): Promise<ChatMessage[]> {
    return this.getMessages(chatId, limit, 0);
  }

  async getOlderMessages(chatId: string, beforeTimestamp: string, limit: number = 20): Promise<ChatMessage[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('chat_timestamp');
      
      const range = IDBKeyRange.bound([chatId, ''], [chatId, beforeTimestamp], false, true);
      const request = index.openCursor(range, 'prev');
      
      const messages: ChatMessage[] = [];
      let count = 0;
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && count < limit) {
          messages.push(cursor.value);
          count++;
          cursor.continue();
        } else {
          resolve(messages.reverse());
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async saveMessages(messages: ChatMessage[]): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      
      let completed = 0;
      const total = messages.length;
      
      if (total === 0) {
        resolve();
        return;
      }
      
      messages.forEach(message => {
        const request = store.put(message);
        request.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async saveMessage(message: ChatMessage): Promise<void> {
    return this.saveMessages([message]);
  }

  async getChatMessageCount(chatId: string): Promise<number> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('chat_id');
      
      const request = index.count(chatId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async cleanupOldMessages(maxMessagesPerChat: number = 1000): Promise<void> {
    if (!this.db) await this.init();
    
    // Get all unique chat IDs
    const chatIds = await this.getAllChatIds();
    
    for (const chatId of chatIds) {
      const messageCount = await this.getChatMessageCount(chatId);
      
      if (messageCount > maxMessagesPerChat) {
        // Keep only the latest messages
        const messagesToDelete = messageCount - maxMessagesPerChat;
        await this.deleteOldestMessages(chatId, messagesToDelete);
      }
    }
  }

  private async getAllChatIds(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('chat_id');
      
      const chatIds = new Set<string>();
      const request = index.openKeyCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          chatIds.add(cursor.key as string);
          cursor.continue();
        } else {
          resolve(Array.from(chatIds));
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteOldestMessages(chatId: string, count: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const index = store.index('chat_timestamp');
      
      const range = IDBKeyRange.bound([chatId, ''], [chatId, '\uffff']);
      const request = index.openCursor(range); // Oldest first
      
      let deleted = 0;
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && deleted < count) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageSize(): Promise<{ messages: number; totalSize: number }> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      
      const request = store.count();
      request.onsuccess = () => {
        const messageCount = request.result;
        // Estimate size (rough calculation)
        const estimatedSize = messageCount * 1024; // ~1KB per message average
        resolve({ messages: messageCount, totalSize: estimatedSize });
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
export const chatHistoryStorage = new ChatHistoryStorage();

// Initialize on module load
chatHistoryStorage.init().catch(console.error);

export default chatHistoryStorage;