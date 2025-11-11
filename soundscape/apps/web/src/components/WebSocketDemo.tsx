import { Component, Show, For, createSignal } from 'solid-js';
import { createWebSocket } from '../lib/websocket';
import { trpc } from '../lib/trpc';

const WebSocketDemo: Component = () => {
  const ws = createWebSocket();
  const [testMessage, setTestMessage] = createSignal('');
  const [messages, setMessages] = createSignal<any[]>([]);
  const [apiResponse, setApiResponse] = createSignal<string>('');

  // Track messages
  const lastMessage = ws.lastMessage;
  const isConnected = ws.isConnected;

  // Add incoming messages to list
  const addMessage = (msg: any) => {
    setMessages((prev) => [msg, ...prev].slice(0, 10)); // Keep last 10
  };

  // Watch for new messages
  const unwatchedLastMessage = lastMessage();
  if (unwatchedLastMessage) {
    addMessage(unwatchedLastMessage);
  }

  const sendMessage = () => {
    const msg = testMessage().trim();
    if (msg) {
      ws.send({
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
        <div class='flex items-center gap-2'>
          <div
            class={`w-2 h-2 rounded-full ${
              isConnected() ? 'bg-green-600' : 'bg-red-600'
            }`}
          />
          <span class='text-xs text-fg-muted'>
            WebSocket: {isConnected() ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Send Message */}
      <div class='space-y-2'>
        <label class='block text-xs text-fg-muted'>
          Send message to extension
        </label>
        <div class='flex gap-2'>
          <input
            type='text'
            value={testMessage()}
            onInput={(e) => setTestMessage(e.currentTarget.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder='Type a message...'
            class='flex-1 text-xs input'
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected()}
            class='px-3 py-1 text-xs btn-primary'>
            Send
          </button>
        </div>
      </div>

      {/* API Test */}
      <div class='space-y-2'>
        <label class='block text-xs text-fg-muted'>Test tRPC API</label>
        <div class='flex gap-2'>
          <button onClick={testTRPC} class='px-3 py-1 text-xs btn-secondary'>
            Health Check
          </button>
          <button onClick={testEcho} class='px-3 py-1 text-xs btn-secondary'>
            Echo
          </button>
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
          Recent messages ({messages().length})
        </label>
        <div class='space-y-1 max-h-48 overflow-auto'>
          <Show
            when={messages().length > 0}
            fallback={
              <div class='text-xs text-fg-subtle'>No messages yet</div>
            }>
            <For each={messages()}>
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



