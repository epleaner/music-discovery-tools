import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import swaggerUi from 'swagger-ui-express';
import { appRouter } from '@soundscape/api';
import { createContext } from './context.js';
import { generateOpenApiDocument, createOpenApiHttpHandler } from 'trpc-openapi';
import type { BridgeMessage } from '@soundscape/types';
import { Rooms } from './ws-rooms.js';
import { isUrlAllowed } from './scrape-allowlist.js';
import { createScrapesDb, hashToken } from '@soundscape/scrapes-db';
import type { ScrapeData, ScrapeSource } from '@soundscape/types';
import { setScrapesDb } from './scrapes-state.js';

// Filled in by the persistence task; default no-ops.
export const scrapeHooks: {
  onAccepted?: (a: { token: string; requestId: string; source: string; url: string }) => void;
  onResult?: (a: { requestId: string; data: unknown }) => void;
  onError?: (a: { requestId: string; error: string }) => void;
} = {};

async function initScrapesDb() {
  if (!process.env.DATABASE_URL) {
    console.warn('[scrapes] DATABASE_URL not set — scrape persistence disabled');
    return;
  }
  try {
    const db = createScrapesDb(process.env.DATABASE_URL);
    await db.init();
    setScrapesDb(db);
    console.log('[scrapes] Postgres persistence enabled');

    scrapeHooks.onAccepted = ({ token, requestId, source, url }) => {
      db.createPending({ id: requestId, tokenHash: hashToken(token), source: source as ScrapeSource, url })
        .catch((err) => console.error('[scrapes] createPending', err));
    };
    scrapeHooks.onResult = ({ requestId, data }) => {
      db.markDone({ id: requestId, data: data as ScrapeData })
        .catch((err) => console.error('[scrapes] markDone', err));
    };
    scrapeHooks.onError = ({ requestId, error }) => {
      db.markError({ id: requestId, error })
        .catch((err) => console.error('[scrapes] markError', err));
    };
  } catch (err) {
    console.error('[scrapes] Failed to init scrapes DB — persistence disabled:', err);
  }
}

void initScrapesDb();

const app = express();
const server = createServer(app);

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  // Production web app origins. WEB_APP_URL may be a comma-separated list
  // (e.g. the custom domain plus the railway.app URL).
  ...(process.env.WEB_APP_URL?.split(',') ?? []),
]
  .map((origin) => origin?.trim())
  .filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Generate OpenAPI document
const API_BASE_URL =
  process.env.API_BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  `http://localhost:${process.env.PORT || 3001}`;

const openApiDocument = generateOpenApiDocument(appRouter, {
  title: 'Soundscape API',
  version: '1.0.0',
  baseUrl: API_BASE_URL,
});

// OpenAPI JSON endpoint
app.get('/api/openapi.json', (req, res) => {
  res.json(openApiDocument);
});

// Swagger UI
app.use('/api', swaggerUi.serve, swaggerUi.setup(openApiDocument));

// REST API endpoints (OpenAPI)
const openApiHandler = createOpenApiHttpHandler({
  router: appRouter,
  createContext,
  responseMeta: () => ({}),
  onError: ({ error }: { error: unknown }) => {
    console.error('OpenAPI error:', error);
  },
  maxBodySize: 10 * 1024 * 1024, // 10MB
});

app.use('/api/rest', (req, res) => {
  openApiHandler(req, res);
});

// tRPC middleware
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// WebSocket server for real-time communication
const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Rooms();
// Per-token rate limiting: map of token -> list of accepted scrape timestamps
const scrapeTimestamps = new Map<string, number[]>();
// Pending timeout handles keyed by requestId
const pendingTimeouts = new Map<string, NodeJS.Timeout>();

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const SCRAPE_TIMEOUT_MS = 30_000;

wss.on('connection', (ws) => {
  let connectionToken: string | null = null;
  const sender = { send: (json: string) => ws.send(json) };

  ws.on('message', (message) => {
    let data: BridgeMessage;
    try {
      data = JSON.parse(message.toString()) as BridgeMessage;
    } catch {
      return;
    }

    if (data.type === 'register') {
      const { token, clientType } = data;
      if (!token || (clientType !== 'web' && clientType !== 'menubar')) return;
      connectionToken = token;
      if (clientType === 'menubar') {
        rooms.registerMenubar(token, sender);
      } else {
        rooms.registerWeb(token, sender);
        sender.send(JSON.stringify({ type: 'menubar_presence', online: rooms.menubarFor(token) !== null }));
      }
      console.log(`Client registered as ${clientType} for token ${token.slice(0, 4)}…`);
      return;
    }

    if (data.type === 'scrape') {
      const { requestId, source, url } = data;
      const token = connectionToken;
      if (!token) return;

      if (!isUrlAllowed(source, url)) {
        sender.send(JSON.stringify({ type: 'scrape_error', requestId, message: 'url not allowed' }));
        return;
      }

      // Rate limiting
      const now = Date.now();
      const timestamps = (scrapeTimestamps.get(token) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (timestamps.length >= RATE_LIMIT_MAX) {
        sender.send(JSON.stringify({ type: 'scrape_error', requestId, message: 'rate limited' }));
        return;
      }
      timestamps.push(now);
      scrapeTimestamps.set(token, timestamps);

      if (!rooms.sendToMenubar(token, data)) {
        sender.send(JSON.stringify({ type: 'scrape_error', requestId, message: 'menu bar offline' }));
        return;
      }

      scrapeHooks.onAccepted?.({ token, requestId, source, url });

      const timeout = setTimeout(() => {
        pendingTimeouts.delete(requestId);
        scrapeHooks.onError?.({ requestId, error: 'timeout' });
        rooms.sendToWebs(token, { type: 'scrape_error', requestId, message: 'timeout' });
      }, SCRAPE_TIMEOUT_MS);
      pendingTimeouts.set(requestId, timeout);
      return;
    }

    if (data.type === 'scrape_error') {
      const { requestId, message } = data;
      const token = connectionToken;
      if (!token) return;

      if (rooms.menubarFor(token) !== sender) return;

      const timeout = pendingTimeouts.get(requestId);
      if (timeout) {
        clearTimeout(timeout);
        pendingTimeouts.delete(requestId);
      }

      scrapeHooks.onError?.({ requestId, error: message });
      rooms.sendToWebs(token, { type: 'scrape_error', requestId, message });
      return;
    }

    if (data.type === 'scrape_result') {
      const { requestId } = data;
      const token = connectionToken;
      if (!token) return;

      if (rooms.menubarFor(token) !== sender) return;

      const timeout = pendingTimeouts.get(requestId);
      if (timeout) {
        clearTimeout(timeout);
        pendingTimeouts.delete(requestId);
      }

      scrapeHooks.onResult?.({ requestId, data: data.data });
      rooms.sendToWebs(token, { type: 'result_ready', requestId });
      return;
    }
  });

  ws.on('close', () => {
    rooms.unregister(sender);
    if (connectionToken) scrapeTimestamps.delete(connectionToken);
    console.log(`Client disconnected (token: ${connectionToken ? connectionToken.slice(0, 4) + '…' : 'unregistered'})`);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 tRPC endpoint: http://localhost:${PORT}/trpc`);
  console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`📚 OpenAPI docs: http://localhost:${PORT}/api`);
  console.log(`🔗 OpenAPI JSON: http://localhost:${PORT}/api/openapi.json`);
  console.log(`🌐 REST API: http://localhost:${PORT}/api/rest`);
});



