const express = require('express');
const router = express.Router();
const database = require('../database');
const twitter = require('../twitter');
const gemini = require('../gemini');

// Get credentials status (not the actual values)
router.get('/status', async (req, res) => {
    try {
        const creds = await database.getCredentials();

        res.json({
            hasTwitterCredentials: !!(creds?.twitterApiKey && creds?.twitterApiSecret &&
                creds?.twitterAccessToken && creds?.twitterAccessSecret),
            hasGeminiCredentials: !!creds?.geminiApiKey
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get masked credentials (for display in UI)
router.get('/', async (req, res) => {
    try {
        const creds = await database.getCredentials();

        // Mask sensitive values (show last 4 characters only)
        const maskValue = (value) => {
            if (!value) return '';
            if (value.length <= 8) return '*'.repeat(value.length);
            return '*'.repeat(value.length - 4) + value.slice(-4);
        };

        res.json({
            twitterApiKey: creds?.twitterApiKey ? maskValue(creds.twitterApiKey) : '',
            twitterApiSecret: creds?.twitterApiSecret ? maskValue(creds.twitterApiSecret) : '',
            twitterAccessToken: creds?.twitterAccessToken ? maskValue(creds.twitterAccessToken) : '',
            twitterAccessSecret: creds?.twitterAccessSecret ? maskValue(creds.twitterAccessSecret) : '',
            geminiApiKey: creds?.geminiApiKey ? maskValue(creds.geminiApiKey) : ''
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Save credentials
router.post('/', async (req, res) => {
    try {
        const {
            twitterApiKey,
            twitterApiSecret,
            twitterAccessToken,
            twitterAccessSecret,
            geminiApiKey
        } = req.body;

        // Clean inputs (remove potential whitespace from copy-pasting)
        const cleanedTwitterApiKey = twitterApiKey?.trim();
        const cleanedTwitterApiSecret = twitterApiSecret?.trim();
        const cleanedTwitterAccessToken = twitterAccessToken?.trim();
        const cleanedTwitterAccessSecret = twitterAccessSecret?.trim();
        const cleanedGeminiApiKey = geminiApiKey?.trim();

        // Validate Twitter credentials
        if (cleanedTwitterApiKey && cleanedTwitterApiSecret && cleanedTwitterAccessToken && cleanedTwitterAccessSecret) {
            const twitterResult = await twitter.validateCredentials({
                twitterApiKey: cleanedTwitterApiKey,
                twitterApiSecret: cleanedTwitterApiSecret,
                twitterAccessToken: cleanedTwitterAccessToken,
                twitterAccessSecret: cleanedTwitterAccessSecret
            });

            if (!twitterResult.valid) {
                return res.status(400).json({
                    error: 'Invalid Twitter credentials',
                    details: twitterResult.error
                });
            }
        }

        // Validate Gemini credentials
        if (cleanedGeminiApiKey) {
            const geminiResult = await gemini.validateApiKey(cleanedGeminiApiKey);

            if (!geminiResult.valid) {
                return res.status(400).json({
                    error: 'Invalid Gemini API key',
                    details: geminiResult.error
                });
            }
        }

        // Save credentials
        await database.saveCredentials({
            twitterApiKey: cleanedTwitterApiKey,
            twitterApiSecret: cleanedTwitterApiSecret,
            twitterAccessToken: cleanedTwitterAccessToken,
            twitterAccessSecret: cleanedTwitterAccessSecret,
            geminiApiKey: cleanedGeminiApiKey
        });

        // Initialize clients
        if (cleanedTwitterApiKey) {
            twitter.initializeTwitter({
                twitterApiKey: cleanedTwitterApiKey,
                twitterApiSecret: cleanedTwitterApiSecret,
                twitterAccessToken: cleanedTwitterAccessToken,
                twitterAccessSecret: cleanedTwitterAccessSecret
            });
        }

        if (cleanedGeminiApiKey) {
            gemini.initializeGemini(cleanedGeminiApiKey);
        }

        res.json({
            success: true,
            message: 'Credentials saved and validated successfully'
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Validate credentials without saving
router.post('/validate', async (req, res) => {
    try {
        const {
            twitterApiKey,
            twitterApiSecret,
            twitterAccessToken,
            twitterAccessSecret,
            geminiApiKey
        } = req.body;

        const results = {
            twitter: { valid: false },
            gemini: { valid: false }
        };

        // Validate Twitter
        if (twitterApiKey && twitterApiSecret && twitterAccessToken && twitterAccessSecret) {
            results.twitter = await twitter.validateCredentials({
                twitterApiKey,
                twitterApiSecret,
                twitterAccessToken,
                twitterAccessSecret
            });
        }

        // Validate Gemini
        if (geminiApiKey) {
            results.gemini = await gemini.validateApiKey(geminiApiKey);
        }

        res.json(results);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
