import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { appRouter } from '@soundscape/api';
import { createContext } from './context.js';

const app = express();
const server = createServer(app);

// CORS configuration
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'], // Vite dev servers
    credentials: true,
  })
);

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

wss.on('connection', (ws, req) => {
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
});

