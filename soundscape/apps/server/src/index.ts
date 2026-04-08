import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import swaggerUi from 'swagger-ui-express';
import { appRouter } from '@soundscape/api';
import { createContext } from './context.js';
import { generateOpenApiDocument, createOpenApiHttpHandler } from 'trpc-openapi';

const app = express();
const server = createServer(app);

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.WEB_APP_URL, // Production web app URL
].filter(Boolean) as string[];

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

// Store connected clients with metadata
const clients = new Map<string, { ws: any; type: 'web' | 'extension' }>();

wss.on('connection', (ws, _req) => {
  const clientId = Math.random().toString(36).substring(7);
  console.log(`Client connected: ${clientId}`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Register client type
      if (data.type === 'register') {
        clients.set(clientId, {
          ws,
          type: data.clientType as 'web' | 'extension',
        });
        console.log(`Client ${clientId} registered as ${data.clientType}`);
        return;
      }

      // Broadcast message to all clients except sender
      console.log(`Message from ${clientId}:`, data);

      clients.forEach((client, id) => {
        if (id !== clientId && client.ws.readyState === 1) {
          // 1 = OPEN
          client.ws.send(
            JSON.stringify({
              ...data,
              from: clients.get(clientId)?.type || 'unknown',
              timestamp: new Date().toISOString(),
            })
          );
        }
      });
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client disconnected: ${clientId}`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
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



