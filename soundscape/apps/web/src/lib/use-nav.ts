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

  const navigate = (view: Omit<NavView, 'id'>) => {
    setSearchParams({
      nav: serialize(appendOrReplace(state(), view, crypto.randomUUID())),
    });
  };

  const goTo = (index: number) => {
    setSearchParams({ nav: serialize(truncateTo(state(), index)) });
  };

  const home = () => {
    setSearchParams({ nav: serialize(homeState(HOME)) });
  };

  const replaceCurrentScrape = (requestId: string, title: string) => {
    const currentState = state();
    const stack = currentState.stack.slice();
    const view = stack[currentState.index];
    if (view.restore.type !== 'scrape' || view.restore.requestId !== requestId) return;
    stack[currentState.index] = {
      ...view,
      label: title,
      restore: { ...view.restore, title },
    };
    setSearchParams(
      { nav: serialize({ stack, index: currentState.index }) },
      { replace: true }
    );
  };

  return { state, current, navigate, goTo, home, replaceCurrentScrape };
}
