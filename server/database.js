const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const CryptoJS = require('crypto-js');

let db = null;
const dbPath = path.join(__dirname, '..', 'data', 'app.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Save database to file
const saveDatabase = () => {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
};

// Initialize database
const initDatabase = async () => {
    const SQL = await initSqlJs();

    // Load existing database or create new
    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS credentials (
            id INTEGER PRIMARY KEY DEFAULT 1,
            twitter_api_key TEXT,
            twitter_api_secret TEXT,
            twitter_access_token TEXT,
            twitter_access_secret TEXT,
            gemini_api_key TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            CHECK (id = 1)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT NOT NULL,
            extra_info TEXT,
            hashtags TEXT NOT NULL,
            min_interval_hours REAL NOT NULL DEFAULT 3,
            max_interval_hours REAL NOT NULL DEFAULT 6,
            duration_days INTEGER NOT NULL DEFAULT 7,
            status TEXT NOT NULL DEFAULT 'stopped',
            started_at DATETIME,
            next_tweet_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS tweet_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER,
            tweet_text TEXT NOT NULL,
            hashtags_used TEXT,
            twitter_tweet_id TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            error_message TEXT,
            posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
        )
    `);

    // Insert default credentials row if not exists
    const credCheck = db.exec("SELECT id FROM credentials WHERE id = 1");
    if (credCheck.length === 0 || credCheck[0].values.length === 0) {
        db.run("INSERT INTO credentials (id) VALUES (1)");
    }

    saveDatabase();

    return db;
};

// Encryption helpers
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

// Helper to get single row
const getRow = (sql, params = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
    }
    stmt.free();
    return null;
};

// Helper to get all rows
const getAll = (sql, params = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
};

// Credentials functions
const saveCredentials = (credentials) => {
    db.run(`
        UPDATE credentials SET
            twitter_api_key = ?,
            twitter_api_secret = ?,
            twitter_access_token = ?,
            twitter_access_secret = ?,
            gemini_api_key = ?,
            updated_at = datetime('now')
        WHERE id = 1
    `, [
        encrypt(credentials.twitterApiKey),
        encrypt(credentials.twitterApiSecret),
        encrypt(credentials.twitterAccessToken),
        encrypt(credentials.twitterAccessSecret),
        encrypt(credentials.geminiApiKey)
    ]);
    saveDatabase();
};

const getCredentials = () => {
    const row = getRow('SELECT * FROM credentials WHERE id = 1');
    if (!row) return null;

    return {
        twitterApiKey: decrypt(row.twitter_api_key),
        twitterApiSecret: decrypt(row.twitter_api_secret),
        twitterAccessToken: decrypt(row.twitter_access_token),
        twitterAccessSecret: decrypt(row.twitter_access_secret),
        geminiApiKey: decrypt(row.gemini_api_key)
    };
};

const hasCredentials = () => {
    const creds = getCredentials();
    return creds && creds.twitterApiKey && creds.geminiApiKey;
};

// Campaign functions
const createCampaign = (campaign) => {
    db.run(`
        INSERT INTO campaigns (subject, extra_info, hashtags, min_interval_hours, max_interval_hours, duration_days)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        campaign.subject,
        campaign.extraInfo || '',
        JSON.stringify(campaign.hashtags),
        campaign.minIntervalHours,
        campaign.maxIntervalHours,
        campaign.durationDays
    ]);
    saveDatabase();

    // Get last insert id
    const result = db.exec("SELECT last_insert_rowid() as id");
    return result[0].values[0][0];
};

const updateCampaign = (id, campaign) => {
    db.run(`
        UPDATE campaigns SET
            subject = ?,
            extra_info = ?,
            hashtags = ?,
            min_interval_hours = ?,
            max_interval_hours = ?,
            duration_days = ?,
            updated_at = datetime('now')
        WHERE id = ?
    `, [
        campaign.subject,
        campaign.extraInfo || '',
        JSON.stringify(campaign.hashtags),
        campaign.minIntervalHours,
        campaign.maxIntervalHours,
        campaign.durationDays,
        id
    ]);
    saveDatabase();
};

const getCampaign = (id) => {
    const row = getRow('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (!row) return null;

    return {
        ...row,
        hashtags: JSON.parse(row.hashtags)
    };
};

const getActiveCampaign = () => {
    const row = getRow("SELECT * FROM campaigns WHERE status = 'running' ORDER BY started_at DESC LIMIT 1");
    if (!row) return null;

    return {
        ...row,
        hashtags: JSON.parse(row.hashtags)
    };
};

const getAllCampaigns = () => {
    const rows = getAll('SELECT * FROM campaigns ORDER BY created_at DESC');
    return rows.map(row => ({
        ...row,
        hashtags: JSON.parse(row.hashtags)
    }));
};

const startCampaign = (id, nextTweetAt) => {
    db.run(`
        UPDATE campaigns SET
            status = 'running',
            started_at = datetime('now'),
            next_tweet_at = ?,
            updated_at = datetime('now')
        WHERE id = ?
    `, [nextTweetAt, id]);
    saveDatabase();
};

const stopCampaign = (id) => {
    db.run(`
        UPDATE campaigns SET
            status = 'stopped',
            next_tweet_at = NULL,
            updated_at = datetime('now')
        WHERE id = ?
    `, [id]);
    saveDatabase();
};

const updateNextTweetTime = (id, nextTweetAt) => {
    db.run(`
        UPDATE campaigns SET
            next_tweet_at = ?,
            updated_at = datetime('now')
        WHERE id = ?
    `, [nextTweetAt, id]);
    saveDatabase();
};

// Tweet history functions
const addTweetHistory = (tweet) => {
    db.run(`
        INSERT INTO tweet_history (campaign_id, tweet_text, hashtags_used, twitter_tweet_id, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        tweet.campaignId,
        tweet.tweetText,
        JSON.stringify(tweet.hashtagsUsed),
        tweet.twitterTweetId || null,
        tweet.status,
        tweet.errorMessage || null
    ]);
    saveDatabase();

    const result = db.exec("SELECT last_insert_rowid() as id");
    return result[0].values[0][0];
};

const getTweetHistory = (limit = 50) => {
    const rows = getAll(`
        SELECT th.*, c.subject as campaign_subject
        FROM tweet_history th
        LEFT JOIN campaigns c ON th.campaign_id = c.id
        ORDER BY th.posted_at DESC
        LIMIT ?
    `, [limit]);

    return rows.map(row => ({
        ...row,
        hashtags_used: row.hashtags_used ? JSON.parse(row.hashtags_used) : []
    }));
};

const getTweetHistoryByCampaign = (campaignId, limit = 50) => {
    const rows = getAll(`
        SELECT * FROM tweet_history
        WHERE campaign_id = ?
        ORDER BY posted_at DESC
        LIMIT ?
    `, [campaignId, limit]);

    return rows.map(row => ({
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
