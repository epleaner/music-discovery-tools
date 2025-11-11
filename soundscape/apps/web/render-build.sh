#!/bin/bash
set -e

echo "🔨 Building Soundscape web app..."

# Install dependencies (skip postinstall scripts to avoid extension issues)
echo "📦 Installing dependencies..."
pnpm install --ignore-scripts

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

