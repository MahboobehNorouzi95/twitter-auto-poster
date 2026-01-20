require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const database = require('./database');
const twitter = require('./twitter');
const gemini = require('./gemini');
const scheduler = require('./scheduler');

// Import routes
const credentialsRoutes = require('./routes/credentials');
const campaignsRoutes = require('./routes/campaigns');
const tweetsRoutes = require('./routes/tweets');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/credentials', credentialsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/tweets', tweetsRoutes);

// Health check / keep-alive endpoint
app.get('/api/health', (req, res) => {
    const status = scheduler.getStatus();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        scheduler: status
    });
});

// Ping endpoint for external cron services to keep app alive
app.get('/api/ping', (req, res) => {
    res.send('pong');
});

// Catch-all route - serve index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize app
const initialize = async () => {
    try {
        // Initialize database first
        console.log('Initializing database...');
        await database.initDatabase();

        // Load saved credentials and initialize clients
        const creds = database.getCredentials();

        if (creds?.twitterApiKey) {
            console.log('Initializing Twitter client...');
            twitter.initializeTwitter(creds);
        }

        if (creds?.geminiApiKey) {
            console.log('Initializing Gemini client...');
            gemini.initializeGemini(creds.geminiApiKey);
        }

        // Initialize scheduler
        scheduler.initializeScheduler();

        // Start server
        app.listen(PORT, () => {
            console.log(`\n🚀 Twitter Auto-Poster running at http://localhost:${PORT}`);
            console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
            console.log('\n');
        });

    } catch (error) {
        console.error('Failed to initialize:', error);
        process.exit(1);
    }
};

initialize();
