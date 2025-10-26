import { createSignal, onCleanup, onMount } from 'solid-js';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

export interface WebSocketMessage {
  type: string;
  data?: any;
  from?: 'web' | 'extension';
  timestamp?: string;
}

export function createWebSocket() {
  const [isConnected, setIsConnected] = createSignal(false);
  const [lastMessage, setLastMessage] = createSignal<WebSocketMessage | null>(
    null
  );

  let ws: WebSocket | null = null;
  let reconnectTimeout: number | null = null;

  const connect = () => {
    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);

        // Register as web client
        ws?.send(
          JSON.stringify({
            type: 'register',
            clientType: 'web',
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log('WebSocket message received:', message);
          setLastMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);

        // Attempt to reconnect after 3 seconds
        reconnectTimeout = window.setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  };

  const send = (message: WebSocketMessage) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  const disconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    ws?.close();
  };

  // Auto-connect on mount
  onMount(() => {
    connect();
  });

  // Clean up on unmount
  onCleanup(() => {
    disconnect();
  });

  return {
    isConnected,
    lastMessage,
    send,
    reconnect: connect,
  };
}

