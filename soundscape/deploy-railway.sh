#!/bin/bash
# Railway Deployment Script
# Run this script step by step, or execute individual commands

set -e

echo "🚂 Railway Deployment for Soundscape"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if logged in
if ! railway whoami &>/dev/null; then
    echo "❌ Not logged in. Run: railway login"
    exit 1
fi

echo "✅ Logged in to Railway"
echo ""

# Step 1: Add PostgreSQL (requires interactive prompt)
echo "${YELLOW}Step 1: Add PostgreSQL Database${NC}"
echo "Run this command manually (requires interactive prompt):"
echo "  railway add --database postgres"
echo ""
read -p "Press Enter after you've added PostgreSQL, or Ctrl+C to cancel..."

# Step 2: Deploy API
echo ""
echo "${YELLOW}Step 2: Deploying Backend API...${NC}"
cd apps/server

# Link service (requires interactive prompt)
echo "Linking service (select your project when prompted)..."
railway link || {
    echo "Service linking requires interactive prompt."
    echo "Please run manually: cd apps/server && railway link"
    exit 1
}

# Set environment variables
echo "Setting environment variables..."
railway variables set NODE_ENV=production || true
DATABASE_URL=$(railway variables get DATABASE_URL 2>/dev/null || echo "")
if [ -n "$DATABASE_URL" ]; then
    railway variables set DATABASE_URL="$DATABASE_URL" || true
fi
railway variables set PORT=\$PORT || true

# Deploy
echo "Deploying API service..."
railway up

API_URL=$(railway domain 2>/dev/null | grep -o 'https://[^ ]*' | head -1 || echo "")
echo "${GREEN}✅ API deployed!${NC}"
if [ -n "$API_URL" ]; then
    echo "API URL: $API_URL"
    railway variables set API_BASE_URL="$API_URL" || true
fi

cd ../..

# Step 3: Deploy Web
echo ""
echo "${YELLOW}Step 3: Deploying Web App...${NC}"
cd apps/web

# Link service
echo "Linking service (select your project when prompted)..."
railway link || {
    echo "Service linking requires interactive prompt."
    echo "Please run manually: cd apps/web && railway link"
    exit 1
}

# Set environment variables
echo "Setting environment variables..."
if [ -n "$API_URL" ]; then
    railway variables set VITE_API_URL="$API_URL" || true
fi
railway variables set VITE_LASTFM_API_KEY="your_key_here" || echo "⚠️  Set VITE_LASTFM_API_KEY manually"
railway variables set PORT=\$PORT || true

# Deploy
echo "Deploying web service..."
railway up

WEB_URL=$(railway domain 2>/dev/null | grep -o 'https://[^ ]*' | head -1 || echo "")
echo "${GREEN}✅ Web app deployed!${NC}"
if [ -n "$WEB_URL" ]; then
    echo "Web URL: $WEB_URL"
fi

cd ../..

# Step 4: Update cross-references
echo ""
echo "${YELLOW}Step 4: Updating service URLs...${NC}"
if [ -n "$WEB_URL" ]; then
    cd apps/server
    railway variables set WEB_APP_URL="$WEB_URL" || true
    cd ../..
fi

echo ""
echo "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Run database migrations:"
echo "   cd apps/server && railway shell"
echo "   pnpm --filter @soundscape/db db:push"
echo ""
echo "2. Set VITE_LASTFM_API_KEY in web service:"
echo "   cd apps/web"
echo "   railway variables set VITE_LASTFM_API_KEY=your_actual_key"
echo ""
echo "3. View logs:"
echo "   railway logs --tail"

