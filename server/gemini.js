const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;

// Primary and fallback models
const PRIMARY_MODEL = 'gemini-1.5-flash-001';
const FALLBACK_MODEL = 'gemini-pro';

const initializeGemini = (apiKey) => {
    genAI = new GoogleGenerativeAI(apiKey);
};

const getWorkingModel = async (prompt) => {
    if (!genAI) throw new Error('Gemini API not initialized.');

    // Try Primary Model
    try {
        const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
        return { model, modelName: PRIMARY_MODEL };
    } catch (error) {
        console.warn(`Failed to init primary model ${PRIMARY_MODEL}:`, error);
        // Fallback
        const model = genAI.getGenerativeModel({ model: FALLBACK_MODEL });
        return { model, modelName: FALLBACK_MODEL };
    }
};

const generateTweet = async (subject, extraInfo, previousTweets = []) => {
    if (!genAI) {
        throw new Error('Gemini API not initialized. Please set up your API key.');
    }

    // Build context
    const previousContext = previousTweets.length > 0
        ? `\n\nAvoid repeating these recent tweets:\n${previousTweets.slice(0, 5).map(t => `- ${t}`).join('\n')}`
        : '';

    const prompt = `You are a social media expert creating engaging Twitter/X posts. Generate ONE tweet about the following topic.

Topic: ${subject}
${extraInfo ? `Additional context: ${extraInfo}` : ''}
${previousContext}

Requirements:
- Maximum 200 characters (to leave room for hashtags)
- Engaging and conversational tone
- No hashtags (they will be added separately)
- No emojis unless specifically requested
- Varied style - sometimes a question, sometimes a statement, sometimes a tip
- Natural and human-like, not robotic or overly promotional
- Do not include quotation marks around the tweet

Respond with ONLY the tweet text, nothing else.`;

    // Attempt generation with Primary, then Fallback
    try {
        const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return cleanTweet(response.text());
    } catch (primaryError) {
        console.warn(`Primary model (${PRIMARY_MODEL}) failed, trying fallback (${FALLBACK_MODEL}). Error:`, primaryError.message);

        try {
            const fallbackModel = genAI.getGenerativeModel({ model: FALLBACK_MODEL });
            const result = await fallbackModel.generateContent(prompt);
            const response = await result.response;
            return cleanTweet(response.text());
        } catch (fallbackError) {
            console.error('Gemini API Fallback error:', fallbackError);
            throw new Error(`Failed to generate tweet with both models. Primary: ${primaryError.message}. Fallback: ${fallbackError.message}`);
        }
    }
};

const cleanTweet = (text) => {
    let tweet = text.trim();
    // Remove any quotes if present
    tweet = tweet.replace(/^["']|["']$/g, '');
    // Ensure it's not too long
    if (tweet.length > 200) {
        tweet = tweet.substring(0, 197) + '...';
    }
    return tweet;
};

const validateApiKey = async (apiKey) => {
    try {
        // DIAGNOSTIC: List available models to debug 404 errors
        // This runs a raw HTTP request to see exactly what the key can access
        console.log('--- DIAGNOSTIC: Testing API Key capabilities ---');
        try {
            const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            const listResponse = await fetch(listModelsUrl);
            const listData = await listResponse.json();

            if (listData.models) {
                console.log('✅ AVAILABLE MODELS FOR THIS KEY:');
                console.log(listData.models.map(m => m.name).join(', '));
            } else {
                console.error('❌ FAILED TO LIST MODELS. Response:', JSON.stringify(listData));
            }
        } catch (listError) {
            console.error('❌ EXCEPTION listing models:', listError.message);
        }
        console.log('------------------------------------------------');

        const testAI = new GoogleGenerativeAI(apiKey);

        // Try Primary
        try {
            const testModel = testAI.getGenerativeModel({ model: PRIMARY_MODEL });
            await testModel.generateContent('test');
            return { valid: true };
        } catch (e) {
            console.warn(`Validation: ${PRIMARY_MODEL} failed, trying ${FALLBACK_MODEL}`);
            // Try Fallback
            const fallbackModel = testAI.getGenerativeModel({ model: FALLBACK_MODEL });
            await fallbackModel.generateContent('test');
            return { valid: true };
        }

    } catch (error) {
        console.error('Gemini Validation Error:', error);
        return { valid: false, error: error.message };
    }
};

module.exports = {
    initializeGemini,
    generateTweet,
    validateApiKey
};
