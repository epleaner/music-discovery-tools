import { createMemo } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import {
  appendOrReplace,
  deserialize,
  homeState,
  moveHistory,
  serialize,
  type NavState,
  type NavView,
} from './nav-store';

const HOME: NavView = {
  id: 'home',
  label: 'Home',
  kind: 'home',
  restore: { type: 'tab', panel: 'similar' },
};

// Compose a reset with filter changes in one router navigation.
const HOME_PARAMS = { nav: serialize(homeState(HOME)) } as const;

function sanitize(state: NavState): NavState {
  if (!Array.isArray(state.stack) || state.stack.length === 0) {
    return homeState(HOME);
  }
  if (
    typeof state.index !== 'number' ||
    state.index < 0 ||
    state.index >= state.stack.length
  ) {
    return homeState(HOME);
  }
  return state;
}

export function useNav() {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = createMemo<NavState>(() => {
    const raw = typeof searchParams.nav === 'string' ? searchParams.nav : '';
    return sanitize(deserialize(raw) ?? homeState(HOME));
  });

  const current = () => state().stack[state().index];

  const lastItem = createMemo<NavView | null>(() => {
    const s = state();
    for (let i = s.index; i >= 0; i--) {
      if (s.stack[i].restore.type === 'item') return s.stack[i];
    }
    return null;
  });

  const canGoBack = () => state().index > 0;
  const canGoForward = () => state().index < state().stack.length - 1;
  const move = (direction: -1 | 1) => {
    const previous = state();
    const next = moveHistory(previous, direction);
    if (next !== previous) setSearchParams({ nav: serialize(next) });
  };

  const navigate = (view: Omit<NavView, 'id'>) => {
    setSearchParams({
      nav: serialize(appendOrReplace(state(), view, crypto.randomUUID())),
    });
  };

  const navigateToItem = (item: {
    artist: string;
    album?: string;
    itemKind: 'album' | 'artist';
  }) => {
    navigate({
      kind: 'item',
      label: item.album ?? item.artist,
      restore: { type: 'item', ...item },
    });
  };

  return {
    state,
    current,
    lastItem,
    canGoBack,
    canGoForward,
    back: () => move(-1),
    forward: () => move(1),
    navigate,
    navigateToItem,
    homeParams: HOME_PARAMS,
  };
}
