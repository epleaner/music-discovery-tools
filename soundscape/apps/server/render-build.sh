#!/bin/bash
set -e

echo "🔨 Building Soundscape server..."

# Install dependencies (skip postinstall scripts to avoid extension issues)
echo "📦 Installing dependencies..."
pnpm install --ignore-scripts

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
pnpm --filter @soundscape/server build

echo "✅ Build complete!"

