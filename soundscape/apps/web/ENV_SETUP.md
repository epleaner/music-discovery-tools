# Environment Setup

## LastFM

To use the LastFM integration, you need to set up your API key:

1. Get a LastFM API key from: https://www.last.fm/api/account/create
2. Create a `.env.local` file in `apps/web/` with:

```
VITE_LASTFM_API_KEY=your_actual_api_key_here
```

3. Restart the dev server if it's already running

The app will not work without a valid LastFM API key.

## Every Noise (CORSPROXY)

Every Noise genre lookup uses CORSPROXY's authenticated browser API.

1. Get a browser API key from [the CORSPROXY dashboard](https://console.corsproxy.io/).
2. Add it to the same `apps/web/.env.local` file:

```dotenv
VITE_CORSPROXY_API_KEY=your_corsproxy_browser_key
```

3. Restart the dev server. For the production preview, rebuild the web app with
   `pnpm --filter @soundscape/web build`, then reload the page.
4. For a hosted app, register the app's domain in the CORSPROXY dashboard, not
   `everynoise.com`. Localhost and `127.0.0.1` do not need domain registration.

The key is browser-visible in the built app and requests. Use a browser key
scoped to your app's domain, not a private server credential; do not commit
`.env.local`. Hosted builds must also receive `VITE_CORSPROXY_API_KEY` at build time.

Requests use `?key=...&url=<encoded Every Noise URL>`, without paid extraction
parameters. A missing key or failed request appears as a lookup error; “Genre
unavailable” means a successful response contained no matching genre map.
Key, domain, plan or upstream restrictions can still reject a configured request.
See [CORSPROXY setup and troubleshooting](https://corsproxy.io/docs/troubleshooting/).
