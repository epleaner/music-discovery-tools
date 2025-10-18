# AGENTS.md

## Project Overview

**Soundscape** is a music discovery application that integrates with Last.fm to provide listening history, top artists, and music recommendations. It consists of a SolidJS web application and a browser extension built with WXT, sharing code through a Turborepo monorepo architecture.

### Core Philosophy

- **Simplicity First**: Keep code minimal, readable, and maintainable
- **Hyper-Minimal UI**: Pure monochrome design (black/white/grays) with zero decoration
- **Type Safety**: Full TypeScript throughout with strict type checking
- **Shared Code**: Maximize code reuse between web and extension

## Technology Stack

### Monorepo & Build

- **Turborepo**: Build orchestration and caching
- **pnpm**: Package management (v8.12.0+)
- **Node.js**: v18+
- **TypeScript**: v5.3.0+ with strict mode

### Web App (`apps/web`)

- **Framework**: SolidJS (fine-grained reactivity)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom monochrome preset
- **Data Fetching**: SolidJS `createResource` primitives
- **API Integration**: Last.fm API via shared utils

### Browser Extension (`apps/extension`)

- **Framework**: React (WXT requirement)
- **Build Tool**: WXT (Web Extension Toolkit)
- **Styling**: Tailwind CSS (same preset as web)
- **Target Browsers**: Chrome, Firefox, Safari

### Shared Packages

- **`@soundscape/types`**: Shared TypeScript types (Last.fm responses, domain models)
- **`@soundscape/utils`**: Shared utilities (Last.fm API client, data grouping)
- **`@soundscape/ui`**: Tailwind preset and shared utilities

## Design System

### Monochrome Palette

```javascript
colors: {
  bg: {
    DEFAULT: '#ffffff',
    subtle: '#fafafa',
    muted: '#f5f5f5',
  },
  fg: {
    DEFAULT: '#000000',
    muted: '#737373',
    subtle: '#a3a3a3',
  },
  border: {
    DEFAULT: '#e5e5e5',
    hover: '#d4d4d4',
  },
  accent: {
    DEFAULT: '#000000',
    hover: '#262626',
  },
}
```

### Typography Scale

- **xs**: 11px (0.6875rem)
- **sm**: 13px (0.8125rem)
- **base**: 14px (0.875rem)

### Design Principles

- No shadows, no gradients, no colored accents
- Minimal spacing (use `p-2`, `gap-2` over larger values)
- Subtle borders (`border-border`)
- Compact layouts with high information density
- `+` / `−` indicators for expand/collapse states

## Project Structure

```
soundscape/
├── apps/
│   ├── extension/              # Browser extension (WXT + React)
│   │   ├── entrypoints/
│   │   │   ├── popup/          # Extension popup UI
│   │   │   ├── background.ts   # Service worker
│   │   │   └── content.ts      # Content script
│   │   ├── wxt.config.ts
│   │   └── tailwind.config.js  # Uses shared preset
│   └── web/                    # Web app (SolidJS + Vite)
│       ├── src/
│       │   ├── components/     # SolidJS components
│       │   ├── lib/            # Resource factories
│       │   └── styles/         # Global CSS
│       ├── index.html
│       ├── vite.config.ts
│       └── tailwind.config.js  # Uses shared preset
├── packages/
│   ├── types/                  # Shared TypeScript types
│   │   └── src/
│   │       ├── lastfm.ts       # Last.fm API types
│   │       └── index.ts
│   ├── utils/                  # Shared utilities
│   │   └── src/
│   │       ├── lastfm.ts       # API client functions
│   │       ├── recent-grouping.ts  # Data transformations
│   │       └── index.ts
│   └── ui/                     # Shared UI utilities
│       ├── src/
│       │   └── lib/utils.ts
│       └── tailwind.preset.js  # Shared design tokens
├── turbo.json                  # Turborepo config
├── pnpm-workspace.yaml         # Workspace definition
└── tsconfig.json               # Root TS config
```

## Development Guidelines

### Code Style

1. **Functional & Declarative**: Prefer functions over classes, composition over inheritance
2. **Type Everything**: Use explicit types, avoid `any`
3. **Named Exports**: Use named exports, not default exports (except for components)
4. **Async/Await**: Prefer `async/await` over raw promises
5. **Early Returns**: Return early to reduce nesting

### SolidJS Best Practices

```typescript
// ✅ Good: Use createSignal for local state
const [count, setCount] = createSignal(0);

// ✅ Good: Use createMemo for derived values
const doubled = createMemo(() => count() * 2);

// ✅ Good: Use createResource for async data
const [data] = createResource(userId, fetchUser);

// ❌ Bad: Don't destructure props (breaks reactivity)
const Component = ({ value }) => {
  /* ... */
};

// ✅ Good: Access props directly
const Component = (props) => {
  return <div>{props.value}</div>;
};

// ✅ Good: Use getters for derived props
const Component = (props) => {
  const doubled = () => props.value * 2;
  return <div>{doubled()}</div>;
};
```

### Component Patterns

```typescript
// Component structure (SolidJS)
import { Component, createSignal, Show, For } from 'solid-js';
import type { SomeType } from '@soundscape/types';

interface MyComponentProps {
  items: SomeType[];
  onItemClick?: (item: SomeType) => void;
}

const MyComponent: Component<MyComponentProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false);

  return (
    <div class='p-2 border-b border-border'>
      <Show when={props.items.length > 0}>
        <For each={props.items}>
          {(item) => (
            <div onClick={() => props.onItemClick?.(item)}>{item.name}</div>
          )}
        </For>
      </Show>
    </div>
  );
};

export default MyComponent;
```

