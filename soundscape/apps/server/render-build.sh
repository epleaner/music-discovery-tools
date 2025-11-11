#!/bin/bash
set -e

echo "🔨 Building Soundscape server..."

# Install dependencies including devDependencies (needed for Prisma CLI)
# Skip postinstall scripts to avoid extension issues
# Disable workspace root check to prevent warnings in CI
# Unset NODE_ENV to ensure devDependencies are installed
# Use --no-frozen-lockfile for CI environments
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

# Build server
echo "🚀 Building server..."
cd apps/server
echo "Current directory: $(pwd)"
echo "Running build..."
pnpm build

# Verify build output
echo "Checking build output..."
if [ ! -f "dist/index.js" ]; then
    echo "❌ Build failed: dist/index.js not found"
    echo "Current directory contents:"
    ls -la
    echo "Checking if dist exists:"
    ls -la dist/ 2>/dev/null || echo "dist/ directory does not exist"
    echo "Checking TypeScript compilation errors..."
    pnpm exec tsc --noEmit || true
    exit 1
fi

echo "✅ Build complete! Output:"
ls -la dist/
cd ../..

