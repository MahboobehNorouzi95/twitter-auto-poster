const express = require('express');
const router = express.Router();
const database = require('../database');

// Get tweet history
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const tweets = await database.getTweetHistory(limit);
        res.json(tweets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get tweet history for a specific campaign
router.get('/campaign/:id', async (req, res) => {
    try {
        const campaignId = parseInt(req.params.id);
        const limit = parseInt(req.query.limit) || 50;
        const tweets = await database.getTweetHistoryByCampaign(campaignId, limit);
        res.json(tweets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
