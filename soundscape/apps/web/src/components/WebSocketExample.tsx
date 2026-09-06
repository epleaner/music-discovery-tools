import { Component, For, Show } from 'solid-js';
import Button from './Button';
import EmptyState from './EmptyState';
import StatusIndicator from './StatusIndicator';
import { useWebSocket, useWebSocketListener } from '../lib/use-websocket';

/**
 * Example component demonstrating WebSocket usage
 * Remove this file once you understand the pattern
 */
const WebSocketExample: Component = () => {
  const { isConnected, messages, send, clearMessages } = useWebSocket();

  // Listen for specific message types
  useWebSocketListener('artist-selected', (message) => {
    console.log('Artist selected from extension:', message.data);
    // Handle artist selection from extension
  });

  const sendTestMessage = () => {
    send({
      type: 'test',
      data: { message: 'Hello from web app!' },
    });
  };

  const sendArtistSelection = (artistName: string) => {
    send({
      type: 'artist-selected',
      data: { artist: artistName },
    });
  };

  return (
    <div class='p-4 space-y-4'>
      {/* Connection Status */}
      <StatusIndicator
        status={isConnected() ? 'online' : 'offline'}
        label={isConnected() ? 'Connected' : 'Disconnected'}
        class="gap-2 text-xs text-fg-muted"
      />

      {/* Send Messages */}
      <div class='flex gap-2'>
        <Button onClick={sendTestMessage} variant="primary">
          Send Test Message
        </Button>
        <Button
          onClick={() => sendArtistSelection('Radiohead')}
          variant="secondary"
        >
          Send Artist Selection
        </Button>
      </div>

      {/* Message History */}
      <div class='space-y-2'>
        <div class='flex gap-2 justify-between items-center'>
          <h3 class='text-xs font-medium'>Messages ({messages().length})</h3>
          <Button onClick={clearMessages} variant="link" class="text-xs">
            Clear
          </Button>
        </div>

        <Show
          when={messages().length > 0}
          fallback={
            <EmptyState>No messages received yet</EmptyState>
          }>
          <div class='space-y-1'>
            <For each={messages()}>
              {(msg) => (
                <div class='p-2 text-xs rounded border border-border'>
                  <div class='flex gap-2 justify-between'>
                    <span class='font-medium'>{msg.type}</span>
                    <span class='text-fg-muted'>{msg.from}</span>
                  </div>
                  <Show when={msg.data}>
                    <pre class='mt-1 text-xs text-fg-muted'>
                      {JSON.stringify(msg.data, null, 2)}
                    </pre>
                  </Show>
                  <Show when={msg.timestamp}>
                    <div class='mt-1 text-xs text-fg-subtle'>
                      {new Date(msg.timestamp!).toLocaleTimeString()}
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default WebSocketExample;


