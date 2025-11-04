// === Vector Service (RAG Logic) ===
// File: backend/src/services/vectorService.js

const qdrant = require('../db/qdrant/client.js');
const OpenAI = require('openai');
const dotenv = require('dotenv');

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Name of your Qdrant collection
const COLLECTION_NAME = 'chat_vectors';

// --- Helper: Embed text using OpenAI ---
const embedText = async (text) => {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // or 3-large
      input: text,
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error('Error creating embedding:', err);
  }
};

// --- Create collection if it doesn't exist ---
const initCollection = async () => {
  await qdrant.collections.create({
    collection_name: COLLECTION_NAME,
    vectors: { size: 1536, distance: 'Cosine' }, // same size as embedding
  }).catch((err) => {
    if (err.response?.status === 409) {
      console.log(`Collection "${COLLECTION_NAME}" already exists.`);
    } else {
      console.error('Error creating collection:', err);
    }
  });
};
const generateChatResponse = async ({ message, modelName, context = '' }) => {
  // 1. Search for relevant vectors
  const results = await searchTextVector(message, 5);

  // 2. Extract context from results
  const contextText = results.map(r => r.payload.text).join('\n');
  const combinedContext = [context, contextText].filter(Boolean).join('\n');

  // 3. Call OpenAI to generate a response
  const response = await openai.chat.completions.create({
    model: modelName || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: `${message}\n\nContext:\n${combinedContext}` },
    ],
  });

  return response.choices[0].message.content;
};
// --- Add a vector to Qdrant ---
const addTextVector = async (text, metadata = {}) => {
  const vector = await embedText(text);
  if (!vector) return null;

  const result = await qdrant.points.upsert({
    collection_name: COLLECTION_NAME,
    points: [
      {
        id: Date.now(), // simple unique ID
        vector,
        payload: metadata,
      },
    ],
  });
  return result;
};

// --- Search vectors in Qdrant ---
const searchTextVector = async (query, top = 5) => {
  const vector = await embedText(query);
  if (!vector) return [];

  const result = await qdrant.points.search({
    collection_name: COLLECTION_NAME,
    vector,
    limit: top,
  });

  return result;
};

module.exports = {
  embedText,
  initCollection,
  generateChatResponse,
  addTextVector,
  searchTextVector
};
