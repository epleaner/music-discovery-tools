import express from 'express';
import cors from 'cors';
import type { Request as ExpressRequest } from 'express';
import { createServer } from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { handleAsNodeRequest } from 'cloudflare:node';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { generateOpenApiDocument, createOpenApiHttpHandler } from 'trpc-openapi';
import { appRouter } from '@soundscape/api';
import { createScrapesDb } from '@soundscape/scrapes-db';
import { createAuthRouter } from './auth.js';
import { createContext } from './context.js';
import { allowsBrowserOrigin } from './cors-origin.js';
import { AgentBroker } from './agent-broker.js';

export interface Env {
  DB: D1Database;
  AGENT_BROKER: DurableObjectNamespace<AgentBroker>;
  ASSETS: Fetcher;
  SCRAPE_LEASE_MS?: string;
}
export { AgentBroker };
export const requestEnv = new AsyncLocalStorage<{ env: Env; origin: string }>();

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    if (allowsBrowserOrigin(origin, requestEnv.getStore()!.origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use('/auth', createAuthRouter({
  getDb: () => createScrapesDb(requestEnv.getStore()!.env.DB),
  agentRegistry: {
    isConnected: ownerKey => requestEnv.getStore()!.env.AGENT_BROKER.getByName('agent-broker').connected(ownerKey),
    rotate: (userId, tokenHash) => requestEnv.getStore()!.env.AGENT_BROKER.getByName('agent-broker').rotate(userId, tokenHash),
  },
}));
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/api/openapi.json', (req, res) => res.json(generateOpenApiDocument(appRouter, {
  title: 'Soundscape API', version: '1.0.0',
  baseUrl: requestEnv.getStore()!.origin,
})));
const openApiHandler = createOpenApiHttpHandler({
  router: appRouter,
  createContext: ({ req }: { req: ExpressRequest }) => createContext(req),
  responseMeta: () => ({}),
  onError: ({ error }: { error: unknown }) => console.error('OpenAPI error:', error),
  maxBodySize: 10 * 1024 * 1024,
});
app.use('/api/rest', (req, res) => openApiHandler(req, res));
app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext: ({ req }) => createContext(req) }));

// The HTTP adapter dispatches API routes; WebSocket upgrades go directly to the
// hibernating DO, with no Worker-side WebSocket bridge or second registry.
const swaggerAssets: Record<string, true> = {
  '/api/index.html': true,
  '/api/index.css': true,
  '/api/swagger-ui-init.js': true,
  '/api/swagger-ui.css': true,
  '/api/swagger-ui-bundle.js': true,
  '/api/swagger-ui-standalone-preset.js': true,
  '/api/favicon-16x16.png': true,
  '/api/favicon-32x32.png': true,
};
const server = createServer(app);
server.listen(3001);
export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/ws') return env.AGENT_BROKER.getByName('agent-broker').fetch(request);
    if (path === '/api' || path === '/api/') {
      return env.ASSETS.fetch(new Request(new URL('/api/index.html', request.url), request));
    }
    if (swaggerAssets[path]) return env.ASSETS.fetch(request);
    if (/^\/(auth|trpc|api)(\/|$)/.test(path) || path === '/health') {
      return requestEnv.run({ env, origin: new URL(request.url).origin }, () => handleAsNodeRequest(3001, request));
    }
    return env.ASSETS.fetch(request);
  },
};
