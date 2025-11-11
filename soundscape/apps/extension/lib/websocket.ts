/**
 * WebSocket client for browser extension
 * Note: Extensions can't use native WebSocket directly in service workers,
 * so this is designed to work in popup/content scripts
 */

interface WebSocketMessage {
  type: string;
  data?: any;
  from?: 'web' | 'extension';
  timestamp?: string;
}

class ExtensionWebSocket {
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
        console.log('[Extension] WebSocket connected');
        this.isConnected = true;
        this.notifyConnectionChange(true);

        // Register as extension client
        this.send({
          type: 'register',
          clientType: 'extension',
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log('[Extension] WebSocket message received:', message);
          this.messageHandlers.forEach((handler) => handler(message));
        } catch (error) {
          console.error('[Extension] Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[Extension] WebSocket disconnected');
        this.isConnected = false;
        this.notifyConnectionChange(false);

        // Attempt to reconnect after 3 seconds
        this.reconnectTimeout = window.setTimeout(() => {
          console.log('[Extension] Attempting to reconnect...');
          this.connect();
        }, 3000);
      };

      this.ws.onerror = (error) => {
        console.error('[Extension] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[Extension] Error creating WebSocket:', error);
    }
  }

  send(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[Extension] WebSocket is not connected');
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

export const extensionWs = new ExtensionWebSocket();



