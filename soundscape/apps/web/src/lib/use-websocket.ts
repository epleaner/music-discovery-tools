import { createSignal, onCleanup, onMount } from 'solid-js';
import { webWs } from './websocket';

interface WebSocketMessage {
  type: string;
  data?: any;
  from?: 'web' | 'extension';
  timestamp?: string;
}

/**
 * SolidJS hook for WebSocket communication
 * Returns [connected, send, messages]
 */
export function useWebSocket() {
  const [isConnected, setIsConnected] = createSignal(false);
  const [messages, setMessages] = createSignal<WebSocketMessage[]>([]);

  onMount(() => {
    // Connect to WebSocket
    webWs.connect();
    setIsConnected(webWs.getConnectionStatus());

    // Subscribe to connection changes
    const unsubConnection = webWs.onConnectionChange((connected) => {
      setIsConnected(connected);
    });

    // Subscribe to messages
    const unsubMessages = webWs.onMessage((message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Cleanup on unmount
    onCleanup(() => {
      unsubConnection();
      unsubMessages();
      webWs.disconnect();
    });
  });

  const send = (message: Omit<WebSocketMessage, 'from' | 'timestamp'>) => {
    webWs.send(message);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return {
    isConnected,
    messages,
    send,
    clearMessages,
  };
}

/**
 * Hook to listen for specific message types
 */
export function useWebSocketListener(
  messageType: string,
  handler: (message: WebSocketMessage) => void
) {
  onMount(() => {
    const unsubMessages = webWs.onMessage((message) => {
      if (message.type === messageType) {
        handler(message);
      }
    });

    onCleanup(() => {
      unsubMessages();
    });
  });
}


