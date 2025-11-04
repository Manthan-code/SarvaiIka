/**
 * Data Models Unit Tests
 * Comprehensive tests for ChatSession and User models with validation logic
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const ChatSession = require('../src/models/ChatSession');
const User = require('../src/models/User');

describe('Data Models Unit Tests', () => {
  describe('ChatSession Model', () => {
    describe('Constructor', () => {
      it('should create ChatSession with all provided properties', () => {
        const sessionData = {
          id: 'session-123',
          userId: 'user-456',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
          ],
          modelUsed: 'gpt-4',
          createdAt: '2024-01-15T10:30:00Z'
        };
        
        const session = new ChatSession(sessionData);
        
        expect(session.id).toBe('session-123');
        expect(session.userId).toBe('user-456');
        expect(session.messages).toEqual(sessionData.messages);
        expect(session.modelUsed).toBe('gpt-4');
        expect(session.createdAt).toBe('2024-01-15T10:30:00Z');
      });

      it('should create ChatSession with minimal required properties', () => {
        const sessionData = {
          id: 'session-123',
          userId: 'user-456'
        };
        
        const session = new ChatSession(sessionData);
        
        expect(session.id).toBe('session-123');
        expect(session.userId).toBe('user-456');
        expect(session.messages).toEqual([]);
        expect(session.modelUsed).toBe('gpt-3.5');
        expect(session.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('should use default values for optional properties', () => {
        const session = new ChatSession({ id: 'test', userId: 'user' });
        
        expect(session.messages).toEqual([]);
        expect(session.modelUsed).toBe('gpt-3.5');
        expect(typeof session.createdAt).toBe('string');
        expect(new Date(session.createdAt)).toBeInstanceOf(Date);
      });

      it('should handle empty messages array', () => {
        const session = new ChatSession({
          id: 'test',
          userId: 'user',
          messages: []
        });
        
        expect(session.messages).toEqual([]);
        expect(Array.isArray(session.messages)).toBe(true);
      });

      it('should handle null messages', () => {
        const session = new ChatSession({
          id: 'test',
          userId: 'user',
          messages: null
        });
        
        expect(session.messages).toEqual([]);
      });

      it('should handle undefined messages', () => {
        const session = new ChatSession({
          id: 'test',
          userId: 'user',
          messages: undefined
        });
        
        expect(session.messages).toEqual([]);
      });

      it('should preserve complex message objects', () => {
        const complexMessages = [
          {
            role: 'user',
            content: 'Complex question with code: ```js\nconsole.log("hello");\n```',
            timestamp: '2024-01-15T10:30:00Z',
            metadata: { tokens: 25 }
          },
          {
            role: 'assistant',
            content: 'Here\'s the explanation...',
            timestamp: '2024-01-15T10:31:00Z',
            metadata: { tokens: 150, model: 'gpt-4' }
          }
        ];
        
        const session = new ChatSession({
          id: 'test',
          userId: 'user',
          messages: complexMessages
        });
        
        expect(session.messages).toEqual(complexMessages);
        expect(session.messages[0].metadata.tokens).toBe(25);
        expect(session.messages[1].metadata.model).toBe('gpt-4');
      });

      it('should handle different model names', () => {
        const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet', 'dall-e-3'];
        
        models.forEach(model => {
          const session = new ChatSession({
            id: 'test',
            userId: 'user',
            modelUsed: model
          });
          
          expect(session.modelUsed).toBe(model);
        });
      });

      it('should handle null modelUsed', () => {
        const session = new ChatSession({
          id: 'test',
          userId: 'user',
          modelUsed: null
        });
        
        expect(session.modelUsed).toBe('gpt-3.5');
      });

      it('should handle undefined modelUsed', () => {
        const session = new ChatSession({
          id: 'test',
          userId: 'user',
          modelUsed: undefined
        });
        
        expect(session.modelUsed).toBe('gpt-3.5');
      });

      it('should handle null createdAt', () => {
        const session = new ChatSession({
          id: 'test',
          userId: 'user',
          createdAt: null
        });
        
        expect(typeof session.createdAt).toBe('string');
        expect(new Date(session.createdAt)).toBeInstanceOf(Date);
      });

      it('should handle undefined createdAt', () => {
        const session = new ChatSession({
          id: 'test',
          userId: 'user',
          createdAt: undefined
        });
        
        expect(typeof session.createdAt).toBe('string');
        expect(new Date(session.createdAt)).toBeInstanceOf(Date);
      });

      it('should preserve custom createdAt format', () => {
        const customDate = '2023-12-25T00:00:00.000Z';
        const session = new ChatSession({
          id: 'test',
          userId: 'user',
          createdAt: customDate
        });
        
        expect(session.createdAt).toBe(customDate);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty constructor object', () => {
        const session = new ChatSession({});
        
        expect(session.id).toBeUndefined();
        expect(session.userId).toBeUndefined();
        expect(session.messages).toEqual([]);
        expect(session.modelUsed).toBe('gpt-3.5');
        expect(typeof session.createdAt).toBe('string');
      });

      it('should handle very long message content', () => {
        const longContent = 'A'.repeat(10000);
        const session = new ChatSession({
          id: 'test',
          userId: 'user',
          messages: [{ role: 'user', content: longContent }]
        });
        
        expect(session.messages[0].content).toBe(longContent);
        expect(session.messages[0].content.length).toBe(10000);
      });

      it('should handle special characters in content', () => {
        const specialContent = '🚀 Hello! @#$%^&*()_+ 中文 العربية 🎉';
        const session = new ChatSession({
          id: 'test',
          userId: 'user',
          messages: [{ role: 'user', content: specialContent }]
        });
        
        expect(session.messages[0].content).toBe(specialContent);
      });

      it('should handle large number of messages', () => {
        const manyMessages = Array.from({ length: 1000 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i + 1}`
        }));
        
        const session = new ChatSession({
          id: 'test',
          userId: 'user',
          messages: manyMessages
        });
        
        expect(session.messages.length).toBe(1000);
        expect(session.messages[0].content).toBe('Message 1');
        expect(session.messages[999].content).toBe('Message 1000');
      });

      it('should handle numeric IDs', () => {
        const session = new ChatSession({
          id: 12345,
          userId: 67890
        });
        
        expect(session.id).toBe(12345);
        expect(session.userId).toBe(67890);
      });

      it('should handle boolean values', () => {
        const session = new ChatSession({
          id: true,
          userId: false
        });
        
        expect(session.id).toBe(true);
        expect(session.userId).toBe(false);
      });
    });

    describe('Message Validation', () => {
      it('should handle messages with all valid roles', () => {
        const validRoles = ['user', 'assistant', 'system'];
        const messages = validRoles.map(role => ({ role, content: `${role} message` }));
        
        const session = new ChatSession({
          id: 'test',
          userId: 'user',
          messages
        });
        
        expect(session.messages.length).toBe(3);
        validRoles.forEach((role, index) => {
          expect(session.messages[index].role).toBe(role);
        });
      });

      it('should preserve message structure with additional properties', () => {
        const messages = [
          {
            role: 'user',
            content: 'Hello',
            timestamp: '2024-01-15T10:30:00Z',
            id: 'msg-1',
            tokens: 5
          }
        ];
        
        const session = new ChatSession({
          id: 'test',
          userId: 'user',
          messages
        });
        
        expect(session.messages[0]).toEqual(messages[0]);
        expect(session.messages[0].timestamp).toBe('2024-01-15T10:30:00Z');
        expect(session.messages[0].id).toBe('msg-1');
        expect(session.messages[0].tokens).toBe(5);
      });
    });
  });

  describe('User Model', () => {
    describe('Constructor', () => {
      it('should create User with all provided properties', () => {
        const userData = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'premium',
          subscriptionPlan: 'pro',
          createdAt: '2024-01-15T10:30:00Z'
        };
        
        const user = new User(userData);
        
        expect(user.id).toBe('user-123');
        expect(user.email).toBe('test@example.com');
        expect(user.role).toBe('premium');
        expect(user.subscriptionPlan).toBe('pro');
        expect(user.createdAt).toBe('2024-01-15T10:30:00Z');
      });

      it('should create User with minimal required properties', () => {
        const userData = {
          id: 'user-123',
          email: 'test@example.com'
        };
        
        const user = new User(userData);
        
        expect(user.id).toBe('user-123');
        expect(user.email).toBe('test@example.com');
        expect(user.role).toBe('free');
        expect(user.subscriptionPlan).toBeNull();
        expect(user.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('should use default values for optional properties', () => {
        const user = new User({ id: 'test', email: 'test@example.com' });
        
        expect(user.role).toBe('free');
        expect(user.subscriptionPlan).toBeNull();
        expect(typeof user.createdAt).toBe('string');
        expect(new Date(user.createdAt)).toBeInstanceOf(Date);
      });

      it('should handle different role values', () => {
        const roles = ['free', 'premium', 'admin', 'moderator'];
        
        roles.forEach(role => {
          const user = new User({
            id: 'test',
            email: 'test@example.com',
            role
          });
          
          expect(user.role).toBe(role);
        });
      });

      it('should handle different subscription plans', () => {
        const plans = ['free', 'plus', 'pro', 'enterprise'];
        
        plans.forEach(plan => {
          const user = new User({
            id: 'test',
            email: 'test@example.com',
            subscriptionPlan: plan
          });
          
          expect(user.subscriptionPlan).toBe(plan);
        });
      });

      it('should handle null role', () => {
        const user = new User({
          id: 'test',
          email: 'test@example.com',
          role: null
        });
        
        expect(user.role).toBe('free');
      });

      it('should handle undefined role', () => {
        const user = new User({
          id: 'test',
          email: 'test@example.com',
          role: undefined
        });
        
        expect(user.role).toBe('free');
      });

      it('should handle null subscriptionPlan', () => {
        const user = new User({
          id: 'test',
          email: 'test@example.com',
          subscriptionPlan: null
        });
        
        expect(user.subscriptionPlan).toBeNull();
      });

      it('should handle undefined subscriptionPlan', () => {
        const user = new User({
          id: 'test',
          email: 'test@example.com',
          subscriptionPlan: undefined
        });
        
        expect(user.subscriptionPlan).toBeNull();
      });

      it('should handle null createdAt', () => {
        const user = new User({
          id: 'test',
          email: 'test@example.com',
          createdAt: null
        });
        
        expect(typeof user.createdAt).toBe('string');
        expect(new Date(user.createdAt)).toBeInstanceOf(Date);
      });

      it('should handle undefined createdAt', () => {
        const user = new User({
          id: 'test',
          email: 'test@example.com',
          createdAt: undefined
        });
        
        expect(typeof user.createdAt).toBe('string');
        expect(new Date(user.createdAt)).toBeInstanceOf(Date);
      });

      it('should preserve custom createdAt format', () => {
        const customDate = '2023-12-25T00:00:00.000Z';
        const user = new User({
          id: 'test',
          email: 'test@example.com',
          createdAt: customDate
        });
        
        expect(user.createdAt).toBe(customDate);
      });
    });

    describe('Email Validation Scenarios', () => {
      it('should handle various valid email formats', () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'user+tag@example.org',
          'user123@test-domain.com',
          'a@b.co'
        ];
        
        validEmails.forEach(email => {
          const user = new User({
            id: 'test',
            email
          });
          
          expect(user.email).toBe(email);
        });
      });

      it('should handle email with special characters', () => {
        const specialEmails = [
          'user+test@example.com',
          'user.name+tag@example.com',
          'user_name@example.com',
          'user-name@example.com'
        ];
        
        specialEmails.forEach(email => {
          const user = new User({
            id: 'test',
            email
          });
          
          expect(user.email).toBe(email);
        });
      });

      it('should preserve email case sensitivity', () => {
        const email = 'Test.User@Example.COM';
        const user = new User({
          id: 'test',
          email
        });
        
        expect(user.email).toBe(email);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty constructor object', () => {
        const user = new User({});
        
        expect(user.id).toBeUndefined();
        expect(user.email).toBeUndefined();
        expect(user.role).toBe('free');
        expect(user.subscriptionPlan).toBeNull();
        expect(typeof user.createdAt).toBe('string');
      });

      it('should handle numeric IDs', () => {
        const user = new User({
          id: 12345,
          email: 'test@example.com'
        });
        
        expect(user.id).toBe(12345);
      });

      it('should handle UUID format IDs', () => {
        const uuid = '550e8400-e29b-41d4-a716-446655440000';
        const user = new User({
          id: uuid,
          email: 'test@example.com'
        });
        
        expect(user.id).toBe(uuid);
      });

      it('should handle very long email addresses', () => {
        const longEmail = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com';
        const user = new User({
          id: 'test',
          email: longEmail
        });
        
        expect(user.email).toBe(longEmail);
      });

      it('should handle empty string values', () => {
        const user = new User({
          id: '',
          email: '',
          role: '',
          subscriptionPlan: ''
        });
        
        expect(user.id).toBe('');
        expect(user.email).toBe('');
        expect(user.role).toBe('free'); // Should default to 'free' for falsy values
        expect(user.subscriptionPlan).toBeNull(); // Should default to null for falsy values
      });

      it('should handle boolean values', () => {
        const user = new User({
          id: true,
          email: false
        });
        
        expect(user.id).toBe(true);
        expect(user.email).toBe(false);
      });
    });
  });

  describe('Model Integration', () => {
    it('should create User and ChatSession with related data', () => {
      const userId = 'user-123';
      
      const user = new User({
        id: userId,
        email: 'test@example.com',
        role: 'premium'
      });
      
      const session = new ChatSession({
        id: 'session-456',
        userId: userId,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ]
      });
      
      expect(user.id).toBe(session.userId);
      expect(user.role).toBe('premium');
      expect(session.messages.length).toBe(2);
    });

    it('should handle multiple chat sessions for one user', () => {
      const userId = 'user-123';
      
      const user = new User({
        id: userId,
        email: 'test@example.com'
      });
      
      const sessions = Array.from({ length: 5 }, (_, i) => new ChatSession({
        id: `session-${i + 1}`,
        userId: userId,
        messages: [{ role: 'user', content: `Message ${i + 1}` }]
      }));
      
      sessions.forEach(session => {
        expect(session.userId).toBe(user.id);
      });
      
      expect(sessions.length).toBe(5);
    });
  });

  describe('Performance Tests', () => {
    it('should create ChatSession quickly with large message history', () => {
      const largeMessages = Array.from({ length: 1000 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        timestamp: new Date().toISOString()
      }));
      
      const startTime = Date.now();
      const session = new ChatSession({
        id: 'test',
        userId: 'user',
        messages: largeMessages
      });
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
      expect(session.messages.length).toBe(1000);
    });

    it('should create User quickly', () => {
      const startTime = Date.now();
      const user = new User({
        id: 'test',
        email: 'test@example.com',
        role: 'premium',
        subscriptionPlan: 'pro'
      });
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(10); // Should complete within 10ms
      expect(user.id).toBe('test');
    });

    it('should handle rapid model creation', () => {
      const startTime = Date.now();
      
      const users = Array.from({ length: 100 }, (_, i) => new User({
        id: `user-${i}`,
        email: `user${i}@example.com`
      }));
      
      const sessions = Array.from({ length: 100 }, (_, i) => new ChatSession({
        id: `session-${i}`,
        userId: `user-${i}`
      }));
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(users.length).toBe(100);
      expect(sessions.length).toBe(100);
    });
  });
});