### Styling Guidelines

```typescript
// ✅ Good: Use Tailwind utility classes
<div class='flex items-center gap-2 p-2 border-b border-border hover:bg-bg-subtle'>

// ✅ Good: Use design system colors
<div class='text-fg-muted bg-bg-subtle'>

// ❌ Bad: Don't use arbitrary values unless absolutely necessary
<div class='text-[#333333] p-[13px]'>

// ✅ Good: Compose utility classes, use @layer components for reusable patterns
// In globals.css:
@layer components {
  .btn {
    @apply px-3 py-1.5 text-sm font-medium transition-colors rounded;
  }
}
```

### Data Fetching (SolidJS)

```typescript
// ✅ Good: Create resource factories
export function createRecentTracksResource(username: () => string) {
  const [page, setPage] = createSignal(1);

  const [data] = createResource(
    () => ({ username: username(), page: page() }),
    async ({ username, page }) => {
      return await fetchRecentTracks(username, page);
    }
  );

  return {
    tracks: () => data()?.recenttracks.track || [],
    isLoading: () => data.loading,
    error: () => data.error,
    loadMore: () => setPage((p) => p + 1),
  };
}
```

### Last.fm API Integration

```typescript
// All API calls go through @soundscape/utils
import {
  fetchRecentTracks,
  fetchTopArtists,
  setLastFMApiKey,
} from '@soundscape/utils';

// Set API key once at app initialization
setLastFMApiKey(import.meta.env.VITE_LASTFM_API_KEY);

// Use API functions
const response = await fetchRecentTracks('username', 1, 50);
```

### Error Handling

```typescript
// ✅ Good: Descriptive errors with context
if (!username?.trim()) {
  throw new Error('Username is required');
}

// ✅ Good: Handle API errors gracefully
try {
  const data = await fetchRecentTracks(username);
  return data;
} catch (error) {
  console.error('Failed to fetch tracks:', error);
  throw error; // Let the UI handle display
}

// ❌ Bad: Silent failures
try {
  await doSomething();
} catch (e) {
  // nothing
}
```

## Common Patterns

### Expandable Lists

```typescript
const [expandedItems, setExpandedItems] = createSignal<Set<string>>(new Set());

const toggle = (key: string) => {
  setExpandedItems((prev) => {
    const next = new Set(prev);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    return next;
  });
};

const isExpanded = (key: string) => expandedItems().has(key);
```

### Relative Time Formatting

```typescript
const formatDate = (timestamp: string) => {
  const date = new Date(parseInt(timestamp) * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
};
```

## Environment Variables

### Web App (`.env.local`)

```bash
VITE_LASTFM_API_KEY=your_api_key_here
```

### Extension

- Store sensitive data in browser storage APIs
- Use WXT's built-in storage helpers

## Build & Deploy

### Development

```bash
# Start all apps
pnpm dev

# Start specific app
pnpm --filter @soundscape/web dev
pnpm --filter @soundscape/extension dev
```

### Building

```bash
# Build all
pnpm build

# Build specific target
pnpm --filter @soundscape/web build
pnpm --filter @soundscape/extension build:firefox
```

### Type Checking

```bash
# Check all packages
pnpm type-check

# Check specific package
pnpm --filter @soundscape/types type-check
```

## Testing Strategy

- **Unit Tests**: For utility functions and data transformations
- **Component Tests**: For complex UI logic
- **Integration Tests**: For API integrations
- **Manual Testing**: Use Playwright MCP for UI verification

## Adding New Features

### 1. Define Types First

```typescript
// packages/types/src/lastfm.ts
export interface NewFeatureType {
  id: string;
  name: string;
}
```

### 2. Add Utility Functions

```typescript
// packages/utils/src/feature.ts
export async function fetchNewFeature(id: string): Promise<NewFeatureType> {
  // Implementation
}
```

### 3. Create SolidJS Resource (Web)

```typescript
// apps/web/src/lib/feature-resource.ts
export function createFeatureResource(id: () => string) {
  const [data] = createResource(id, fetchNewFeature);
  return {
    /* ... */
  };
}
```

### 4. Build UI Components

```typescript
// apps/web/src/components/FeatureView.tsx
const FeatureView: Component = () => {
  // Implementation
};
```

## Troubleshooting

### Type Errors in Apps

```bash
# Rebuild shared packages
pnpm --filter @soundscape/types build
pnpm --filter @soundscape/utils build
```

### Tailwind Not Applying

- Check that component paths are in `tailwind.config.js` content array
- Verify preset is imported correctly
- Restart dev server after tailwind config changes

### SolidJS Reactivity Issues

- Don't destructure props
- Call signals as functions: `count()` not `count`
- Use `createMemo` for derived values, not computed variables

## Resources

- [SolidJS Documentation](https://www.solidjs.com/docs/latest)
- [WXT Documentation](https://wxt.dev/)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Last.fm API Documentation](https://www.last.fm/api)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Maintenance Notes

- **Keep It Simple**: Resist over-engineering
- **Minimize Dependencies**: Only add packages when truly needed
- **Document Patterns**: Update this file when establishing new patterns
- **Type Safety**: Never use `any` without a very good reason
- **Performance**: SolidJS is fast by default, don't optimize prematurely
