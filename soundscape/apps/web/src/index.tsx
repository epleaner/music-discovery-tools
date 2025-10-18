import { render } from 'solid-js/web';
import './styles/globals.css';
import App from './App';

const root = document.getElementById('root');

if (root) {
  render(() => <App />, root);
}
