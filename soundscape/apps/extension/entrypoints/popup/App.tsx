import React, { useState, useEffect } from 'react';
import { extensionWs } from '../../lib/websocket';
import { trpc } from '../../lib/trpc';

const App: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [testMessage, setTestMessage] = useState('');
  const [apiResponse, setApiResponse] = useState('');

  useEffect(() => {
    // Connect WebSocket
    extensionWs.connect();

    // Listen for connection changes
    const unsubConnection = extensionWs.onConnectionChange((connected) => {
      setIsConnected(connected);
    });

    // Listen for messages
    const unsubMessages = extensionWs.onMessage((message) => {
      setMessages((prev) => [message, ...prev].slice(0, 10));
    });

    return () => {
      unsubConnection();
      unsubMessages();
      extensionWs.disconnect();
    };
  }, []);

  const sendMessage = () => {
    if (testMessage.trim()) {
      extensionWs.send({
        type: 'test_message',
        data: { content: testMessage },
      });
      setTestMessage('');
    }
  };

  const testAPI = async () => {
    try {
      const result = await trpc.health.query();
      setApiResponse(JSON.stringify(result, null, 2));
    } catch (error) {
      setApiResponse(`Error: ${error}`);
    }
  };

  return (
    <div className='w-[400px] min-h-[500px] bg-bg'>
      <div className='p-4 border-b border-border'>
        <h1 className='text-base font-medium'>Soundscape Extension</h1>
        <div className='flex items-center gap-2 mt-2'>
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-600' : 'bg-red-600'
            }`}
          />
          <span className='text-xs text-fg-muted'>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className='p-4 space-y-4'>
        {/* Send Message */}
        <div className='space-y-2'>
          <label className='block text-xs text-fg-muted'>
            Send message to web app
          </label>
          <div className='flex gap-2'>
            <input
              type='text'
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder='Type a message...'
              className='flex-1 text-xs input'
            />
            <button
              onClick={sendMessage}
              disabled={!isConnected}
              className='px-3 py-1 text-xs btn-primary'>
              Send
            </button>
          </div>
        </div>

        {/* API Test */}
        <div className='space-y-2'>
          <button onClick={testAPI} className='w-full btn-secondary text-xs'>
            Test API Connection
          </button>
          {apiResponse && (
            <pre className='p-2 text-xs bg-bg-subtle border border-border overflow-auto max-h-32'>
              {apiResponse}
            </pre>
          )}
        </div>

        {/* Messages */}
        <div className='space-y-2'>
          <label className='block text-xs text-fg-muted'>
            Recent messages ({messages.length})
          </label>
          <div className='space-y-1 max-h-48 overflow-auto'>
            {messages.length === 0 ? (
              <div className='text-xs text-fg-subtle'>No messages yet</div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className='p-2 text-xs border border-border'>
                  <div className='font-medium'>
                    {msg.type}{' '}
                    <span className='text-fg-muted'>
                      from {msg.from || '?'}
                    </span>
                  </div>
                  {msg.data && (
                    <div className='mt-1 text-fg-muted'>
                      {JSON.stringify(msg.data)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
