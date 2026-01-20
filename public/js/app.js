// ===== API Configuration =====
const API_BASE = '/api';

// ===== State =====
let currentHashtags = [];
let campaigns = [];
let currentEditingCampaignId = null;

// ===== Helper Functions =====
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const showLoading = () => $('#loadingOverlay').classList.add('active');
const hideLoading = () => $('#loadingOverlay').classList.remove('active');

const showToast = (type, title, message) => {
    const container = $('#toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;

    container.appendChild(toast);

    setTimeout(() => toast.remove(), 5000);
};

const formatDate = (dateString) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleString();
};

const formatTimeUntil = (dateString) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;

    if (diff < 0) return 'Now';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
};

// ===== API Functions =====
const api = {
    async get(endpoint) {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }
        return response.json();
    },

    async post(endpoint, data) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }
        return response.json();
    },

    async put(endpoint, data) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }
        return response.json();
    }
};

// ===== Navigation =====
function showSection(sectionId) {
    $$('.section').forEach(s => s.classList.remove('active'));
    $$('.nav-item').forEach(n => n.classList.remove('active'));

    $(`#${sectionId}`).classList.add('active');
    $(`.nav-item[data-section="${sectionId}"]`).classList.add('active');

    // Load section-specific data
    if (sectionId === 'dashboard') loadDashboard();
    if (sectionId === 'credentials') loadCredentialsStatus();
    if (sectionId === 'campaigns') loadCampaigns();
    if (sectionId === 'history') loadTweetHistory();
}

