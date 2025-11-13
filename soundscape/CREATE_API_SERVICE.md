# Creating the API Service in Railway

## Current Situation

You only see the PostgreSQL service because Railway created it automatically when you ran `railway add --database postgres`. The API service needs to be created separately.

## Solution: Create API Service via Dashboard

Since Railway CLI requires interactive prompts for service creation, use the dashboard:

### Steps:

1. **Go to Railway Dashboard**
   - Visit https://railway.app
   - Open your "soundscape" project

2. **Create New Service**
   - Click the **"New"** button (usually top right or in the services list)
   - Select **"GitHub Repo"** or **"Empty Service"**
   - If GitHub Repo:
     - Select your repository: `epleaner/music-discovery-tools`
     - Railway will auto-detect it's a Node.js project
   - If Empty Service:
     - You'll configure it manually

3. **Configure the Service**
   - **Name**: `soundscape-api` (or any name you prefer)
   - **Root Directory**: Leave empty or set to `.` (this is critical - must be monorepo root!)
   - **Build Command**: (auto-detected, or leave empty to use nixpacks.toml)
   - **Start Command**: `pnpm --filter @soundscape/server start`

4. **Link to Database**
   - In the service settings, go to **Variables**
   - Add variable: `DATABASE_URL`
   - Click "Reference" and select the PostgreSQL service
   - Railway will automatically populate the connection string

5. **Set Other Environment Variables**
   - `NODE_ENV=production`
   - `PORT` - Railway should set this automatically for web services, but if it doesn't appear, you can manually set it. The server code uses `process.env.PORT || 3001`, so it defaults to 3001 if not set. You can check if Railway set it by looking in the Variables tab.
   - `API_BASE_URL` and `WEB_APP_URL` (set after you get the service URL)

6. **Deploy**
   - Railway will automatically deploy when you connect the repo
   - Or click "Deploy" if you created an empty service

## Alternative: Use Railway CLI (if it works)

Try running from the monorepo root:

```bash
cd /Users/eli.pleaner/github/music-discovery-tools/soundscape
railway link  # Link to project
railway up    # This should create a service if one doesn't exist
```

But the dashboard method is more reliable for service creation.

