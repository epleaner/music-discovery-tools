#!/bin/bash
set -e

echo "🔨 Building Soundscape server..."

# Install dependencies including devDependencies (needed for Prisma CLI)
# Skip postinstall scripts to avoid extension issues
# Disable workspace root check to prevent warnings in CI
# Unset NODE_ENV to ensure devDependencies are installed
echo "📦 Installing dependencies..."
pnpm config set ignore-workspace-root-check true
NODE_ENV= pnpm install --ignore-scripts --prod=false

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

