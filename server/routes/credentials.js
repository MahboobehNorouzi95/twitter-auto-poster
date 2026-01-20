const express = require('express');
const router = express.Router();
const database = require('../database');
const twitter = require('../twitter');
const gemini = require('../gemini');

// Get credentials status (not the actual values)
router.get('/status', (req, res) => {
    try {
        const creds = database.getCredentials();

        res.json({
            hasTwitterCredentials: !!(creds?.twitterApiKey && creds?.twitterApiSecret &&
                creds?.twitterAccessToken && creds?.twitterAccessSecret),
            hasGeminiCredentials: !!creds?.geminiApiKey
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

        // Validate Twitter credentials
        if (twitterApiKey && twitterApiSecret && twitterAccessToken && twitterAccessSecret) {
            const twitterResult = await twitter.validateCredentials({
                twitterApiKey,
                twitterApiSecret,
                twitterAccessToken,
                twitterAccessSecret
            });

            if (!twitterResult.valid) {
                return res.status(400).json({
                    error: 'Invalid Twitter credentials',
                    details: twitterResult.error
                });
            }
        }

        // Validate Gemini credentials
        if (geminiApiKey) {
            const geminiResult = await gemini.validateApiKey(geminiApiKey);

            if (!geminiResult.valid) {
                return res.status(400).json({
                    error: 'Invalid Gemini API key',
                    details: geminiResult.error
                });
            }
        }

        // Save credentials
        database.saveCredentials({
            twitterApiKey,
            twitterApiSecret,
            twitterAccessToken,
            twitterAccessSecret,
            geminiApiKey
        });

        // Initialize clients
        if (twitterApiKey) {
            twitter.initializeTwitter({
                twitterApiKey,
                twitterApiSecret,
                twitterAccessToken,
                twitterAccessSecret
            });
        }

        if (geminiApiKey) {
            gemini.initializeGemini(geminiApiKey);
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
