# Railway Troubleshooting Guide

## Database Service Stuck in "Applying Changes"

If your database service is stuck in "Applying Changes" for more than 5-10 minutes, try these steps:

### 1. Check Service Status
- Go to the Railway dashboard
- Click on the `soundscape-db` service
- Check the "Deployments" tab to see if there's an active deployment
- Look at the logs to see if there are any error messages

### 2. Wait a Bit Longer
- Database services can take 5-15 minutes to start, especially on first deployment
- Railway needs to:
  - Allocate resources
  - Create volumes
  - Initialize PostgreSQL
  - Set up networking

### 3. Check for Errors
- Look at the service logs
- Common issues:
  - "Failed to allocate volume" - Volume creation issue
  - "Out of memory" - Resource limits
  - "Service timeout" - Railway infrastructure issue

### 4. Force Refresh
- Refresh the Railway dashboard page
- Sometimes the UI doesn't update in real-time

### 5. If Still Stuck After 15+ Minutes

**Option A: Cancel and Redeploy**
1. Go to the service
2. Click on the active deployment
3. Cancel it if possible
4. Click "Redeploy" or "Deploy"

**Option B: Delete and Recreate**
1. Delete the `soundscape-db` service
2. Create a new PostgreSQL database:
   - Via dashboard: "New" → "Database" → "PostgreSQL"
   - Via CLI: `railway add --database postgres`

**Option C: Check Railway Status**
- Visit https://status.railway.app
- Check if there are any ongoing incidents
- Railway infrastructure issues can cause delays

### 6. Verify Configuration
Make sure the database service has:
- ✅ No start command (should be empty for managed databases)
- ✅ Volume attached (Railway should auto-create this)
- ✅ Proper resource allocation

### 7. Contact Railway Support
If it's been stuck for 30+ minutes:
- Check Railway's status page
- Contact Railway support via their dashboard
- Include:
  - Service name
  - How long it's been stuck
  - Any error messages from logs

## Quick Checklist

- [ ] Waited at least 10-15 minutes
- [ ] Checked deployment logs for errors
- [ ] Verified no start command is set
- [ ] Refreshed the dashboard
- [ ] Checked Railway status page
- [ ] Tried redeploying
- [ ] Considered recreating the service

