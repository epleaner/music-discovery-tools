#!/bin/bash
set -e

echo "🔨 Building Soundscape server for Railway..."

# Railway runs from /app (project root)
# The script is at apps/server/railway-build.sh, so we need to ensure we're at root
if [ ! -f "pnpm-workspace.yaml" ] && [ -f "apps/server/railway-build.sh" ]; then
  # We're at root already
  echo "Current directory: $(pwd)"
elif [ -f "../../pnpm-workspace.yaml" ]; then
  # We're in apps/server, go to root
  cd ../.. || exit 1
  echo "Changed to root directory: $(pwd)"
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

