# LastFM Integration

This document describes the LastFM integration added to the Soundscape web app.

## Features

### 1. **Recent Tracks**

- View a user's listening history with pagination
- Shows track name, artist, album, artwork, and timestamp
- "Load More" button for infinite scroll-style loading

### 2. **Top Artists**

- Display user's top artists with configurable time periods:
  - All Time
  - Last 7 Days
  - Last Month
  - Last 3 Months
  - Last 6 Months
  - Last Year
- Shows artist artwork and play count
- Click on any artist to view similar artists

### 3. **Similar Artists**

- Discover similar artists based on LastFM's recommendation engine
- Shows match percentage for each recommendation
- Click on any similar artist to explore further

## Architecture

### Shared Packages

#### `@soundscape/types`

Contains all LastFM TypeScript interfaces:

- `Track`, `RecentTracksResponse`
- `Artist`, `TopArtistsResponse`
- `SimilarArtist`, `SimilarArtistsResponse`
- `TimePeriod` and `TIME_PERIOD_LABELS`

#### `@soundscape/utils`

Contains LastFM API utilities:

- `fetchRecentTracks(username, page, limit)`
- `fetchTopArtists(username, period, limit)`
- `fetchSimilarArtists(artistName, limit)`
- `setLastFMApiKey(key)` - Set the API key at runtime

### Web App Components

#### Resources (`src/lib/lastfm-resource.ts`)

SolidJS resources wrapping the API calls:

- `createRecentTracksResource` - Handles pagination and track accumulation
- `createTopArtistsResource` - Fetches top artists with time period
- `createSimilarArtistsResource` - Fetches similar artists

#### UI Components (`src/components/`)

- `UsernameInput` - Form for entering LastFM username
- `TrackList` - Display list of tracks with artwork and metadata
- `ArtistList` - Display grid of artists (works for both top and similar)

## Usage

1. **Set up API key**: Create `.env.local` with your LastFM API key (see ENV_SETUP.md)
2. **Enter username**: Type a LastFM username in the input field
3. **Explore**: Navigate between Recent Tracks, Top Artists, and Similar Artists tabs

## API Key Management

The API key is set at app initialization in `src/index.tsx`:

```typescript
import { setLastFMApiKey } from '@soundscape/utils';

const apiKey = import.meta.env.VITE_LASTFM_API_KEY;
if (apiKey) {
  setLastFMApiKey(apiKey);
}
```

This approach keeps the shared `@soundscape/utils` package environment-agnostic while allowing the web app (and potentially the extension) to configure the API key at runtime.

## Tech Stack

- **SolidJS**: Fine-grained reactivity for optimal performance
- **createResource**: SolidJS primitive for async data fetching
- **TailwindCSS**: Styling with design tokens
- **LastFM API**: Public API for music data


