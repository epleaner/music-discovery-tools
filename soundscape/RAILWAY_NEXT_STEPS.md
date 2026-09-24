# Railway Deployment - Next Steps

🎉 **Congratulations!** All services are deployed and running:

- ✅ **soundscape-api** - Backend API
- ✅ **soundscape-db** - PostgreSQL Database
- ✅ **soundscape-web** - Web Application

## Immediate Next Steps

### 1. Run Database Migrations

The database is running, but you need to create the schema:

````bash
### 2. Get Service URLs

**API URL:**
```bash
cd apps/server
railway domain
````

**Web URL:**

```bash
cd apps/web
railway domain
```

Or check in Railway dashboard:

- Click on each service
- Look for "Domains" or the service URL

### 3. Verify Environment Variables

**In `soundscape-api` service:**

- ✅ `NODE_ENV=production`
- ✅ `PORT` - Should be set by Railway
- ⚠️ `API_BASE_URL` - Set to your API service URL
- ⚠️ `WEB_APP_URL` - Set to your web service URL

**In `soundscape-web` service:**

- ✅ `VITE_API_URL` - Should be your API URL
- ✅ `VITE_LASTFM_API_KEY` - Your Last.fm API key
- ✅ `PORT` - Should be set by Railway

### 4. Test the Deployment

1. **Test API Health:**
   - Visit: `https://your-api-url.railway.app/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

2. **Test API Docs:**
   - Visit: `https://your-api-url.railway.app/api`
   - Should show Swagger UI

3. **Test Web App:**
   - Visit: `https://your-web-url.railway.app`
   - Should load the Soundscape web app

### 5. Update Cross-Service URLs

After getting both URLs, update:

**In `soundscape-api` Variables:**

```bash
railway variables set API_BASE_URL=https://your-api-url.railway.app
railway variables set WEB_APP_URL=https://your-web-url.railway.app
```

**In `soundscape-web` Variables:**

```bash
railway variables set VITE_API_URL=https://your-api-url.railway.app
```

**On the local desktop agent:**

1. Start the RYM menu-bar app with `SCRAPE_AGENT_WS_URL` set to the deployed
   API's WSS endpoint.
2. Choose **Pair with Soundscape Web…** and copy the locally generated passphrase.
3. Sign in to the deployed web UI and submit that passphrase through the
   **Browser helper** control.

For a menu-less agent, set a high-entropy `SCRAPE_AGENT_TOKEN` locally and
submit that same value through the web pairing form.

### 6. Monitor Logs

```bash
# API logs
cd apps/server
railway logs --tail

# Web logs
cd apps/web
railway logs --tail
```

## Troubleshooting

- Verify `VITE_API_URL` is set correctly
- Check CORS settings in API (should allow web app URL)
- Verify API service is running

### If services show errors:

- Check logs for specific error messages
- Verify all environment variables are set

## Success Checklist

- [ ] All three services are green/running
- [ ] Database migrations have been run
- [ ] API health endpoint returns OK
- [ ] Web app loads successfully
- [ ] Environment variables are set correctly
- [ ] Cross-service URLs are configured
- [ ] No errors in service logs

## What's Next?

Once everything is working:

1. Test the full application flow
2. Set up custom domains (optional)
3. Configure monitoring/alerts (optional)
4. Set up CI/CD for automatic deployments (optional)

🎊 **You're live on Railway!**
