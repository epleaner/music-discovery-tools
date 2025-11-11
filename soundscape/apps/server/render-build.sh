#!/bin/bash
set -e

echo "🔨 Building Soundscape server..."

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Generate Prisma client
echo "🗄️  Generating Prisma client..."
pnpm --filter @soundscape/db db:generate

# Build shared packages first (in dependency order)
echo "🏗️  Building shared packages..."
pnpm --filter @soundscape/types build
pnpm --filter @soundscape/utils build
# @soundscape/api doesn't need building - it's TypeScript source

# Build server
echo "🚀 Building server..."
pnpm --filter @soundscape/server build

echo "✅ Build complete!"

