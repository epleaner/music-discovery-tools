# Railway Deployment Guide

This guide walks you through deploying Soundscape to Railway using the CLI.

## Prerequisites

1. Railway account (sign up at https://railway.app)
2. Railway CLI installed: `brew install railway`
3. GitHub repository connected

## Quick Start

### 1. Login to Railway

```bash
railway login
```

This will open your browser to authenticate.

### 2. Create a New Project

```bash
railway init
```

Follow the prompts to create a new project or link to an existing one.

### 3. Add PostgreSQL Database

### 4. Deploy Backend API

```bash
# Set working directory to server
cd apps/server

# Link to Railway project (if not already linked)
railway link

# Set environment variables
railway variables set NODE_ENV=production
railway variables set API_BASE_URL=$(railway service -s soundscape-api)
railway variables set WEB_APP_URL=$(railway service -s soundscape-web)

# Deploy
railway up
```

### 5. Deploy Web App (Static Site)

Railway doesn't have a built-in static site service, but you can:

**Option A: Use Railway's Static Files Service**
```bash
cd apps/web
railway service create --name soundscape-web
railway up --service soundscape-web
```

**Option B: Deploy to Railway + Cloudflare Pages / Vercel**
- Build the web app locally or in CI
- Deploy `apps/web/dist` to a static hosting service
- Point environment variables to Railway API URL

**Option C: Use Railway's Web Service with Static File Serving**
Create a simple Express server to serve static files (see below).

## Railway CLI Commands

### Service Management

```bash
# List services
railway service list

# Create a new service
railway service create --name soundscape-api

# Link to a service
railway link --service soundscape-api

# View service logs
railway logs

# View service logs with tail
railway logs --tail

# Deploy
railway up

# Deploy specific service
railway up --service soundscape-api
```

### Environment Variables

```bash
# List all variables
railway variables

# Set a variable
railway variables set KEY=value

# Get a variable
railway variables get KEY

# Delete a variable
railway variables delete KEY
```

## Configuration Files

### railway.json (Root)

Railway auto-detects Node.js projects, but you can customize:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "./apps/server/railway-build.sh"
  },
  "deploy": {
    "startCommand": "pnpm --filter @soundscape/server start"
  }
}
```

### Per-Service Configuration

Create `railway.json` in each service directory:

**apps/server/railway.json:**
```json
{
  "build": {
    "buildCommand": "../railway-build.sh"
  },
  "deploy": {
    "startCommand": "pnpm start"
  }
}
```

## Monorepo Setup

Railway supports monorepos. For multiple services:

1. **Create separate services for each app:**
   ```bash
   # API service
   cd apps/server
   railway service create --name soundscape-api
   railway link
   
   # Web service (if using Option C)
   cd ../web
   railway service create --name soundscape-web
   railway link
   ```

2. **Set root directory in Railway dashboard:**
   - Go to service settings
   - Set "Root Directory" to `apps/server` or `apps/web`

3. **Or use Railway's monorepo detection:**
   - Railway can detect multiple services from one repo
   - Configure each service's root directory in the dashboard

## Environment Variables

### Backend API

```bash
railway variables set NODE_ENV=production
railway variables set API_BASE_URL=https://your-api.railway.app
railway variables set WEB_APP_URL=https://your-web.railway.app
railway variables set PORT=$PORT  # Railway sets this automatically
```

### Web App

```bash
railway variables set VITE_API_URL=https://your-api.railway.app
railway variables set VITE_WS_URL=wss://your-api.railway.app/ws
railway variables set VITE_LASTFM_API_KEY=your_key_here
```

## Static Site Option C: Express Server

If you want to serve the static site from Railway:

Create `apps/web/server.js`:
```javascript
import express from 'express';
const app = express();
app.use(express.static('dist'));
app.listen(process.env.PORT || 3000);
```

Update `apps/web/package.json`:
```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

## Deployment Workflow

### Initial Setup

```bash
# 1. Login
railway login

# 2. Create project
railway init

# 3. Deploy API
cd apps/server
railway link
railway up

# 4. Set environment variables
# ... set service URLs and API keys
```

### Continuous Deployment

Railway automatically deploys on git push if connected to GitHub:

1. Connect GitHub repo in Railway dashboard
2. Railway watches your branch
3. Auto-deploys on push

Or deploy manually:
```bash
railway up
```

## Monitoring

```bash
# View logs
railway logs

# View logs for specific service
railway logs --service soundscape-api

# View metrics
railway status
```

## Troubleshooting

### Build Fails

```bash
# Check logs
railway logs

# Test build locally
./apps/server/railway-build.sh
```

### Service Not Starting

```bash
# Check logs
railway logs --tail

# Verify start command
railway variables
# Check PORT is set (Railway sets this automatically)
```

## Migration from Render

1. **Export environment variables from Render:**
   - Copy all env vars from Render dashboard

2. **Set in Railway:**
   ```bash
   railway variables set KEY=value
   ```

3. **Update build scripts:**
   - Railway uses different build detection
   - Scripts are already created in `railway-build.sh`

4. **Deploy:**
   ```bash
   railway up
   ```

## Cost Comparison

- **Railway**: Pay-as-you-go, $5/month credit, then usage-based
- **Render**: Free tier available, then $7/month per service

Railway is often cheaper for low-traffic apps.

## Next Steps

- Set up custom domains
- Configure auto-deploy from GitHub
- Set up monitoring and alerts
- Configure staging environment

