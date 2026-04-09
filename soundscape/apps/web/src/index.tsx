import { render } from 'solid-js/web';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import './styles/globals.css';
import App from './App';
import { setLastFMApiKey } from '@soundscape/utils';

// Set the LastFM API key from environment
const apiKey = import.meta.env.VITE_LASTFM_API_KEY;
if (apiKey) {
  setLastFMApiKey(apiKey);
}

const queryClient = new QueryClient();
const root = document.getElementById('root');

if (root) {
  render(
    () => (
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    ),
    root
  );
}
