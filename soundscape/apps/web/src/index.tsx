import { render } from 'solid-js/web';
import { HashRouter, Route } from '@solidjs/router';
import './styles/globals.css';
import App from './App';
import { setLastFMApiKey } from '@soundscape/utils';

// Set the LastFM API key from environment
const apiKey = import.meta.env.VITE_LASTFM_API_KEY;
if (apiKey) {
  setLastFMApiKey(apiKey);
}

const root = document.getElementById('root');

if (root) {
  render(
    () => (
      <HashRouter>
        <Route path="*" component={App} />
      </HashRouter>
    ),
    root
  );
}
