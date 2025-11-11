#!/bin/bash
set -e

echo "🔨 Building Soundscape web app..."

# Install dependencies including devDependencies (needed for build tools)
# Skip postinstall scripts to avoid extension issues
# Disable workspace root check to prevent warnings in CI
echo "📦 Installing dependencies..."
pnpm config set ignore-workspace-root-check true
pnpm install --ignore-scripts --include=dev

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

