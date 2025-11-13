#!/bin/bash
set -e

echo "🔨 Building Soundscape server for Railway..."

# Railway deploys from apps/server, so we need to go to monorepo root
# Check if we're in apps/server directory
if [ -f "package.json" ] && [ -d "src" ] && [ ! -f "pnpm-workspace.yaml" ]; then
  # We're in apps/server, go to monorepo root
  echo "Current directory: $(pwd) - appears to be apps/server"
  echo "Navigating to monorepo root..."
  cd ../.. || exit 1
  echo "Changed to root directory: $(pwd)"
elif [ -f "pnpm-workspace.yaml" ]; then
  # We're already at root
  echo "Current directory: $(pwd) - already at monorepo root"
else
  echo "Warning: Could not determine directory structure"
  echo "Current directory: $(pwd)"
  echo "Contents:"
  ls -la
  exit 1
fi

# Verify we're at the root
if [ ! -f "pnpm-workspace.yaml" ]; then
  echo "❌ Error: pnpm-workspace.yaml not found. Not at monorepo root."
  echo "Current directory: $(pwd)"
  exit 1
fi

# Install dependencies including devDependencies (needed for Prisma CLI)
# Skip postinstall scripts to avoid extension issues
# Disable workspace root check to prevent warnings in CI
# Unset NODE_ENV to ensure devDependencies are installed
echo "📦 Installing dependencies..."
pnpm config set ignore-workspace-root-check true
NODE_ENV= pnpm install --ignore-scripts --prod=false --no-frozen-lockfile

# Generate Prisma client (this handles Prisma's postinstall needs)
echo "🗄️  Generating Prisma client..."
pnpm --filter @soundscape/db db:generate

# Build shared packages first (in dependency order)
echo "🏗️  Building shared packages..."
pnpm --filter @soundscape/types build
pnpm --filter @soundscape/utils build
# @soundscape/api doesn't need building - it's TypeScript source

echo "✅ Build complete! (Using tsx for runtime - no dist needed)"

