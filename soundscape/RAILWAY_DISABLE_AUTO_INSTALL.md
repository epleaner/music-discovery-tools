# Disabling Railway's Auto-Install

## Problem

Railway is automatically running `pnpm install --frozen-lockfile --prefer-offline` **before** our nixpacks.toml build phase runs. This happens because Railway detects a pnpm project and runs its own install step.

## Solution: Configure in Railway Dashboard

You need to disable Railway's automatic dependency installation in the service settings:

### For Each Service (soundscape-api and soundscape-web):

1. **Go to Railway Dashboard**
   - Open your "soundscape" project
   - Click on the service (soundscape-api or soundscape-web)

2. **Go to Settings → Build & Deploy**

3. **Look for "Install Command" or "Dependencies" section**
   - There should be an option to set a custom install command
   - Or an option to disable automatic installation

4. **Set Install Command to:**
   ```
   echo "Skipping Railway auto-install - handled in build script"
   ```
   Or leave it empty if Railway allows that.

5. **Alternative: Set to use --no-frozen-lockfile**
   If Railway doesn't allow skipping, set install command to:
   ```
   pnpm install --no-frozen-lockfile --ignore-scripts
   ```

6. **Save and Redeploy**

## Why This Happens

Railway's Nixpacks automatically detects pnpm projects and runs:
```bash
pnpm install --frozen-lockfile --prefer-offline
```

This happens **before** our `nixpacks.toml` install phase, so we can't override it from the config file.

## Current Workaround

Our build scripts handle installation with `--no-frozen-lockfile`, but Railway's pre-install step fails first. We need to either:
1. Disable Railway's auto-install (via dashboard)
2. Make the lockfile compatible with Railway's pnpm version
3. Set a custom install command that uses `--no-frozen-lockfile`

## Verification

After configuring, check build logs:
- ✅ No `ERR_PNPM_NO_LOCKFILE` errors
- ✅ Build script runs successfully
- ✅ Dependencies install in build phase

