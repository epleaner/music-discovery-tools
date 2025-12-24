import { render } from 'solid-js/web';
import './styles/globals.css';
import App from './App';
import { setLastFMApiKey } from '@soundscape/utils';
import { AuthProvider } from './lib/auth-context';

// Set the LastFM API key from environment
const apiKey = import.meta.env.VITE_LASTFM_API_KEY;
if (apiKey) {
  setLastFMApiKey(apiKey);
}

const root = document.getElementById('root');

if (root) {
  render(
    () => (
      <AuthProvider>
        <App />
      </AuthProvider>
    ),
    root
  );
}
