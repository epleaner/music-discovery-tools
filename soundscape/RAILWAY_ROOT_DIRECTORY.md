# Railway Root Directory Configuration

## Problem

Railway is deploying from `apps/server` as the root directory, which means it only has access to files in that directory. This causes issues because:

1. The monorepo workspace packages (`@soundscape/api`, etc.) are not available
2. The `pnpm-workspace.yaml` file is not in the deployed directory
3. pnpm can't resolve workspace dependencies

## Solution

Configure Railway to deploy from the **monorepo root** instead of `apps/server`.

### Option 1: Via Railway Dashboard (Recommended)

1. Go to https://railway.app
2. Open your "soundscape" project
3. Click on the "soundscape-api" service
4. Go to **Settings** → **Service**
5. Set **Root Directory** to: `.` (project root) or leave empty for root
6. Save and redeploy

### Option 2: Via Railway CLI

Unfortunately, Railway CLI doesn't have a direct command to set root directory. You need to:

1. Use the dashboard (Option 1), OR
2. Deploy from the monorepo root instead of `apps/server`

### Option 3: Deploy from Root

Instead of running `railway up` from `apps/server`, run it from the project root:

```bash
cd /path/to/soundscape  # monorepo root
railway link  # link to the service
railway up
```

Then update `nixpacks.toml` to use the correct build script path:

```toml
[phases.build]
cmds = ["bash /app/apps/server/railway-build.sh"]
```

## Current Workaround

The build script (`apps/server/railway-build.sh`) currently tries to navigate to the monorepo root, but this won't work if Railway only copies `apps/server` to the container.

**The proper fix is to configure Railway to use the monorepo root as the root directory.**

