/**
 * WebSocket client for web application
 */

interface WebSocketMessage {
  type: string;
  data?: any;
  from?: 'web' | 'extension';
  timestamp?: string;
}

class WebAppWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private messageHandlers: Set<(message: WebSocketMessage) => void> = new Set();
  private connectionHandlers: Set<(connected: boolean) => void> = new Set();
  private isConnected = false;

  private WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

  connect() {
    try {
      this.ws = new WebSocket(this.WS_URL);

      this.ws.onopen = () => {
        console.log('[Web] WebSocket connected');
        this.isConnected = true;
        this.notifyConnectionChange(true);

        // Register as web client
        this.send({
          type: 'register',
          clientType: 'web',
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log('[Web] WebSocket message received:', message);
          this.messageHandlers.forEach((handler) => handler(message));
        } catch (error) {
          console.error('[Web] Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[Web] WebSocket disconnected');
        this.isConnected = false;
        this.notifyConnectionChange(false);

        // Attempt to reconnect after 3 seconds
        this.reconnectTimeout = window.setTimeout(() => {
          console.log('[Web] Attempting to reconnect...');
          this.connect();
        }, 3000);
      };

      this.ws.onerror = (error) => {
        console.error('[Web] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[Web] Error creating WebSocket:', error);
    }
  }

  send(
    message:
      | WebSocketMessage
      | { type: string; clientType: string; [key: string]: any }
  ) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[Web] WebSocket is not connected');
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.ws?.close();
  }

  onMessage(handler: (message: WebSocketMessage) => void) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnectionChange(handler: (connected: boolean) => void) {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  private notifyConnectionChange(connected: boolean) {
    this.connectionHandlers.forEach((handler) => handler(connected));
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

export const webWs = new WebAppWebSocket();
