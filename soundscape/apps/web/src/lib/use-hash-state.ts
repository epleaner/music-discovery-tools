import { createSignal, createEffect, onCleanup, Accessor } from 'solid-js';
import { parseHash, updateHash } from '@soundscape/utils';

/**
 * Hook for syncing SolidJS state with URL hash
 * Provides bidirectional sync: state changes update URL, URL changes update state
 */
export function useHashState<T extends Record<string, string>>(
  initialState: T
): [Accessor<T>, (newState: Partial<T>) => void] {
  const [state, setState] = createSignal<T>({ ...initialState, ...parseHash() } as T);

  // Update URL when state changes
  createEffect(() => {
    const currentState = state();
    updateHash(currentState, true);
  });

  // Listen for hash changes (back/forward navigation)
  const handleHashChange = () => {
    const hashState = parseHash();
    setState((prev) => ({ ...prev, ...hashState } as T));
  };

  window.addEventListener('hashchange', handleHashChange);

  onCleanup(() => {
    window.removeEventListener('hashchange', handleHashChange);
  });

  const updateState = (newState: Partial<T>) => {
    setState((prev) => ({ ...prev, ...newState } as T));
  };

  return [state, updateState];
}

