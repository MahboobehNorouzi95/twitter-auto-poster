const cron = require('node-cron');
const database = require('./database');
const gemini = require('./gemini');
const twitter = require('./twitter');

let schedulerTask = null;
let isRunning = false;

// Select 3 random hashtags from up to 5
const selectRandomHashtags = (hashtags, count = 3) => {
    if (hashtags.length <= count) {
        return [...hashtags];
    }

    const shuffled = [...hashtags].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
};

// Get random interval in milliseconds
const getRandomInterval = (minHours, maxHours) => {
    const minMs = minHours * 60 * 60 * 1000;
    const maxMs = maxHours * 60 * 60 * 1000;
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
};

// Calculate next tweet time
const getNextTweetTime = (minHours, maxHours) => {
    const intervalMs = getRandomInterval(minHours, maxHours);
    return new Date(Date.now() + intervalMs).toISOString();
};

// Get recent tweet texts to avoid repetition
const getRecentTweetTexts = (campaignId) => {
    const history = database.getTweetHistoryByCampaign(campaignId, 10);
    return history
        .filter(t => t.status === 'posted')
        .map(t => t.tweet_text);
};

// Post a single tweet
const postTweet = async (campaign) => {
    console.log(`[Scheduler] Generating tweet for campaign: ${campaign.subject}`);

    try {
        // Get recent tweets to avoid repetition
        const recentTweets = getRecentTweetTexts(campaign.id);

        // Generate tweet content
        const tweetContent = await gemini.generateTweet(
            campaign.subject,
            campaign.extra_info,
            recentTweets
        );

        // Select 3 random hashtags
        const selectedHashtags = selectRandomHashtags(campaign.hashtags, 3);
        const hashtagString = selectedHashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');

        // Combine tweet with hashtags
        let fullTweet = `${tweetContent} ${hashtagString}`;

        // Ensure within 280 character limit
        if (fullTweet.length > 280) {
            const maxContentLength = 280 - hashtagString.length - 4; // 4 for "... " 
            fullTweet = `${tweetContent.substring(0, maxContentLength)}... ${hashtagString}`;
        }

        console.log(`[Scheduler] Posting tweet: ${fullTweet}`);

        // Post to Twitter
        const result = await twitter.postTweet(fullTweet);

        // Log success
        database.addTweetHistory({
            campaignId: campaign.id,
            tweetText: fullTweet,
            hashtagsUsed: selectedHashtags,
            twitterTweetId: result.tweetId,
            status: 'posted'
        });

        console.log(`[Scheduler] Tweet posted successfully: ${result.tweetId}`);
        return true;

    } catch (error) {
        console.error(`[Scheduler] Failed to post tweet:`, error);

        // Log failure
        database.addTweetHistory({
            campaignId: campaign.id,
            tweetText: 'Failed to generate/post',
            hashtagsUsed: [],
            status: 'failed',
            errorMessage: error.message
        });

        return false;
    }
};

// Check and process scheduled tweets
const checkScheduledTweets = async () => {
    const campaign = database.getActiveCampaign();

    if (!campaign) {
        console.log('[Scheduler] No active campaign');
        return;
    }

    // Check if campaign has expired
    const startedAt = new Date(campaign.started_at);
    const expiresAt = new Date(startedAt.getTime() + (campaign.duration_days * 24 * 60 * 60 * 1000));

    if (new Date() > expiresAt) {
        console.log(`[Scheduler] Campaign expired, stopping`);
        database.stopCampaign(campaign.id);
        return;
    }

    // Check if it's time to tweet
    if (campaign.next_tweet_at) {
        const nextTweetTime = new Date(campaign.next_tweet_at);

        if (new Date() >= nextTweetTime) {
            // Time to tweet!
            await postTweet(campaign);

            // Schedule next tweet
            const nextTime = getNextTweetTime(campaign.min_interval_hours, campaign.max_interval_hours);
            database.updateNextTweetTime(campaign.id, nextTime);
            console.log(`[Scheduler] Next tweet scheduled for: ${nextTime}`);
        }
    }
};

// Initialize the scheduler
const initializeScheduler = () => {
    if (schedulerTask) {
        console.log('[Scheduler] Already initialized');
        return;
    }

    // Check every minute for scheduled tweets
    schedulerTask = cron.schedule('* * * * *', async () => {
        if (isRunning) {
            console.log('[Scheduler] Previous check still running, skipping');
            return;
        }

        isRunning = true;
        try {
            await checkScheduledTweets();
        } catch (error) {
            console.error('[Scheduler] Error in scheduled check:', error);
        } finally {
            isRunning = false;
        }
    });

    console.log('[Scheduler] Initialized - checking every minute');
};

// Start a campaign
const startCampaign = async (campaignId) => {
    const campaign = database.getCampaign(campaignId);
    if (!campaign) {
        throw new Error('Campaign not found');
    }

    // Stop any currently running campaign
    const activeCampaign = database.getActiveCampaign();
    if (activeCampaign && activeCampaign.id !== campaignId) {
        database.stopCampaign(activeCampaign.id);
    }

    // Schedule first tweet (random time from now)
    const nextTweetTime = getNextTweetTime(campaign.min_interval_hours, campaign.max_interval_hours);
    database.startCampaign(campaignId, nextTweetTime);

    console.log(`[Scheduler] Campaign ${campaignId} started, first tweet at: ${nextTweetTime}`);

    return {
        success: true,
        nextTweetAt: nextTweetTime
    };
};

// Stop a campaign
const stopCampaign = (campaignId) => {
    database.stopCampaign(campaignId);
    console.log(`[Scheduler] Campaign ${campaignId} stopped`);

    return { success: true };
};

// Post immediately (for testing)
const postNow = async (campaignId) => {
    const campaign = database.getCampaign(campaignId);
    if (!campaign) {
        throw new Error('Campaign not found');
    }

    return await postTweet(campaign);
};

// Get scheduler status
const getStatus = () => {
    const activeCampaign = database.getActiveCampaign();

    return {
        isSchedulerRunning: !!schedulerTask,
        activeCampaign: activeCampaign ? {
            id: activeCampaign.id,
            subject: activeCampaign.subject,
            status: activeCampaign.status,
            startedAt: activeCampaign.started_at,
            nextTweetAt: activeCampaign.next_tweet_at,
            expiresAt: activeCampaign.started_at
                ? new Date(new Date(activeCampaign.started_at).getTime() + (activeCampaign.duration_days * 24 * 60 * 60 * 1000)).toISOString()
                : null
        } : null
    };
};

module.exports = {
    initializeScheduler,
    startCampaign,
    stopCampaign,
    postNow,
    getStatus,
    selectRandomHashtags,
    getRandomInterval
};
