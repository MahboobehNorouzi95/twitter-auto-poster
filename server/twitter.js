const { TwitterApi } = require('twitter-api-v2');

let twitterClient = null;

const initializeTwitter = (credentials) => {
    twitterClient = new TwitterApi({
        appKey: credentials.twitterApiKey,
        appSecret: credentials.twitterApiSecret,
        accessToken: credentials.twitterAccessToken,
        accessSecret: credentials.twitterAccessSecret,
    });

    return twitterClient;
};

const postTweet = async (tweetText) => {
    if (!twitterClient) {
        throw new Error('Twitter client not initialized. Please set up your credentials.');
    }

    try {
        // DIAGNOSTIC: Check who we are posting as
        const me = await twitterClient.v2.me();
        console.log(`[Twitter] Posting as user: @${me.data.username} (${me.data.id})`);

        const result = await twitterClient.v2.tweet(tweetText);

        console.log(`[Twitter] API Response:`, JSON.stringify(result));

        return {
            success: true,
            tweetId: result.data.id,
            text: result.data.text,
            username: me.data.username
        };
    } catch (error) {
        console.error('Twitter API error:', error);

        // Handle specific error types
        if (error.code === 403) {
            throw new Error('Twitter API access denied. Please check your app permissions (need Read and Write).');
        } else if (error.code === 429) {
            throw new Error('Twitter API rate limit exceeded. Please wait before posting again.');
        } else if (error.code === 401) {
            throw new Error('Twitter authentication failed. Please check your credentials.');
        }

        throw new Error(`Failed to post tweet: ${error.message}`);
    }
};

const validateCredentials = async (credentials) => {
    try {
        const client = new TwitterApi({
            appKey: credentials.twitterApiKey,
            appSecret: credentials.twitterApiSecret,
            accessToken: credentials.twitterAccessToken,
            accessSecret: credentials.twitterAccessSecret,
        });

        // Try to get user info to validate credentials
        const me = await client.v2.me();

        return {
            valid: true,
            username: me.data.username,
            name: me.data.name
        };
    } catch (error) {
        console.error('Twitter validation error:', error);
        return {
            valid: false,
            error: error.message || 'Invalid credentials'
        };
    }
};

const getClient = () => twitterClient;

module.exports = {
    initializeTwitter,
    postTweet,
    validateCredentials,
    getClient
};
