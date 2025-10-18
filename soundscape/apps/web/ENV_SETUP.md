# Environment Setup

To use the LastFM integration, you need to set up your API key:

1. Get a LastFM API key from: https://www.last.fm/api/account/create
2. Create a `.env.local` file in `apps/web/` with:

```
VITE_LASTFM_API_KEY=your_actual_api_key_here
```

3. Restart the dev server if it's already running

The app will not work without a valid LastFM API key.


