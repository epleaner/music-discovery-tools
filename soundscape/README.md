# Soundscape

A modern monorepo infrastructure for browser extension and web app development with shared components and TypeScript support.

## Architecture

This monorepo uses **Turborepo** for build orchestration and **pnpm** for package management. It provides a clean foundation for:

### Apps

- **`apps/extension`** - WXT-based browser extension (Chrome, Firefox, Safari)
- **`apps/web`** - SolidJS web application

### Packages

- **`packages/ui`** - Shared React components with TailwindCSS utilities
- **`packages/utils`** - Shared utility functions
- **`packages/types`** - Shared TypeScript type definitions

## Features

- ✅ **Cross-browser extension support** - Single codebase for Chrome, Firefox, and Safari
- ✅ **Shared component infrastructure** - Ready for reusable UI components between extension and web app
- ✅ **TypeScript throughout** - Full type safety across all packages
- ✅ **TailwindCSS** - Consistent styling with design tokens
- ✅ **Hot reload** - Fast development experience
- ✅ **Modern tooling** - WXT, SolidJS, Turborepo, pnpm

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install

# Start development servers for all apps
pnpm dev

# Or start individual apps
pnpm --filter @soundscape/extension dev
pnpm --filter @soundscape/web dev
```

### Building

```bash
# Build all apps and packages
pnpm build

# Build extension for specific browsers
pnpm --filter @soundscape/extension build:firefox
pnpm --filter @soundscape/extension build:safari
```

## Development

### Extension Development

The browser extension is built with **WXT** (Web Extension Toolkit):

```bash
cd apps/extension

# Chrome development
pnpm dev

# Firefox development
pnpm dev:firefox

# Safari development
pnpm dev:safari
```

Extension includes:

- Popup interface (React + TailwindCSS)
- Background script for persistent functionality
- Content script for web page interaction
- Cross-browser manifest generation

### Web App Development

The web app is built with **SolidJS**:

```bash
cd apps/web
pnpm dev
```

Web app includes:

- SolidJS with fine-grained reactivity
- TailwindCSS styling
- Shared component compatibility

### Shared Packages

All shared packages support hot reload during development:

```bash
# Watch mode for UI components
pnpm --filter @soundscape/ui dev

# Watch mode for utilities
pnpm --filter @soundscape/utils dev
```

## Project Structure

```
soundscape/
├── apps/
│   ├── extension/          # WXT browser extension
│   │   ├── entrypoints/    # Extension entry points
│   │   │   ├── popup/      # Extension popup (React)
│   │   │   ├── background.ts
│   │   │   └── content.ts
│   │   ├── wxt.config.ts   # WXT configuration
│   │   └── tailwind.config.js
│   └── web/                # SolidJS web app
│       ├── src/            # App source
│       ├── vite.config.ts
│       └── tailwind.config.js
├── packages/
│   ├── ui/                 # Shared React components
│   │   └── src/lib/utils.ts # TailwindCSS utilities
│   ├── utils/              # Shared utilities
│   │   └── src/index.ts
│   └── types/              # Shared TypeScript types
│       └── src/index.ts
├── turbo.json             # Turborepo configuration
├── pnpm-workspace.yaml    # pnpm workspace configuration
└── tsconfig.json          # Root TypeScript config
```

## Technology Stack

- **Framework**: WXT (Extension), SolidJS (Web)
- **Language**: TypeScript
- **Styling**: TailwindCSS with shared design tokens
- **UI Components**: Ready for custom component library with class-variance-authority
- **Build Tool**: Turborepo
- **Package Manager**: pnpm
- **Bundler**: Vite (WXT & Web)

## Infrastructure Ready

This setup provides a clean foundation with:

- Cross-browser extension infrastructure
- React-based popup with TailwindCSS
- SolidJS web app with shared styling
- Monorepo structure for shared packages
- TypeScript configuration across all packages
- Hot reload development experience
- Production build optimization

Add your components, utilities, and types to the respective packages to start building your application.

## Scripts

```bash
# Development
pnpm dev              # Start all apps in development mode
pnpm build            # Build all apps and packages
pnpm lint             # Lint all packages
pnpm type-check       # Type check all packages
pnpm clean            # Clean all build outputs

# Individual package scripts
pnpm --filter @soundscape/extension dev
pnpm --filter @soundscape/web dev
pnpm --filter @soundscape/ui build
```

## Next Steps

1. Add your UI components to `packages/ui/src/components/`
2. Define shared types in `packages/types/src/index.ts`
3. Add utility functions to `packages/utils/src/index.ts`
4. Build your extension popup in `apps/extension/entrypoints/popup/`
5. Develop your web app in `apps/web/src/`

## License

MIT
