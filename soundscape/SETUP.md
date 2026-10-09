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

### 3. Start Development

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

```

The desktop browser agent runs separately from the web client. The checked-in
Swift client lives in `../rym-menubar`; it keeps one dedicated RYM tab open
between jobs and reuses that tab for subsequent scrapes.

## Testing the Setup

### Test Backend API (tRPC)

Open http://localhost:3001/health - should see `{"status":"ok",...}`

### Test Web App

1. Open http://localhost:3000.
2. The app works without pairing. For scrape tools, choose **Account → Connect**.
   Both Connect and Browser helper offer **Download menu-bar app** and expandable
   **Installation steps**. The download requires GitHub access to this private
   repository; see the [menubar install guide](../rym-menubar/README.md#download).
3. Install and open the app, start its Chrome window, and log into RateYourMusic.
   If the API is not `localhost:3001`, use the launch command shown in the
   installation steps so both clients connect to the same backend.
4. Use the same passphrase in both clients. Copy it from **Pair with Soundscape
   Web…** in the app, or create and save one on the web and paste it into the app's
   pairing window.
5. Verify **Account → Browser helper** reports **Connected**. Status updates
   through HTTP polling.

### Test scrape job communication

1. Start the API with `DATABASE_URL` configured.
2. Create the pairing passphrase from either side. Both clients call
   `POST /auth/passphrase`:
   - Menu bar first: choose **Pair with Soundscape Web…**, generate and copy a
     passphrase, then enter it on Soundscape Web.
   - Web first: choose **Create new passphrase**, save and copy it, then paste
     it into **Pair with Soundscape Web…** and confirm it.
3. Store the passphrase in a password manager or another secure place. Scrape
   history is tied to it, and losing it means losing access to that history.
4. Log into RateYourMusic in the debug Chrome profile if prompted.
5. Create a scrape from the web app.
6. Confirm the API reports `queued`, then `running`, then `done` (or a visible
   `error`) at `/api/rest/scrape/jobs/{requestId}`.
7. Stop the agent, create another job, and confirm it remains `queued`; restart
   the agent and confirm it is eventually dispatched.

For a menu-less foreground daemon or a launchd service, use the advanced
environment-variable setup instead. Generate a high-entropy passphrase, submit
it through the web pairing form, and pass the same value to the agent:

```bash
cd ../rym-menubar
swift build -c debug
SCRAPE_AGENT_WS_URL=ws://localhost:3001/ws \
SCRAPE_AGENT_TOKEN='your-local-pairing-passphrase' \
.build/debug/RYMMenuBar --daemon
```

The launchd template is available at
`../rym-menubar/launchd/com.elipleaner.rym-browser-agent.plist`; replace its
placeholders without committing the token.

## Troubleshooting

### Local agent won't receive jobs

- Confirm `SCRAPE_AGENT_WS_URL` points to the API `/ws` endpoint.
- Confirm `SCRAPE_AGENT_TOKEN` matches the passphrase entered on Soundscape Web.
- Confirm the agent uses the intended warm browser profile.
- Jobs created while it is offline remain queued in PostgreSQL.

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

## Next Steps

See `project-plan.md` for feature roadmap and implementation order.
