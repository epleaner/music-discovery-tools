# Fixing Railpack's Automatic pnpm install --frozen-lockfile

## Problem

Railpack is automatically running `pnpm install --frozen-lockfile --prefer-offline` before our build script runs. This fails because:
1. The lockfile might be incompatible with Railway's pnpm version
2. Railway's default behavior uses `--frozen-lockfile` in CI environments

## Solution Options

### Option 1: Configure in Railway Dashboard (Recommended)

Since `railway.json` doesn't support `installCommand`, you need to set it in the Railway dashboard:

1. **Go to Railway Dashboard**
   - Open your project
   - Click on the service (soundscape-api or soundscape-web)

2. **Go to Settings → Build & Deploy**

3. **Find "Install Command" or "Dependencies" section**
   - Set Install Command to:
     ```
     pnpm install --no-frozen-lockfile --ignore-scripts
     ```

4. **Save and Redeploy**

### Option 2: Use railpack.toml (If Supported)

We've created a `railpack.toml` file in the root directory:

```toml
[phases.install]
cmds = ["pnpm install --no-frozen-lockfile --ignore-scripts"]
```

Railpack may or may not respect this file. If it doesn't work, use Option 1.

### Option 3: Ensure Lockfile Compatibility

The error shows: `WARN Ignoring not compatible lockfile at /app/pnpm-lock.yaml`

This suggests a pnpm version mismatch. Your `package.json` already specifies:
```json
"packageManager": "pnpm@8.12.0"
```

If Railway is using a different version, you may need to:
1. Regenerate the lockfile with pnpm 8.12.0 locally
2. Commit and push the updated lockfile

## Current Configuration

- ✅ `railpack.toml` created with install phase configuration
- ✅ `package.json` specifies `pnpm@8.12.0`
- ✅ `pnpm-lock.yaml` is committed to the repository
- ⚠️ Railway dashboard may need manual configuration

## Verification

After configuring, check Railway build logs:
- ✅ No `ERR_PNPM_NO_LOCKFILE` errors
- ✅ Install uses `--no-frozen-lockfile`
- ✅ Build script runs successfully

