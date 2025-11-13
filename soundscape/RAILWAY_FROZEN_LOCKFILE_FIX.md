# Fixing Railway's Automatic pnpm install --frozen-lockfile

## Problem

Railway is automatically running `pnpm install --frozen-lockfile --prefer-offline` before our build scripts, which fails because:
1. The lockfile might not be compatible with Railway's pnpm version
2. Railway's default behavior uses `--frozen-lockfile` in CI environments

## Solution

We've updated `nixpacks.toml` to skip the install phase, but Railway might still run its own install step.

### Option 1: Ensure pnpm-lock.yaml is committed (Recommended)

Make sure `pnpm-lock.yaml` is committed to the repository:

```bash
git add pnpm-lock.yaml
git commit -m "chore: commit pnpm-lock.yaml for Railway"
git push
```

### Option 2: Configure Railway to skip auto-install

In Railway dashboard:
1. Go to your service (soundscape-api or soundscape-web)
2. Settings → Build & Deploy
3. Look for "Install Command" or "Build Command" settings
4. If there's an auto-install option, disable it
5. Or set install command to: `echo "Skipping install - handled in build script"`

### Option 3: Update Railway service settings

Railway might have a setting to disable automatic dependency installation. Check:
- Service Settings → Build & Deploy
- Look for "Auto Install Dependencies" or similar
- Disable it if present

### Option 4: Use .railwayignore or build configuration

Railway might respect certain configuration files. Check Railway documentation for:
- `.railwayignore`
- Service-specific build settings
- Environment variables that control install behavior

## Current Configuration

All `nixpacks.toml` files now have:
```toml
[phases.install]
cmds = []
```

This tells Railway to skip the install phase and let our build scripts handle it with `--no-frozen-lockfile`.

## Verification

After fixing, check Railway build logs to confirm:
- ✅ No `pnpm install --frozen-lockfile` errors
- ✅ Build script runs `pnpm install --no-frozen-lockfile`
- ✅ Dependencies install successfully

