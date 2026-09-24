# Railway Deployment Status Guide

## Current Status

- ✅ **soundscape-api**: Deployed successfully
- ❌ **soundscape-db**: Failed (PostgreSQL service)
- ⏳ **soundscape-web**: Not created yet

## Fixing soundscape-db (PostgreSQL)

The database service failure is usually due to:

1. **Volume issues** - PostgreSQL needs a volume for data persistence
2. **Resource limits** - Not enough memory/CPU
3. **Configuration issues** - Missing environment variables

### Steps to Fix:

1. **Go to Railway Dashboard**
   - Open your "soundscape" project
   - Click on the failed "Postgres" or "soundscape-db" service

2. **Check the Logs**
   - Click on "View Logs" or "Deployments"
   - Look for error messages
   - Common issues:
     - "Failed to allocate volume"
     - "Out of memory"
     - "Connection refused"

3. **Common Fixes:**
   - **If volume issue**: Railway should auto-create volumes, but you can manually add one in Settings → Volumes
   - **If resource issue**: Upgrade your Railway plan or reduce resource usage
   - **If it's a transient error**: Try redeploying (click "Redeploy" button)

4. **Alternative: Recreate the Database**
   - Delete the failed service
   - Add a new PostgreSQL database: `railway add --database postgres`
   - Or via dashboard: "New" → "Database" → "PostgreSQL"

## Creating soundscape-web

The web service needs to be created. Since you're using Option C (Express server), follow these steps:

### Via Dashboard (Recommended):

1. **Go to Railway Dashboard**
   - Open your "soundscape" project
   - Click "New" → "GitHub Repo"

2. **Configure the Service**
   - **Repository**: Select `epleaner/music-discovery-tools`
   - **Name**: `soundscape-web`
   - **Root Directory**: `soundscape` (important - must point to monorepo root)
   - **Build Command**: (leave empty to use nixpacks.toml)
   - **Start Command**: `pnpm --filter @soundscape/web start`

3. **Set Environment Variables**
   - `VITE_API_URL` - Get this from your `soundscape-api` service URL
   - `VITE_LASTFM_API_KEY` - Your Last.fm API key
   - `PORT` - Railway should set this, but check if it's there

4. **Deploy**
   - Railway will auto-deploy when connected

### Via CLI (Alternative):

```bash
cd /Users/eli.pleaner/github/music-discovery-tools/soundscape/apps/web
railway link  # Link to project
railway up    # This should create the service
```

## Getting Service URLs

After services are running:

1. **Get API URL:**

   ```bash
   cd apps/server
   railway domain
   ```

2. **Get Web URL:**

   ```bash
   cd apps/web
   railway domain
   ```

3. **Update Environment Variables:**
   - In `soundscape-web`: Set `VITE_API_URL` to the API service URL
   - Start the local agent with `SCRAPE_AGENT_WS_URL`, copy its generated
     passphrase, and enter that passphrase on the web UI

## Next Steps

1. Create the web service (via dashboard or CLI)
2. Set environment variables for inter-service communication
