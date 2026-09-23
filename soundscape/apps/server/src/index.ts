import { randomUUID } from 'node:crypto';
import express from 'express';
import type { Request } from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import swaggerUi from 'swagger-ui-express';
import { appRouter } from '@soundscape/api';
import { createContext } from './context.js';
import {
  generateOpenApiDocument,
  createOpenApiHttpHandler,
} from 'trpc-openapi';
import type { ScrapeData, ScrapeResultMsg } from '@soundscape/types';
import { createScrapesDb, hashToken } from '@soundscape/scrapes-db';
import type { Database } from '@soundscape/scrapes-db';
import { AgentRegistry } from './ws-rooms.js';
import { createAuthRouter, ownerKeyForUser } from './auth.js';
import { ScrapeDispatcher } from './scrape-dispatcher.js';
import { setScrapeJobNotifier, setScrapesDb } from './scrapes-state.js';
import { z } from 'zod';

const wsMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('register'),
    token: z.string().min(1),
    clientType: z.literal('agent'),
  }),
  z.object({
    type: z.literal('scrape_result'),
    requestId: z.string().min(1),
    source: z.enum(['rym', 'bandcamp']),
    data: z.unknown(),
  }),
  z.object({
    type: z.literal('scrape_error'),
    requestId: z.string().min(1),
    message: z.string().min(1),
  }),
]);

type ParsedWsMessage = z.infer<typeof wsMessageSchema>;

function isScrapeData(
  value: unknown,
  source: ScrapeResultMsg['source']
): value is ScrapeData {
  if (!value || typeof value !== 'object' || !('kind' in value)) return false;
  return value.kind === source;
}

const app = express();
const server = createServer(app);
const registry = new AgentRegistry();
let scrapeStateDb: Database | undefined;
const dispatcher = new ScrapeDispatcher(registry, {
  getDb: () => scrapeStateDb,
  leaseMs: Number(process.env.SCRAPE_LEASE_MS) || 60_000,
});
setScrapeJobNotifier((ownerKey) =>
  dispatcher.dispatch(ownerKey).then(() => undefined)
);

async function initScrapesDb() {
  if (!process.env.DATABASE_URL) {
    console.warn('[scrapes] DATABASE_URL not set — scrape queue disabled');
    return;
  }
  try {
    const db = createScrapesDb(process.env.DATABASE_URL);
    await db.init();
    scrapeStateDb = db;
    setScrapesDb(db);
    console.log('[scrapes] Postgres queue enabled');
  } catch (err) {
    console.error('[scrapes] Failed to init scrape queue:', err);
  }
}

const scrapeInitialization = initScrapesDb();

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.WEB_APP_URL?.split(',') ?? []),
]
  .map((origin) => origin?.trim())
  .filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(
  '/auth',
  createAuthRouter({
    getDb: () => scrapeStateDb,
    agentRegistry: registry,
  })
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const API_BASE_URL =
  process.env.API_BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  `http://localhost:${process.env.PORT || 3001}`;
const openApiDocument = generateOpenApiDocument(appRouter, {
  title: 'Soundscape API',
  version: '1.0.0',
  baseUrl: API_BASE_URL,
});

app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument));
app.use('/api', swaggerUi.serve, swaggerUi.setup(openApiDocument));

const openApiHandler = createOpenApiHttpHandler({
  router: appRouter,
  createContext: ({ req }: { req: Request }) => createContext(req),
  responseMeta: () => ({}),
  onError: ({ error }: { error: unknown }) =>
    console.error('OpenAPI error:', error),
  maxBodySize: 10 * 1024 * 1024,
});
app.use('/api/rest', (req, res) => openApiHandler(req, res));
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req }) => createContext(req),
  })
);

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  const sender = {
    send: (json: string) => {
      if (ws.readyState === 1) ws.send(json);
    },
  };

  ws.on('message', async (message) => {
    let parsed: ParsedWsMessage;
    try {
      const result = wsMessageSchema.safeParse(JSON.parse(message.toString()));
      if (!result.success) return;
      parsed = result.data;
    } catch {
      return;
    }

    if (parsed.type === 'register') {
      const db = scrapeStateDb;
      if (!db) {
        ws.close(1013, 'database unavailable');
        return;
      }
      const user = await db.getUserByAgentTokenHash(hashToken(parsed.token));
      if (!user) {
        ws.close(1008, 'invalid pairing passphrase');
        return;
      }
      const ownerKey = ownerKeyForUser(user.id);
      const agentId = randomUUID();
      registry.register(ownerKey, user.id, agentId, sender);
      await db.touchAgent(user.id);
      console.log(
        `[agent] registered ${agentId.slice(0, 8)}… for user ${user.username}`
      );
      void dispatcher.dispatch(ownerKey);
      return;
    }

    if (parsed.type === 'scrape_result') {
      if (!isScrapeData(parsed.data, parsed.source)) return;
      void dispatcher.handleResult(sender, parsed as ScrapeResultMsg);
      return;
    }

    void dispatcher.handleResult(sender, parsed);
  });

  ws.on('close', () => {
    const connection = registry.unregister(sender);
    console.log(
      `[agent] disconnected${connection ? ` ${connection.agentId.slice(0, 8)}…` : ''}`
    );
  });
  ws.on('error', (error) => console.error('WebSocket error:', error));
});

const PORT = process.env.PORT || 3001;
scrapeInitialization.then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`tRPC endpoint: http://localhost:${PORT}/trpc`);
    console.log(`Agent WebSocket endpoint: ws://localhost:${PORT}/ws`);
    console.log(`OpenAPI docs: http://localhost:${PORT}/api`);
    console.log(`OpenAPI JSON: http://localhost:${PORT}/api/openapi.json`);
    console.log(`REST API: http://localhost:${PORT}/api/rest`);
  });
});
