import { defineConfig } from 'orval';

const API_URL = process.env.API_URL || 'http://localhost:3001';

export default defineConfig({
  api: {
    input: {
      target: `${API_URL}/api/openapi.json`,
    },
    output: {
      target: './packages/api-client/src/api.ts',
      schemas: './packages/api-client/src/models',
      client: 'react-query',
      mock: true,
      override: {
        mutator: {
          path: './packages/api-client/src/mutator.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useInfinite: false,
          useInfiniteQueryParam: 'limit',
        },
        operations: {
          'GET/health': {
            query: {
              useQuery: true,
            },
          },
          'GET/echo': {
            query: {
              useQuery: true,
            },
          },
          'POST/ping': {
            mutation: {
              useMutation: true,
            },
          },
        },
      },
    },
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
});

