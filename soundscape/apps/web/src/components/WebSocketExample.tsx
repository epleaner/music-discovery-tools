import { Component, For, Show } from 'solid-js';
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
      <div class='flex gap-2 items-center'>
        <div
          class={`w-2 h-2 rounded-full ${
            isConnected() ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span class='text-xs text-fg-muted'>
          {isConnected() ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Send Messages */}
      <div class='flex gap-2'>
        <button onClick={sendTestMessage} class='text-xs btn-primary'>
          Send Test Message
        </button>
        <button
          onClick={() => sendArtistSelection('Radiohead')}
          class='text-xs btn-secondary'>
          Send Artist Selection
        </button>
      </div>

      {/* Message History */}
      <div class='space-y-2'>
        <div class='flex gap-2 justify-between items-center'>
          <h3 class='text-xs font-medium'>Messages ({messages().length})</h3>
          <button
            onClick={clearMessages}
            class='text-xs text-fg-muted hover:text-fg'>
            Clear
          </button>
        </div>

        <Show
          when={messages().length > 0}
          fallback={
            <div class='text-xs text-fg-muted'>No messages received yet</div>
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


