# Setup Guide

## Initial Setup

### 1. Install Dependencies

```bash
cd soundscape
pnpm install
```

### 2. Configure Environment Variables

**Web App** - Create `apps/web/.env.local`:

```bash
VITE_LASTFM_API_KEY=your_lastfm_api_key
VITE_API_URL=http://localhost:3001
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
3. Verify that scrape status updates through HTTP polling.

### Test Extension

1. Click the extension icon in Chrome toolbar
2. You should see "Soundscape Extension" popup
3. Connection status should show "Connected" (green dot)

### Test scrape job communication

1. Start the API with `DATABASE_URL` configured.
2. Start the external desktop agent with an authenticated browser profile and
   the pairing token saved in the web app.
3. Create a scrape from the web app or `POST /api/rest/scrape/jobs`.
4. Confirm the API reports `queued`, then `running`, then `done` (or a visible
   `error`) at `/api/rest/scrape/jobs/{requestId}`.
5. Stop the agent, create another job, and confirm it remains `queued`; restart
   the agent and confirm it is eventually dispatched.

The extension's own WebSocket is separate from scrape-job orchestration.

## Troubleshooting

### Desktop agent won't receive jobs

- Confirm `SCRAPE_AGENT_WS_URL` points to the API `/ws` endpoint.
- Confirm its pairing token matches the token entered in the web app.
- Jobs created while it is offline remain queued in PostgreSQL.

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
    .query(async ({ input }) => {
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

1. Build: `pnpm --filter @soundscape/server build`
2. Start: `pnpm --filter @soundscape/server start`

### Web App

1. Build: `pnpm --filter @soundscape/web build`
2. Deploy `apps/web/dist` to your hosting (Vercel, Netlify, etc.)

### Extension

1. Build: `pnpm --filter wxt-react-starter build`
2. Package: `pnpm --filter wxt-react-starter zip`
3. Submit to Chrome Web Store

## Next Steps

See `project-plan.md` for feature roadmap and implementation order.
