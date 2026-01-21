const { Pool } = require('pg');
const CryptoJS = require('crypto-js');
require('dotenv').config();

// Create connection pool
// On Render, DATABASE_URL will be provided automatically
// Locally, it will look for DATABASE_URL in .env
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Encryption helpers (Same as before)
const getEncryptionKey = () => {
    return process.env.ENCRYPTION_KEY || 'default-key-change-in-production!';
};

const encrypt = (text) => {
    if (!text) return null;
    return CryptoJS.AES.encrypt(text, getEncryptionKey()).toString();
};

const decrypt = (ciphertext) => {
    if (!ciphertext) return null;
    const bytes = CryptoJS.AES.decrypt(ciphertext, getEncryptionKey());
    return bytes.toString(CryptoJS.enc.Utf8);
};

// Initialize database
const initDatabase = async () => {
    const client = await pool.connect();
    try {
        console.log('Connected to PostgreSQL database...');

        // Create Credentials Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS credentials (
                id INTEGER PRIMARY KEY DEFAULT 1,
                twitter_api_key TEXT,
                twitter_api_secret TEXT,
                twitter_access_token TEXT,
                twitter_access_secret TEXT,
                gemini_api_key TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT single_row CHECK (id = 1)
            );
        `);

        // Create Campaigns Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS campaigns (
                id SERIAL PRIMARY KEY,
                subject TEXT NOT NULL,
                extra_info TEXT,
                hashtags TEXT NOT NULL,
                min_interval_hours REAL NOT NULL DEFAULT 3,
                max_interval_hours REAL NOT NULL DEFAULT 6,
                duration_days INTEGER NOT NULL DEFAULT 7,
                status TEXT NOT NULL DEFAULT 'stopped',
                started_at TIMESTAMP,
                next_tweet_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create Tweet History Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS tweet_history (
                id SERIAL PRIMARY KEY,
                campaign_id INTEGER REFERENCES campaigns(id),
                tweet_text TEXT NOT NULL,
                hashtags_used TEXT,
                twitter_tweet_id TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                error_message TEXT,
                posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Insert default credentials row if not exists
        await client.query(`
            INSERT INTO credentials (id) 
            VALUES (1) 
            ON CONFLICT (id) DO NOTHING;
        `);

        console.log('Database schema initialized.');
    } catch (err) {
        console.error('Error initializing database:', err);
        throw err;
    } finally {
        client.release();
    }
};

// Credentials functions
const saveCredentials = async (credentials) => {
    // Encrypt the values first
    const encrypted = {
        twitterApiKey: encrypt(credentials.twitterApiKey),
        twitterApiSecret: encrypt(credentials.twitterApiSecret),
        twitterAccessToken: encrypt(credentials.twitterAccessToken),
        twitterAccessSecret: encrypt(credentials.twitterAccessSecret),
        geminiApiKey: encrypt(credentials.geminiApiKey)
    };

    // Use COALESCE to keep existing value if the new one is null/undefined
    // This allows partial updates (e.g. updating just Gemini key while keeping Twitter keys)
    const query = `
        UPDATE credentials SET
            twitter_api_key = COALESCE($1, twitter_api_key),
            twitter_api_secret = COALESCE($2, twitter_api_secret),
            twitter_access_token = COALESCE($3, twitter_access_token),
            twitter_access_secret = COALESCE($4, twitter_access_secret),
            gemini_api_key = COALESCE($5, gemini_api_key),
            updated_at = NOW()
        WHERE id = 1
    `;
    const values = [
        encrypted.twitterApiKey,
        encrypted.twitterApiSecret,
        encrypted.twitterAccessToken,
        encrypted.twitterAccessSecret,
        encrypted.geminiApiKey
    ];
    await pool.query(query, values);
};

const getCredentials = async () => {
    const res = await pool.query('SELECT * FROM credentials WHERE id = 1');
    const row = res.rows[0];
    if (!row) return null;

    return {
        twitterApiKey: decrypt(row.twitter_api_key),
        twitterApiSecret: decrypt(row.twitter_api_secret),
        twitterAccessToken: decrypt(row.twitter_access_token),
        twitterAccessSecret: decrypt(row.twitter_access_secret),
        geminiApiKey: decrypt(row.gemini_api_key)
    };
};

const hasCredentials = async () => {
    const creds = await getCredentials();
    return creds && creds.twitterApiKey && creds.geminiApiKey;
};

// Campaign functions
const createCampaign = async (campaign) => {
    const query = `
        INSERT INTO campaigns (subject, extra_info, hashtags, min_interval_hours, max_interval_hours, duration_days)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
    `;
    const values = [
        campaign.subject,
        campaign.extraInfo || '',
        JSON.stringify(campaign.hashtags),
        campaign.minIntervalHours,
        campaign.maxIntervalHours,
        campaign.durationDays
    ];
    const res = await pool.query(query, values);
    return res.rows[0].id;
};

const updateCampaign = async (id, campaign) => {
    const query = `
        UPDATE campaigns SET
            subject = $1,
            extra_info = $2,
            hashtags = $3,
            min_interval_hours = $4,
            max_interval_hours = $5,
            duration_days = $6,
            updated_at = NOW()
        WHERE id = $7
    `;
    const values = [
        campaign.subject,
        campaign.extraInfo || '',
        JSON.stringify(campaign.hashtags),
        campaign.minIntervalHours,
        campaign.maxIntervalHours,
        campaign.durationDays,
        id
    ];
    await pool.query(query, values);
};

const getCampaign = async (id) => {
    const res = await pool.query('SELECT * FROM campaigns WHERE id = $1', [id]);
    const row = res.rows[0];
    if (!row) return null;

    return {
        ...row,
        hashtags: JSON.parse(row.hashtags)
    };
};

const getActiveCampaign = async () => {
    const res = await pool.query("SELECT * FROM campaigns WHERE status = 'running' ORDER BY started_at DESC LIMIT 1");
    const row = res.rows[0];
    if (!row) return null;

    return {
        ...row,
        hashtags: JSON.parse(row.hashtags)
    };
};

const getAllCampaigns = async () => {
    const res = await pool.query('SELECT * FROM campaigns ORDER BY created_at DESC');
    return res.rows.map(row => ({
        ...row,
        hashtags: JSON.parse(row.hashtags)
    }));
};

const startCampaign = async (id, nextTweetAt) => {
    const query = `
        UPDATE campaigns SET
            status = 'running',
            started_at = NOW(),
            next_tweet_at = $1,
            updated_at = NOW()
        WHERE id = $2
    `;
    await pool.query(query, [nextTweetAt, id]);
};

const stopCampaign = async (id) => {
    const query = `
        UPDATE campaigns SET
            status = 'stopped',
            next_tweet_at = NULL,
            updated_at = NOW()
        WHERE id = $1
    `;
    await pool.query(query, [id]);
};

const updateNextTweetTime = async (id, nextTweetAt) => {
    const query = `
        UPDATE campaigns SET
            next_tweet_at = $1,
            updated_at = NOW()
        WHERE id = $2
    `;
    await pool.query(query, [nextTweetAt, id]);
};

// Tweet history functions
const addTweetHistory = async (tweet) => {
    const query = `
        INSERT INTO tweet_history (campaign_id, tweet_text, hashtags_used, twitter_tweet_id, status, error_message)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
    `;
    const values = [
        tweet.campaignId,
        tweet.tweetText,
        JSON.stringify(tweet.hashtagsUsed),
        tweet.twitterTweetId || null,
        tweet.status,
        tweet.errorMessage || null
    ];
    const res = await pool.query(query, values);
    return res.rows[0].id;
};

const getTweetHistory = async (limit = 50) => {
    const query = `
        SELECT th.*, c.subject as campaign_subject
        FROM tweet_history th
        LEFT JOIN campaigns c ON th.campaign_id = c.id
        ORDER BY th.posted_at DESC
        LIMIT $1
    `;
    const res = await pool.query(query, [limit]);
    return res.rows.map(row => ({
        ...row,
        hashtags_used: row.hashtags_used ? JSON.parse(row.hashtags_used) : []
    }));
};

const getTweetHistoryByCampaign = async (campaignId, limit = 50) => {
    const query = `
        SELECT * FROM tweet_history
        WHERE campaign_id = $1
        ORDER BY posted_at DESC
        LIMIT $2
    `;
    const res = await pool.query(query, [campaignId, limit]);
    return res.rows.map(row => ({
        ...row,
        hashtags_used: row.hashtags_used ? JSON.parse(row.hashtags_used) : []
    }));
};

module.exports = {
    initDatabase,
    saveCredentials,
    getCredentials,
    hasCredentials,
    createCampaign,
    updateCampaign,
    getCampaign,
    getActiveCampaign,
    getAllCampaigns,
    startCampaign,
    stopCampaign,
    updateNextTweetTime,
    addTweetHistory,
    getTweetHistory,
    getTweetHistoryByCampaign
};
