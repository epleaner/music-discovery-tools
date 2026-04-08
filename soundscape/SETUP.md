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
VITE_WS_URL=ws://localhost:3001/ws
```

**Extension** - Create `apps/extension/.env`:

```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001/ws
```

**Newsletter ingest** - Create `apps/ingest/.env.local`:

```bash
cp apps/ingest/.env.example apps/ingest/.env.local
```

Then fill in the values you need:

```bash
NEWSLETTER_GMAIL_LABEL=music
NEWSLETTER_DB_PATH=../../data/newsletters.sqlite
NEWSLETTER_ENTITY_CONFIDENCE_THRESHOLD=0.8
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_REDIRECT_URI=
LLM_API_KEY=
LLM_MODEL=
```

Newsletter-specific setup:

1. In Gmail, create a label named `music`, or set `NEWSLETTER_GMAIL_LABEL` to your chosen label.
2. Apply that label only to newsletters you want Soundscape to ingest.
3. Leave `NEWSLETTER_DB_PATH` unset if you want the default SQLite DB at `soundscape/data/newsletters.sqlite`.
4. Gmail and LLM credentials are optional for `--dry-run`; they are documented here so the local config contract is complete.

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

### Test Newsletter Ingest Scaffold

```bash
bash scripts/run-newsletter-sync.sh --dry-run
pnpm --filter @soundscape/ingest start -- --sample apps/ingest/fixtures/sample-newsletter.json
```

Expected output includes:
- `Soundscape newsletter ingest scaffold`
- `mode=dry-run`
- `syncRunStatus=dry_run_completed`
- `dbPath=` with either the default `soundscape/data/newsletters.sqlite` path or your override
- `gmailQuery=` showing the configured label and sync cursor boundary
- `Soundscape newsletter ingest sample run`
- `mode=sample`
- `normalizedArtists=1`

### Use the Newsletter Panel

1. Start the app with `pnpm dev` or run the server and web app separately.
2. Enter a username so the main layout renders.
3. In the right-hand panel, click `Newsletters`.
4. Use the left column to browse newsletter messages.
5. Use the detail pane to inspect summaries, extracted entities, and links.

If the panel is empty, run the fixture ingest command or your local sync command first so the SQLite DB has newsletter rows.

### Daily runner usage

Use the wrapper directly for manual runs or scheduler hooks:

```bash
bash scripts/run-newsletter-sync.sh --dry-run
```

The wrapper forwards all arguments to `pnpm --filter @soundscape/ingest start -- ...`, so it is safe to use from cron or `launchd` once your preferred ingest flags are finalized.

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
