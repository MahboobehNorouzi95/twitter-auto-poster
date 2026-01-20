# TweetBot Pro - AI-Powered Twitter Automation

An AI-powered Twitter auto-posting web application with random scheduling, automatic tweet generation, and smart hashtag selection.

![Dashboard Preview](https://via.placeholder.com/800x400?text=TweetBot+Pro+Dashboard)

## Features

- 🤖 **AI Tweet Generation** - Uses Google Gemini AI to create unique, engaging tweets
- 🎯 **Topic-Based Content** - Provide a subject and extra info, the AI handles the rest
- #️⃣ **Smart Hashtag Selection** - Add up to 5 hashtags, 3 random ones added to each tweet
- ⏰ **Random Scheduling** - Posts at random intervals within your specified range
- 📊 **Dashboard** - Real-time stats and campaign monitoring
- 🌙 **Premium Dark UI** - Beautiful, modern interface
- ☁️ **Free Hosting Ready** - Deploy to Render.com for free

## Prerequisites

Before using this app, you'll need:

### 1. Twitter Developer Account

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new project and app
3. Set up **User Authentication Settings**:
   - Enable OAuth 1.0a
   - Set App permissions to **Read and Write**
   - Set callback URL to your deployed app URL (e.g., `https://your-app.onrender.com`)
4. Generate and save your:
   - API Key (Consumer Key)
   - API Secret (Consumer Secret)
   - Access Token
   - Access Token Secret

### 2. Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy and save your API key (free tier is sufficient)

## Local Development

### Setup

```bash
# Clone or navigate to the project
cd twitter-auto-poster

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env and set your ENCRYPTION_KEY (any random 32-character string)
```

### Run the App

```bash
npm start
```

Visit `http://localhost:3000` in your browser.

## Deployment to Render.com (Free)

### Step 1: Push to GitHub

Create a new GitHub repository and push your code:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/twitter-auto-poster.git
git push -u origin main
```

### Step 2: Deploy to Render

1. Go to [Render.com](https://render.com) and sign up/login
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Render will auto-detect the `render.yaml` configuration
5. Click "Create Web Service"

Your app will be deployed at `https://twitter-auto-poster.onrender.com` (or similar).

### Step 3: Keep Your App Alive (Important!)

Free Render apps sleep after 15 minutes of inactivity. To keep your scheduler running:

1. Go to [cron-job.org](https://cron-job.org) (free service)
2. Create an account
3. Create a new cron job:
   - URL: `https://your-app.onrender.com/api/ping`
   - Schedule: Every 10 minutes (`*/10 * * * *`)
4. Enable the cron job

This will ping your app every 10 minutes to prevent it from sleeping.

## Usage

### 1. Set Up Credentials

1. Open your deployed app
2. Go to "API Setup" in the sidebar
3. Enter your Twitter API credentials
4. Enter your Gemini API key
5. Click "Save Credentials"

### 2. Create a Campaign

1. Go to "Campaigns" in the sidebar
2. Fill in the form:
   - **Subject**: Your main topic (e.g., "Web Development Tips")
   - **Extra Info**: Style guidance (e.g., "Keep it casual, focus on beginners")
   - **Hashtags**: Add up to 5 hashtags
   - **Intervals**: Min/max hours between tweets
   - **Duration**: How many days to run
3. Click "Create Campaign"

### 3. Start the Campaign

1. Click "Start" on your campaign
2. The app will automatically:
   - Generate unique tweets using AI
   - Select 3 random hashtags from your list
   - Post at random intervals within your range
   - Continue until the duration expires

### 4. Monitor Progress

- **Dashboard**: View stats and active campaign status
- **History**: See all posted tweets and their status

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite (file-based, no external DB needed)
- **AI**: Google Gemini 1.5 Flash
- **Twitter**: twitter-api-v2
- **Frontend**: Vanilla HTML/CSS/JS

## Security

- All API credentials are encrypted at rest using AES-256
- Encryption key is stored as an environment variable
- Credentials are never exposed in API responses

## Troubleshooting

### "Invalid Twitter credentials"
- Make sure your app has **Read and Write** permissions
- Regenerate your access tokens after changing permissions
- Verify all 4 credential values are correct

### "Twitter API rate limit exceeded"
- Wait 15 minutes before trying again
- Increase your posting intervals

### "Failed to generate tweet"
- Check your Gemini API key is valid
- Verify you haven't exceeded Gemini's free tier limits

### App stops posting after a while
- Set up the cron-job.org ping as described above
- The free Render tier sleeps after inactivity

## License

MIT License - feel free to use and modify!
