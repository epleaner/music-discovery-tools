import { createMemo } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import {
  appendOrReplace,
  deserialize,
  homeState,
  serialize,
  truncateTo,
  type NavState,
  type NavView,
} from './nav-store';

const HOME: NavView = {
  id: 'home',
  label: 'Home',
  kind: 'home',
  restore: { type: 'tab', panel: 'similar' },
};

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

  const goTo = (index: number) => {
    setSearchParams({ nav: serialize(truncateTo(state(), index)) });
  };

  const home = () => {
    setSearchParams({ nav: serialize(homeState(HOME)) });
  };

  return {
    state,
    current,
    lastItem,
    navigate,
    navigateToItem,
    goTo,
    home,
  };
}
