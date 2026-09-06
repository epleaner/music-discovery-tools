import { Component, Show, For, createSignal } from 'solid-js';
import { useWebSocket } from '../lib/use-websocket';
import Input from './Input';
import Button from './Button';
import EmptyState from './EmptyState';
import StatusIndicator from './StatusIndicator';
import { trpc } from '../lib/trpc';
const WebSocketDemo: Component = () => {
  const { isConnected, messages, send } = useWebSocket();
  const [testMessage, setTestMessage] = createSignal('');
  const [apiResponse, setApiResponse] = createSignal<string>('');

  const sendMessage = () => {
    const msg = testMessage().trim();
    if (msg) {
      send({
        type: 'test_message',
        data: { content: msg },
      });
      setTestMessage('');
    }
  };

  const testTRPC = async () => {
    try {
      const result = await trpc.health.query();
      setApiResponse(JSON.stringify(result, null, 2));
    } catch (error) {
      setApiResponse(`Error: ${error}`);
    }
  };

  const testEcho = async () => {
    try {
      const result = await trpc.echo.query({ message: 'Hello from web app!' });
      setApiResponse(JSON.stringify(result, null, 2));
    } catch (error) {
      setApiResponse(`Error: ${error}`);
    }
  };

  return (
    <div class='p-4 space-y-4 border border-border bg-bg-subtle'>
      <div class='space-y-2'>
        <h3 class='text-sm font-medium'>Real-Time Communication Demo</h3>

        {/* Connection Status */}
        <StatusIndicator
          status={isConnected() ? 'online' : 'offline'}
          label={`WebSocket: ${isConnected() ? 'Connected' : 'Disconnected'}`}
          class="gap-2 text-xs text-fg-muted"
        />
      </div>

      {/* Send Message */}
      <div class='space-y-2'>
        <label class='block text-xs text-fg-muted'>
          Send message to extension
        </label>
        <div class='flex gap-2'>
          <Input
            type='text'
            value={testMessage()}
            onInput={(e) => setTestMessage(e.currentTarget.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder='Type a message...'
            class='flex-1'
          />
          <Button
            onClick={sendMessage}
            disabled={!isConnected()}
            variant="primary"
            class="px-3"
          >
            Send
          </Button>
        </div>
      </div>

      {/* API Test */}
      <div class='space-y-2'>
        <label class='block text-xs text-fg-muted'>Test tRPC API</label>
        <div class='flex gap-2'>
          <Button onClick={testTRPC} variant="secondary" class="px-3">
            Health Check
          </Button>
          <Button onClick={testEcho} variant="secondary" class="px-3">
            Echo
          </Button>
        </div>
        <Show when={apiResponse()}>
          <pre class='p-2 text-xs bg-bg border border-border overflow-auto max-h-32'>
            {apiResponse()}
          </pre>
        </Show>
      </div>

      {/* Messages */}
      <div class='space-y-2'>
        <label class='block text-xs text-fg-muted'>
          Recent messages ({Math.min(messages().length, 10)})
        </label>
        <div class='space-y-1 max-h-48 overflow-auto'>
          <Show
            when={messages().length > 0}
            fallback={
              <EmptyState>No messages yet</EmptyState>
            }>
            <For each={messages().slice(-10).reverse()}>
              {(msg) => (
                <div class='p-2 text-xs border border-border bg-bg'>
                  <div class='font-medium'>
                    {msg.type}{' '}
                    <span class='text-fg-muted'>from {msg.from || '?'}</span>
                  </div>
                  <Show when={msg.data}>
                    <div class='mt-1 text-fg-muted'>
                      {JSON.stringify(msg.data)}
                    </div>
                  </Show>
                  <Show when={msg.timestamp}>
                    <div class='mt-1 text-fg-subtle'>{msg.timestamp}</div>
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default WebSocketDemo;



