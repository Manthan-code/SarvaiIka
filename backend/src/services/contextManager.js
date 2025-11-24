const logger = require('../config/logger');
const enhancedQdrantService = require('./enhancedQdrantService');
const conversationManager = require('./conversationManager');

class ContextManager {
    constructor() {
        // Configuration
        this.config = {
            maxTokens: 4000, // Safe buffer for most models
            rollingWindowSize: 6, // Keep last 6 messages (3 user, 3 assistant)
            summaryTriggerCount: 6, // Summarize every 6 messages
            ragResultsCount: 5, // Fetch top-5 vectors
            charsPerToken: 4 // Rough estimation
        };
    }

    /**
     * Main entry point to construct the context for the LLM
     */
    async constructContext(userId, sessionId, currentMessage, model) {
        try {
            // 1. Fetch full conversation history
            const conversation = await conversationManager.getConversation(sessionId, userId);
            const allMessages = conversation.messages || [];

            // 2. Get Rolling Window (Short-term memory)
            const rollingWindow = this.getRollingWindow(allMessages);

            // 3. Get or Generate Summary (Long-term compressed memory)
            // Pass the existing DB summary to the generator
            const summary = await this.getOrGenerateSummary(userId, sessionId, allMessages, conversation.summary);

            // 4. RAG Retrieval (Episodic memory)
            const ragContext = await this.getRelevantHistory(userId, currentMessage);

            // 5. Assemble final context
            let finalMessages = [];
            let contextInstructions = '';

            if (summary) {
                contextInstructions += `\n\nPrevious conversation summary: ${summary}`;
            }

            if (ragContext) {
                contextInstructions += `\n\nRelevant past details: ${ragContext}`;
            }

            // Add rolling window messages
            finalMessages = [...rollingWindow];

            // 6. Enforce Token Limit (Safety net)
            finalMessages = this.enforceTokenLimit(finalMessages, this.config.maxTokens);

            logger.info('[ContextManager] Context constructed', {
                totalMessages: allMessages.length,
                windowSize: finalMessages.length,
                hasSummary: !!summary,
                hasRAG: !!ragContext
            });

            return {
                messages: finalMessages,
                contextInstructions
            };

        } catch (error) {
            logger.error('[ContextManager] Failed to construct context:', error);
            // Fallback: return last few messages
            return {
                messages: this.getRollingWindow(await conversationManager.getConversation(sessionId, userId).then(c => c.messages || [])),
                contextInstructions: ''
            };
        }
    }

    /**
     * Get the last N messages (Rolling Window)
     */
    getRollingWindow(messages) {
        if (!messages || messages.length === 0) return [];
        // Filter out system messages if any
        const chatMessages = messages.filter(m => m.role !== 'system');
        return chatMessages.slice(-this.config.rollingWindowSize);
    }

    /**
     * Retrieve relevant past messages using Vector Search (RAG)
     */
    async getRelevantHistory(userId, query) {
        try {
            if (!query) return null;

            // Use enhancedQdrantService to find similar past queries/contexts
            const similarQueries = await enhancedQdrantService.searchSimilarQueries(userId, query, this.config.ragResultsCount);

            if (!similarQueries || similarQueries.length === 0) {
                return null;
            }

            return similarQueries.map(q => `Q: ${q.query}\nA: ${q.context?.response || ''}`).join('\n\n');
        } catch (error) {
            logger.error('[ContextManager] Failed to get relevant history:', error);
            return null;
        }
    }

    /**
     * Get or generate a summary of the conversation (Incremental)
     */
    async getOrGenerateSummary(userId, sessionId, messages, currentSummary) {
        try {
            // Trigger every 6 messages
            const shouldSummarize = messages && messages.length > 0 && messages.length % this.config.summaryTriggerCount === 0;

            if (shouldSummarize) {
                logger.info(`[ContextManager] Triggering incremental summary for session ${sessionId} at ${messages.length} messages`);

                // Get last 6 messages
                const recentMessages = messages.slice(-this.config.summaryTriggerCount);
                const recentText = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');

                // Construct prompt
                const prompt = `You are a helpful assistant that summarizes conversation progress.
Update the following summary with the new messages provided.
Keep the summary concise, focusing on key facts, user preferences, and decisions.
Do NOT output "Here is the summary" or similar. Just the summary text.

Old Summary:
${currentSummary || 'None'}

New Messages:
${recentText}

Updated Summary:`;

                // Call LLM (using a cheap model for summarization)
                // We use dynamic require to avoid circular dependency issues at module load time
                const chatService = require('./chatService');
                const completion = await chatService.generateChatResponse(prompt);

                const newSummary = completion.trim();

                if (newSummary && newSummary.length > 0) {
                    // Save to DB
                    await conversationManager.updateSummary(sessionId, newSummary);
                    return newSummary;
                }
            }

            return currentSummary || null;
        } catch (error) {
            logger.warn('[ContextManager] Failed to generate summary:', error);
            return currentSummary || null;
        }
    }

    /**
     * Estimate token count (rough approximation)
     */
    estimateTokens(text) {
        if (!text) return 0;
        return Math.ceil(text.length / this.config.charsPerToken);
    }

    /**
     * Enforce token limit by dropping oldest messages if necessary
     */
    enforceTokenLimit(messages, maxTokens) {
        let currentTokens = 0;
        const keptMessages = [];

        // Process from newest to oldest
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const content = msg.content || '';
            const tokens = this.estimateTokens(content);

            if (currentTokens + tokens > maxTokens) {
                break;
            }

            currentTokens += tokens;
            keptMessages.unshift(msg);
        }

        return keptMessages;
    }
}

module.exports = new ContextManager();
