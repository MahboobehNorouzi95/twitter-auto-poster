const express = require('express');
const router = express.Router();
const database = require('../database');
const scheduler = require('../scheduler');

// Get all campaigns
router.get('/', async (req, res) => {
    try {
        const campaigns = await database.getAllCampaigns();
        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single campaign
router.get('/:id', async (req, res) => {
    try {
        const campaign = await database.getCampaign(parseInt(req.params.id));
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.json(campaign);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create campaign
router.post('/', async (req, res) => {
    try {
        const { subject, extraInfo, hashtags, minIntervalHours, maxIntervalHours, durationDays } = req.body;

        // Validation
        if (!subject || !subject.trim()) {
            return res.status(400).json({ error: 'Subject is required' });
        }

        if (!hashtags || !Array.isArray(hashtags) || hashtags.length === 0) {
            return res.status(400).json({ error: 'At least one hashtag is required' });
        }

        if (hashtags.length > 5) {
            return res.status(400).json({ error: 'Maximum 5 hashtags allowed' });
        }

        if (!minIntervalHours || minIntervalHours < 0.5) {
            return res.status(400).json({ error: 'Minimum interval must be at least 0.5 hours' });
        }

        if (!maxIntervalHours || maxIntervalHours < minIntervalHours) {
            return res.status(400).json({ error: 'Maximum interval must be greater than minimum' });
        }

        if (!durationDays || durationDays < 1) {
            return res.status(400).json({ error: 'Duration must be at least 1 day' });
        }

        // Clean hashtags (remove # if present, then we'll add it back when posting)
        const cleanedHashtags = hashtags.map(h => h.replace(/^#/, '').trim()).filter(h => h);

        const campaignId = await database.createCampaign({
            subject: subject.trim(),
            extraInfo: extraInfo?.trim() || '',
            hashtags: cleanedHashtags,
            minIntervalHours: parseFloat(minIntervalHours),
            maxIntervalHours: parseFloat(maxIntervalHours),
            durationDays: parseInt(durationDays)
        });

        const campaign = await database.getCampaign(campaignId);
        res.status(201).json(campaign);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update campaign
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const campaign = await database.getCampaign(id);

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        if (campaign.status === 'running') {
            return res.status(400).json({ error: 'Cannot edit a running campaign. Stop it first.' });
        }

        const { subject, extraInfo, hashtags, minIntervalHours, maxIntervalHours, durationDays } = req.body;

        // Validation (same as create)
        if (!subject || !subject.trim()) {
            return res.status(400).json({ error: 'Subject is required' });
        }

        if (!hashtags || !Array.isArray(hashtags) || hashtags.length === 0) {
            return res.status(400).json({ error: 'At least one hashtag is required' });
        }

        if (hashtags.length > 5) {
            return res.status(400).json({ error: 'Maximum 5 hashtags allowed' });
        }

        const cleanedHashtags = hashtags.map(h => h.replace(/^#/, '').trim()).filter(h => h);

        await database.updateCampaign(id, {
            subject: subject.trim(),
            extraInfo: extraInfo?.trim() || '',
            hashtags: cleanedHashtags,
            minIntervalHours: parseFloat(minIntervalHours),
            maxIntervalHours: parseFloat(maxIntervalHours),
            durationDays: parseInt(durationDays)
        });

        const updatedCampaign = await database.getCampaign(id);
        res.json(updatedCampaign);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start campaign
router.post('/:id/start', async (req, res) => {
    try {
        // Check if credentials are set
        if (!await database.hasCredentials()) {
            return res.status(400).json({
                error: 'Please set up your Twitter and Gemini API credentials first'
            });
        }

        const id = parseInt(req.params.id);
        const result = await scheduler.startCampaign(id);
        res.json(result);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop campaign
router.post('/:id/stop', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await scheduler.stopCampaign(id);
        res.json(result);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Post now (test/immediate post)
router.post('/:id/post-now', async (req, res) => {
    try {
        if (!await database.hasCredentials()) {
            return res.status(400).json({
                error: 'Please set up your Twitter and Gemini API credentials first'
            });
        }

        const id = parseInt(req.params.id);
        const success = await scheduler.postNow(id);

        res.json({
            success,
            message: success ? 'Tweet posted successfully!' : 'Failed to post tweet'
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get scheduler status
router.get('/scheduler/status', async (req, res) => {
    try {
        const status = await scheduler.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
