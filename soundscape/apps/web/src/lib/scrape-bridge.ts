import { createSignal } from 'solid-js';
import type { BridgeMessage, ScrapeQuery } from '@soundscape/types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

const [menubarOnline, setMenubarOnline] = createSignal(false);
const [connected, setConnected] = createSignal(false);
const [pendingResolve, setPendingResolve] = createSignal<ScrapeQuery | null>(null);
const [pendingScrapeUrl, setPendingScrapeUrl] = createSignal<{ source: 'rym' | 'bandcamp'; url: string; query?: ScrapeQuery } | null>(null);
const [refreshTick, setRefreshTick] = createSignal(0);

export function requestScrapeRefresh() {
  setRefreshTick((t) => t + 1);
}

export function requestResolveInPanel(q: ScrapeQuery) {
  setPendingResolve(q);
}

export function requestUrlScrapeInPanel(p: { source: 'rym' | 'bandcamp'; url: string; query?: ScrapeQuery }) {
  setPendingScrapeUrl(p);
}

type ResultReadyCb = (requestId: string) => void;
type ScrapeErrorCb = (requestId: string, message: string) => void;

const resultReadyCbs: Set<ResultReadyCb> = new Set();
const scrapeErrorCbs: Set<ScrapeErrorCb> = new Set();

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentToken: string | null = null;

function connect(token: string) {
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  currentToken = token;

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setConnected(true);
      ws!.send(JSON.stringify({ type: 'register', token, clientType: 'web' }));
    };

    ws.onmessage = (event) => {
      let msg: BridgeMessage;
      try {
        msg = JSON.parse(event.data as string) as BridgeMessage;
      } catch {
        return;
      }

      if (msg.type === 'menubar_presence') {
        setMenubarOnline(msg.online);
      } else if (msg.type === 'result_ready') {
        resultReadyCbs.forEach((cb) => cb(msg.requestId));
      } else if (msg.type === 'scrape_error') {
        scrapeErrorCbs.forEach((cb) => cb(msg.requestId, msg.message));
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setMenubarOnline(false);
      reconnectTimer = setTimeout(() => {
        if (currentToken) connect(currentToken);
      }, 3000);
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  } catch {
    // ignore
  }
}

export function initScrapeBridge(token: string) {
  connect(token);
}

export function disconnectScrapeBridge() {
  currentToken = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  setConnected(false);
  setMenubarOnline(false);
}

export function requestScrape(params: {
  source: 'rym' | 'bandcamp';
  url?: string;
  mode?: 'label' | 'related' | 'resolve';
  query?: ScrapeQuery;
}): string {
  const requestId = crypto.randomUUID();
  if (ws?.readyState !== WebSocket.OPEN) {
    setTimeout(() => scrapeErrorCbs.forEach((cb) => cb(requestId, 'connection lost')), 0);
    return requestId;
  }
  const msg: Record<string, unknown> = { type: 'scrape', requestId, source: params.source };
  if (params.mode === 'resolve') {
    msg.mode = 'resolve';
    msg.query = params.query;
  } else {
    msg.url = params.url;
    if (params.mode !== undefined) msg.mode = params.mode;
    if (params.query !== undefined) msg.query = params.query;
  }
  ws.send(JSON.stringify(msg));
  return requestId;
}

export function onResultReady(cb: ResultReadyCb): () => void {
  resultReadyCbs.add(cb);
  return () => resultReadyCbs.delete(cb);
}

export function onScrapeError(cb: ScrapeErrorCb): () => void {
  scrapeErrorCbs.add(cb);
  return () => scrapeErrorCbs.delete(cb);
}

export function pairingToken(): string {
  return currentToken ?? '';
}

export function setPairingToken(token: string): void {
  localStorage.setItem('scrape_pairing_token', token);
  connect(token);
}

export { menubarOnline, connected, pendingResolve, setPendingResolve, pendingScrapeUrl, setPendingScrapeUrl, refreshTick };
