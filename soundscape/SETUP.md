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

1. Open http://localhost:3000
2. Create an account or sign in.
3. Verify that scrape status updates through HTTP polling.

### Test scrape job communication

1. Start the API with `DATABASE_URL` configured.
2. Sign in to the web app and open the Agent control.
3. Choose **Generate token**, then copy the token shown once.
4. Open the RYM menu-bar app, choose **Configure Soundscape agent…**, and
   paste the token. The app stores it in the macOS Keychain and reconnects.
5. Log into RateYourMusic in the debug Chrome profile if prompted.
6. Create a scrape from the web app.
7. Confirm the API reports `queued`, then `running`, then `done` (or a visible
   `error`) at `/api/rest/scrape/jobs/{requestId}`.
8. Stop the agent, create another job, and confirm it remains `queued`; restart
   the agent and confirm it is eventually dispatched.

For a menu-less foreground daemon or a launchd service, use the advanced
environment-variable setup instead:

```bash
cd ../rym-menubar
swift build -c debug
SCRAPE_AGENT_WS_URL=ws://localhost:3001/ws \
SCRAPE_AGENT_TOKEN='paste-token-here' \
.build/debug/RYMMenuBar --daemon
```

The launchd template is available at
`../rym-menubar/launchd/com.elipleaner.rym-browser-agent.plist`; replace its
placeholders without committing the token.

## Troubleshooting

### Local agent won't receive jobs

- Confirm `SCRAPE_AGENT_WS_URL` points to the API `/ws` endpoint.
- Confirm `SCRAPE_AGENT_TOKEN` was generated for the signed-in web account.
- Confirm the agent uses the same account's token and warm browser profile.
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
