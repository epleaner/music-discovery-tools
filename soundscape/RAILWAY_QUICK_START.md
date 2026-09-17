# Railway Quick Start Guide

Since Railway CLI requires interactive prompts, here's the step-by-step process:

## 1. Add PostgreSQL Database

From project root:

```bash
railway add --database postgres
# Select "PostgreSQL" when prompted
```

Or do it via Railway dashboard:

- Go to https://railway.app
- Open your "soundscape" project
- Click "New" → "Database" → "Add PostgreSQL"

## 2. Deploy Backend API

```bash
cd apps/server
railway link
# Select your project when prompted
railway up
```

This will:

- Auto-create a service for the server
- Build and deploy using railway-build.sh
- Start with `pnpm --filter @soundscape/server start`

## 3. Set Environment Variables for API

```bash
cd apps/server
railway variables set NODE_ENV=production
railway variables set PORT=$PORT
```

After web is deployed, set:

```bash
railway variables set API_BASE_URL=https://your-api.railway.app
railway variables set WEB_APP_URL=https://your-web.railway.app
```

## 4. Deploy Web App

```bash
cd apps/web
railway link
# Select your project when prompted
railway up
```

This will:

- Auto-create a service for the web app
- Build using railway-build.sh
- Start Express server with `pnpm --filter @soundscape/web start`

## 5. Set Environment Variables for Web

```bash
cd apps/web
railway variables set VITE_API_URL=https://your-api.railway.app
railway variables set VITE_LASTFM_API_KEY=your_key_here
railway variables set PORT=$PORT
```

## 6. Get Service URLs

```bash
# Get API URL
cd apps/server
railway domain

# Get Web URL
cd ../web
railway domain
```

## Monitoring

```bash
# View logs
railway logs --tail

# View logs for specific service
cd apps/server
railway logs --tail

cd ../web
railway logs --tail
```

## Alternative: Use Railway Dashboard

If CLI prompts are problematic:

1. Go to https://railway.app
2. Open your "soundscape" project
3. Click "New" → "GitHub Repo"
4. Select your repository
5. Configure:
   - **Root Directory**: `apps/server` (for API) or `apps/web` (for web)
   - **Build Command**: (auto-detected or use build script)
   - **Start Command**: `pnpm start`
6. Add environment variables in dashboard
7. Deploy

## Next Steps

After both services are deployed:

1. Update API's `WEB_APP_URL` with web service URL
2. Update Web's `VITE_API_URL` with API service URL
3. Sign in to the deployed web UI, generate an agent token, and start the local
   agent with the API's `SCRAPE_AGENT_WS_URL`.
4. Test the deployment
