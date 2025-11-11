# @soundscape/api-client

Auto-generated API client using Orval from OpenAPI specification.

## Generated Files

- `src/api.ts` - React Query hooks and HTTP request functions
- `src/models/` - TypeScript type definitions
- `src/mocks/` - MSW mock handlers

## Usage

### React Query (Extension)

```typescript
import { useGetHealth } from '@soundscape/api-client';

function MyComponent() {
  const { data, isLoading, error } = useGetHealth();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <div>Status: {data?.status}</div>;
}
```

### Fetch Client (Web App - SolidJS)

```typescript
import { getHealth } from '@soundscape/api-client/api';

const response = await getHealth();
console.log(response.status);
```

### MSW Mocks

```typescript
import { setupServer } from 'msw/node';
import { handlers } from '@soundscape/api-client/mocks';

const server = setupServer(...handlers);
```

## Regenerating

Run from the root:

```bash
pnpm api:generate:local
```

This fetches the OpenAPI spec from the running server and regenerates all client code.

