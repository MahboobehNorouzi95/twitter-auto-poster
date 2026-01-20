const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;

const initializeGemini = (apiKey) => {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
};

const generateTweet = async (subject, extraInfo, previousTweets = []) => {
    if (!model) {
        throw new Error('Gemini API not initialized. Please set up your API key.');
    }

    // Build context from previous tweets to avoid repetition
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

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let tweet = response.text().trim();

        // Remove any quotes if present
        tweet = tweet.replace(/^["']|["']$/g, '');

        // Ensure it's not too long
        if (tweet.length > 200) {
            tweet = tweet.substring(0, 197) + '...';
        }

        return tweet;
    } catch (error) {
        console.error('Gemini API error:', error);
        throw new Error(`Failed to generate tweet: ${error.message}`);
    }
};

const validateApiKey = async (apiKey) => {
    try {
        const testAI = new GoogleGenerativeAI(apiKey);
        const testModel = testAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        await testModel.generateContent('Say "test" in one word.');
        return { valid: true };
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
