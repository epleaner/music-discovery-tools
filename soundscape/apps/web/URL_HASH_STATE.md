# URL Hash State Management

## Overview

The web app persists all UI state in the URL hash, making it easy to share specific views with others. State is automatically synchronized bidirectionally: changing UI updates the URL, and navigating back/forward restores the state.

## Persisted State

| Key        | Description                        | Example Values                |
| ---------- | ---------------------------------- | ----------------------------- |
| `username` | Last.fm username                   | `rj`, `johndoe`               |
| `view`     | Active tab                         | `recent`, `top`, `similar`    |
| `subview`  | Recent tab view type               | `tracks`, `albums`, `artists` |
| `period`   | Top artists time period            | `7day`, `1month`, `overall`   |
| `artist`   | Selected artist (for similar view) | `Radiohead`                   |

## Example URLs

### Recent tracks view

```
http://localhost:3000/#username=rj&view=recent&subview=tracks
```

### Top artists (last month)

```
http://localhost:3000/#username=rj&view=top&period=1month
```

### Albums view for a user

```
http://localhost:3000/#username=johndoe&view=recent&subview=albums
```

### Similar artists for a specific artist

```
http://localhost:3000/#username=rj&view=similar&artist=Radiohead
```

## Implementation

### Core Utilities (`@soundscape/utils`)

Located in `packages/utils/src/url-hash.ts`:

- **`parseHash()`** - Parse URL hash into key-value object
- **`stringifyHash()`** - Serialize state to hash format
- **`updateHash()`** - Update URL without reload
- **`getHashValue()`** - Get single value from hash
- **`setHashValue()`** - Set single value in hash
- **`mergeHashState()`** - Merge new state into existing

### SolidJS Hook (`apps/web`)

Located in `apps/web/src/lib/use-hash-state.ts`:

```typescript
const [state, updateState] = useHashState<AppState>({
  username: '',
  view: 'recent',
  subview: 'tracks',
  period: '7day',
  artist: '',
});
```

**Features:**

- Automatic URL sync on state changes
- Browser back/forward navigation support
- Type-safe state management
- Partial state updates

## Usage in Components

### Reading State

```typescript
const username = () => state().username;
const currentView = () => state().view;
```

### Updating State

```typescript
// Single field update
updateState({ view: 'top' });

// Multiple fields
updateState({
  username: 'newuser',
  view: 'recent',
  subview: 'tracks',
});
```

### Navigation Events

The hook automatically listens for `hashchange` events, so browser navigation (back/forward) automatically updates the app state.

## Sharing URLs

Users can copy the URL at any time and share it with others. When opened, the app will restore the exact state including:

- Selected username
- Active tab
- Active sub-view
- Selected time period
- Selected artist (if viewing similar artists)

## Technical Details

### State Synchronization

1. Initial load: Parse hash → merge with defaults → set state
2. State changes: Update local state → serialize → update URL (replace)
3. Hash changes: Listen for `hashchange` → parse → update state

### URL Format

The hash uses standard URL search params format:

```
#key1=value1&key2=value2&key3=value3
```

Empty/undefined values are omitted from the URL to keep it clean.

### Browser History

By default, state changes use `replaceState` to avoid polluting browser history. This means each state change doesn't create a new history entry, but manual navigation still works correctly.

## Extending

To add new state fields:

1. Update `AppState` interface in `App.tsx`:

   ```typescript
   interface AppState extends Record<string, string> {
     username: string;
     view: string;
     // ... existing fields
     newField: string; // Add new field
   }
   ```

2. Add default value in `useHashState` call:

   ```typescript
   const [state, updateState] = useHashState<AppState>({
     // ... existing defaults
     newField: 'default',
   });
   ```

3. Use in components:
   ```typescript
   const newField = () => state().newField;
   updateState({ newField: 'newValue' });
   ```

That's it! The field will automatically sync with the URL.
