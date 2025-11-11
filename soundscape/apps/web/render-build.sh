#!/bin/bash
set -e

echo "🔨 Building Soundscape web app..."

# Install dependencies including devDependencies (needed for build tools)
# Skip postinstall scripts to avoid extension issues
# Disable workspace root check to prevent warnings in CI
# Unset NODE_ENV to ensure devDependencies are installed
# Use --no-frozen-lockfile for CI environments
# Note: Render runs installCommand first, but we need devDependencies
echo "📦 Installing dependencies (including devDependencies)..."
pnpm config set ignore-workspace-root-check true
if [ ! -d "node_modules" ] || [ ! -d "packages/db/node_modules/@prisma/client" ]; then
  NODE_ENV= pnpm install --ignore-scripts --prod=false --no-frozen-lockfile
fi

# Build shared packages first (in dependency order)
echo "🏗️  Building shared packages..."
pnpm --filter @soundscape/types build
pnpm --filter @soundscape/utils build
pnpm --filter @soundscape/ui build
# @soundscape/api doesn't need building - it's TypeScript source

# Build web app
echo "🌐 Building web app..."
pnpm --filter @soundscape/web build

echo "✅ Build complete!"

