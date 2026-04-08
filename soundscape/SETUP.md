# Setup Guide

## Initial Setup

### 1. Install Dependencies

```bash
cd soundscape
pnpm install
```

### 2. Set Up Database

```bash
# Create database environment file
# For local development, use a PostgreSQL connection string:
# DATABASE_URL="postgresql://user:password@localhost:5432/soundscape?schema=public"
echo 'DATABASE_URL="postgresql://user:password@localhost:5432/soundscape?schema=public"' > packages/db/.env

# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push
```

**Note:** Make sure PostgreSQL is running locally. You can use Docker:
```bash
docker run --name soundscape-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=soundscape -p 5432:5432 -d postgres
```

### 3. Configure Environment Variables

**Web App** - Create `apps/web/.env.local`:

```bash
VITE_LASTFM_API_KEY=your_lastfm_api_key
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001/ws
```

**Extension** - Create `apps/extension/.env`:

```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001/ws
```

### 4. Start Development

**Option A: Everything together**

```bash
pnpm dev
```

**Option B: Individual services** (recommended for debugging)

```bash
# Terminal 1 - Backend
pnpm dev:server

# Terminal 2 - Web App
pnpm dev:web

# Terminal 3 - Extension
pnpm dev:extension
```

### 5. Load Extension in Browser

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select `soundscape/apps/extension/.wxt/chrome-mv3` folder

## Testing the Setup

### Test Backend API (tRPC)

Open http://localhost:3001/health - should see `{"status":"ok",...}`

### Test Web App

1. Open http://localhost:3000
2. You should see the Soundscape web app
3. Check browser console - should see "WebSocket connected"

### Test Extension

1. Click the extension icon in Chrome toolbar
2. You should see "Soundscape Extension" popup
3. Connection status should show "Connected" (green dot)

### Test Real-Time Communication

**From Extension → Web App:**

1. Open extension popup
2. Type a message in the input field
3. Click "Send"
4. Check web app - message should appear in "Recent messages"

**From Web App → Extension:**

1. Open web app
2. Find the WebSocket Demo component (or add it to your app)
3. Type a message and send
4. Check extension popup - message should appear

**Test API Calls:**

- Click "Test API Connection" in extension popup
- Click "Health Check" button in web app
- Both should show successful API responses

## Troubleshooting

### WebSocket won't connect

- Make sure backend server is running on port 3001
- Check browser console for CORS errors
- Verify `VITE_WS_URL` matches server URL

### Prisma errors

```bash
# Regenerate client
pnpm db:generate

# Reset database (PostgreSQL)
# Option 1: Drop and recreate via psql
psql -U postgres -c "DROP DATABASE IF EXISTS soundscape;"
psql -U postgres -c "CREATE DATABASE soundscape;"
pnpm db:push

# Option 2: Use Prisma migrate reset (if using migrations)
pnpm db:migrate reset
```

### Extension won't load

- Make sure you ran `pnpm dev:extension` or `pnpm build` in extension directory
- Check that `.wxt` folder exists
- Try reloading the extension in chrome://extensions/

### Type errors in web app

```bash
# Rebuild all packages
pnpm build

# Or rebuild specific packages
pnpm --filter @soundscape/api build
pnpm --filter @soundscape/types build
```

## Development Workflow

### Adding a New API Endpoint

1. Edit `packages/api/src/router.ts`:

```typescript
export const appRouter = router({
  myNewEndpoint: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input, ctx }) => {
      // Use ctx.db for database access
      return { greeting: `Hello, ${input.name}!` };
    }),
});
```

2. Use in web app:

```typescript
const result = await trpc.myNewEndpoint.query({ name: 'World' });
```

3. Use in extension:

```typescript
const result = await trpc.myNewEndpoint.query({ name: 'Extension' });
```

### Adding Database Models

1. Edit `packages/db/prisma/schema.prisma`:

```prisma
model MyModel {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
}
```

2. Regenerate and push:

```bash
pnpm db:generate
pnpm db:push
```

3. Use in API:

```typescript
const items = await ctx.db.myModel.findMany();
```

### WebSocket Message Types

Define message types in `packages/types` for type safety:

```typescript
export interface CustomMessage {
  type: 'my_message_type';
  data: {
    // your data
  };
}
```

## Production Deployment

### Backend

1. Set `DATABASE_URL` to PostgreSQL connection string
2. Run migrations: `pnpm db:push`
3. Build: `pnpm --filter @soundscape/server build`
4. Start: `pnpm --filter @soundscape/server start`

### Web App

1. Build: `pnpm --filter @soundscape/web build`
2. Deploy `apps/web/dist` to your hosting (Vercel, Netlify, etc.)

### Extension

1. Build: `pnpm --filter wxt-react-starter build`
2. Package: `pnpm --filter wxt-react-starter zip`
3. Submit to Chrome Web Store

## Next Steps

See `project-plan.md` for feature roadmap and implementation order.