// ===== Dashboard =====
async function loadDashboard() {
    try {
        // Load stats
        const [tweets, status] = await Promise.all([
            api.get('/tweets?limit=100'),
            api.get('/campaigns/scheduler/status')
        ]);

        // Update stats
        $('#totalTweets').textContent = tweets.length;
        $('#successfulTweets').textContent = tweets.filter(t => t.status === 'posted').length;
        $('#activeCampaigns').textContent = status.activeCampaign ? '1' : '0';
        $('#nextTweetTime').textContent = formatTimeUntil(status.activeCampaign?.nextTweetAt);

        // Update scheduler status
        updateSchedulerStatus(status);

        // Update active campaign display
        updateActiveCampaignDisplay(status.activeCampaign);

        // Update recent tweets
        updateRecentTweets(tweets.slice(0, 5));

    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

function updateSchedulerStatus(status) {
    const indicator = $('#schedulerStatus');
    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('.status-text');

    if (status.activeCampaign) {
        dot.classList.add('active');
        dot.classList.remove('inactive');
        text.textContent = 'Campaign Running';
    } else {
        dot.classList.remove('active');
        dot.classList.add('inactive');
        text.textContent = 'Scheduler Inactive';
    }
}

function updateActiveCampaignDisplay(campaign) {
    const container = $('#activeCampaignInfo');

    if (!campaign) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p>No active campaign</p>
                <button class="btn btn-primary btn-sm" onclick="showSection('campaigns')">Create Campaign</button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="active-campaign-display">
            <div class="active-campaign-subject">${campaign.subject}</div>
            <div class="active-campaign-info">
                <div class="info-item">
                    <span class="info-label">Status</span>
                    <span class="info-value" style="color: var(--accent-green)">Running</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Next Tweet</span>
                    <span class="info-value">${formatTimeUntil(campaign.nextTweetAt)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Started</span>
                    <span class="info-value">${formatDate(campaign.startedAt)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Expires</span>
                    <span class="info-value">${formatDate(campaign.expiresAt)}</span>
                </div>
            </div>
            <div class="active-campaign-actions">
                <button class="btn btn-ghost btn-sm" onclick="postNow(${campaign.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Post Now
                </button>
                <button class="btn btn-danger btn-sm" onclick="stopCampaign(${campaign.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <rect x="6" y="6" width="12" height="12"/>
                    </svg>
                    Stop
                </button>
            </div>
        </div>
    `;
}

function updateRecentTweets(tweets) {
    const container = $('#recentTweets');

    if (tweets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No tweets yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = tweets.map(tweet => `
        <div class="tweet-item">
            <div class="tweet-header">
                <span class="tweet-time">${formatDate(tweet.posted_at)}</span>
                <span class="tweet-status ${tweet.status}">${tweet.status}</span>
            </div>
            <div class="tweet-content">${tweet.tweet_text}</div>
        </div>
    `).join('');
}

// ===== Credentials =====
async function loadCredentialsStatus() {
    try {
        const [status, credentials] = await Promise.all([
            api.get('/credentials/status'),
            api.get('/credentials')
        ]);

        const twitterStatus = $('#twitterStatus');
        const geminiStatus = $('#geminiStatus');

        if (status.hasTwitterCredentials) {
            twitterStatus.textContent = 'Configured';
            twitterStatus.classList.add('configured');
        } else {
            twitterStatus.textContent = 'Not configured';
            twitterStatus.classList.remove('configured');
        }

        if (status.hasGeminiCredentials) {
            geminiStatus.textContent = 'Configured';
            geminiStatus.classList.add('configured');
        } else {
            geminiStatus.textContent = 'Not configured';
            geminiStatus.classList.remove('configured');
        }

        // Populate form with masked values (so user knows credentials are saved)
        $('#twitterApiKey').placeholder = credentials.twitterApiKey || 'Enter Twitter API Key';
        $('#twitterApiSecret').placeholder = credentials.twitterApiSecret || 'Enter Twitter API Secret';
        $('#twitterAccessToken').placeholder = credentials.twitterAccessToken || 'Enter Access Token';
        $('#twitterAccessSecret').placeholder = credentials.twitterAccessSecret || 'Enter Access Secret';
        $('#geminiApiKey').placeholder = credentials.geminiApiKey || 'Enter Gemini API Key';

    } catch (error) {
        console.error('Failed to load credentials status:', error);
    }
}

async function saveCredentials() {
    const credentials = {
        twitterApiKey: $('#twitterApiKey').value.trim(),
        twitterApiSecret: $('#twitterApiSecret').value.trim(),
        twitterAccessToken: $('#twitterAccessToken').value.trim(),
        twitterAccessSecret: $('#twitterAccessSecret').value.trim(),
        geminiApiKey: $('#geminiApiKey').value.trim()
    };

    // Validate that at least something is being saved
    const hasTwitter = credentials.twitterApiKey && credentials.twitterApiSecret &&
        credentials.twitterAccessToken && credentials.twitterAccessSecret;
    const hasGemini = credentials.geminiApiKey;

    if (!hasTwitter && !hasGemini) {
        showToast('error', 'Error', 'Please enter at least one set of credentials');
        return;
    }

    showLoading();

    try {
        await api.post('/credentials', credentials);
        showToast('success', 'Success', 'Credentials saved and validated successfully');
        loadCredentialsStatus();

        // Clear the form
        $('#twitterApiKey').value = '';
        $('#twitterApiSecret').value = '';
        $('#twitterAccessToken').value = '';
        $('#twitterAccessSecret').value = '';
        $('#geminiApiKey').value = '';

    } catch (error) {
        showToast('error', 'Error', error.message);
    } finally {
        hideLoading();
    }
}

// ===== Campaigns =====
async function loadCampaigns() {
    try {
        campaigns = await api.get('/campaigns');
        renderCampaignsList();
    } catch (error) {
        console.error('Failed to load campaigns:', error);
        showToast('error', 'Error', 'Failed to load campaigns');
    }
}

function renderCampaignsList() {
    const container = $('#campaignsList');

    if (campaigns.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 20V10"/>
                    <path d="M18 20V4"/>
                    <path d="M6 20v-4"/>
                </svg>
                <p>No campaigns yet</p>
                <span>Create your first campaign to get started</span>
            </div>
        `;
        return;
    }

    container.innerHTML = campaigns.map(campaign => `
        <div class="campaign-item">
            <div class="campaign-header">
                <div>
                    <div class="campaign-title">${campaign.subject}</div>
                </div>
                <span class="campaign-status ${campaign.status}">${campaign.status}</span>
            </div>
            <div class="campaign-meta">
                <div class="campaign-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    ${campaign.min_interval_hours}-${campaign.max_interval_hours}h
                </div>
                <div class="campaign-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    ${campaign.duration_days} days
                </div>
            </div>
            <div class="campaign-hashtags">
                ${campaign.hashtags.map(h => `<span class="campaign-hashtag">#${h}</span>`).join('')}
            </div>
            <div class="campaign-actions">
                ${campaign.status === 'running' ? `
                    <button class="btn btn-ghost btn-sm" onclick="postNow(${campaign.id})">Post Now</button>
                    <button class="btn btn-danger btn-sm" onclick="stopCampaign(${campaign.id})">Stop</button>
                ` : `
                    <button class="btn btn-success btn-sm" onclick="startCampaign(${campaign.id})">Start</button>
                    <button class="btn btn-ghost btn-sm" onclick="editCampaign(${campaign.id})">Edit</button>
                `}
            </div>
        </div>
    `).join('');
}

function addHashtag(tag) {
    tag = tag.trim().replace(/^#/, '');
    if (!tag) return;
    if (currentHashtags.length >= 5) {
        showToast('error', 'Limit Reached', 'Maximum 5 hashtags allowed');
        return;
    }
    if (currentHashtags.includes(tag)) {
        showToast('error', 'Duplicate', 'This hashtag already exists');
        return;
    }

    currentHashtags.push(tag);
    renderHashtags();
}

function removeHashtag(tag) {
    currentHashtags = currentHashtags.filter(h => h !== tag);
    renderHashtags();
}

function renderHashtags() {
    const container = $('#hashtagList');
    container.innerHTML = currentHashtags.map(tag => `
        <span class="hashtag-tag">
            #${tag}
            <button type="button" onclick="removeHashtag('${tag}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </span>
    `).join('');
}

async function saveCampaign(e) {
    e.preventDefault();

    const campaignData = {
        subject: $('#subject').value.trim(),
        extraInfo: $('#extraInfo').value.trim(),
        hashtags: currentHashtags,
        minIntervalHours: parseFloat($('#minInterval').value),
        maxIntervalHours: parseFloat($('#maxInterval').value),
        durationDays: parseInt($('#durationDays').value)
    };

    // Validation
    if (!campaignData.subject) {
        showToast('error', 'Error', 'Subject is required');
        return;
    }

    if (currentHashtags.length === 0) {
        showToast('error', 'Error', 'At least one hashtag is required');
        return;
    }

    if (campaignData.minIntervalHours >= campaignData.maxIntervalHours) {
        showToast('error', 'Error', 'Max interval must be greater than min interval');
        return;
    }

    showLoading();

    try {
        if (currentEditingCampaignId) {
            await api.put(`/campaigns/${currentEditingCampaignId}`, campaignData);
            showToast('success', 'Success', 'Campaign updated successfully');
        } else {
            await api.post('/campaigns', campaignData);
            showToast('success', 'Success', 'Campaign created successfully');
        }

        resetCampaignForm();
        loadCampaigns();

    } catch (error) {
        showToast('error', 'Error', error.message);
    } finally {
        hideLoading();
    }
}

function resetCampaignForm() {
    currentEditingCampaignId = null;
    currentHashtags = [];
    $('#campaignId').value = '';
    $('#subject').value = '';
    $('#extraInfo').value = '';
    $('#minInterval').value = '3';
    $('#maxInterval').value = '6';
    $('#durationDays').value = '7';
    $('#campaignFormTitle').textContent = 'Create New Campaign';
    $('#campaignSubmitText').textContent = 'Create Campaign';
    renderHashtags();
}

function editCampaign(id) {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;

    currentEditingCampaignId = id;
    currentHashtags = [...campaign.hashtags];

    $('#subject').value = campaign.subject;
    $('#extraInfo').value = campaign.extra_info || '';
    $('#minInterval').value = campaign.min_interval_hours;
    $('#maxInterval').value = campaign.max_interval_hours;
    $('#durationDays').value = campaign.duration_days;
    $('#campaignFormTitle').textContent = 'Edit Campaign';
    $('#campaignSubmitText').textContent = 'Update Campaign';

    renderHashtags();

    // Scroll to form
    $('.campaign-form-card').scrollIntoView({ behavior: 'smooth' });
}

async function startCampaign(id) {
    showLoading();

    try {
        await api.post(`/campaigns/${id}/start`);
        showToast('success', 'Campaign Started', 'Your campaign is now running');
        loadCampaigns();
        loadDashboard();
    } catch (error) {
        showToast('error', 'Error', error.message);
    } finally {
        hideLoading();
    }
}

async function stopCampaign(id) {
    showLoading();

    try {
        await api.post(`/campaigns/${id}/stop`);
        showToast('info', 'Campaign Stopped', 'Your campaign has been stopped');
        loadCampaigns();
        loadDashboard();
    } catch (error) {
        showToast('error', 'Error', error.message);
    } finally {
        hideLoading();
    }
}

async function postNow(id) {
    showLoading();

    try {
        const result = await api.post(`/campaigns/${id}/post-now`);
        if (result.success) {
            showToast('success', 'Tweet Posted', 'Your tweet was posted successfully');
            loadDashboard();
            loadTweetHistory();
        } else {
            showToast('error', 'Failed', result.message);
        }
    } catch (error) {
        showToast('error', 'Error', error.message);
    } finally {
        hideLoading();
    }
}

// ===== Tweet History =====
async function loadTweetHistory() {
    try {
        const tweets = await api.get('/tweets?limit=50');
        renderTweetHistory(tweets);
    } catch (error) {
        console.error('Failed to load tweet history:', error);
    }
}

function renderTweetHistory(tweets) {
    const container = $('#tweetHistory');

    if (tweets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
                <p>No tweets posted yet</p>
                <span>Start a campaign to begin posting</span>
            </div>
        `;
        return;
    }

    container.innerHTML = tweets.map(tweet => `
        <div class="tweet-item">
            <div class="tweet-header">
                <span class="tweet-time">${formatDate(tweet.posted_at)}</span>
                <span class="tweet-status ${tweet.status}">${tweet.status}</span>
            </div>
            <div class="tweet-content">${tweet.tweet_text}</div>
            ${tweet.hashtags_used && tweet.hashtags_used.length > 0 ? `
                <div class="tweet-hashtags">
                    ${tweet.hashtags_used.map(h => `<span class="tweet-hashtag">#${h}</span>`).join(' ')}
                </div>
            ` : ''}
            ${tweet.error_message ? `
                <div class="tweet-error">${tweet.error_message}</div>
            ` : ''}
        </div>
    `).join('');
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            showSection(item.dataset.section);
        });
    });

    // Credentials
    $('#saveCredentials').addEventListener('click', saveCredentials);

    // Campaign form
    $('#campaignForm').addEventListener('submit', saveCampaign);
    $('#resetCampaignForm').addEventListener('click', resetCampaignForm);

    // Hashtag input
    $('#hashtagInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addHashtag(e.target.value);
            e.target.value = '';
        }
    });

    // Refresh history button
    $('#refreshHistory').addEventListener('click', loadTweetHistory);

    // Initial load
    loadDashboard();
    loadCredentialsStatus();

    // Auto-refresh dashboard every 30 seconds
    setInterval(() => {
        if ($('#dashboard').classList.contains('active')) {
            loadDashboard();
        }
    }, 30000);
});

// Make functions available globally for onclick handlers
window.showSection = showSection;
window.removeHashtag = removeHashtag;
window.editCampaign = editCampaign;
window.startCampaign = startCampaign;
window.stopCampaign = stopCampaign;
window.postNow = postNow;
