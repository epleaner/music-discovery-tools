import { Accessor, createSignal, onCleanup, onMount } from 'solid-js';

type SearchState = Record<string, string>;

/**
 * Hook for syncing SolidJS state with the hash query string
 * while keeping UI state stable across HashRouter remounts
 */
export function useSearchState<T extends SearchState>(
  initialState: T
): [Accessor<T>, (newState: Partial<T>) => void] {
  const readSearchState = () => {
    const result = { ...initialState } as T;
    const queryStart = window.location.hash.indexOf('?');
    if (queryStart === -1) return result;

    const searchParams = new URLSearchParams(
      window.location.hash.slice(queryStart + 1)
    );
    for (const key of Object.keys(initialState) as (keyof T)[]) {
      const value = searchParams.get(key as string);
      if (value !== null) {
        result[key] = value as T[keyof T];
      }
    }
    return result;
  };

  const [state, setState] = createSignal<T>(
    readSearchState() as Exclude<T, Function>
  );
  const syncFromLocation = () =>
    setState(readSearchState() as Exclude<T, Function>);
  window.addEventListener('hashchange', syncFromLocation);
  onCleanup(() => window.removeEventListener('hashchange', syncFromLocation));
  onMount(syncFromLocation);
  const updateState = (newState: Partial<T>) => {
    const next = {
      ...state(),
      ...newState,
    } as Exclude<T, Function>;
    setState(next);
    const queryStart = window.location.hash.indexOf('?');
    // Avoid a HashRouter remount; the local signal drives the rendered state.
    const params = new URLSearchParams(
      queryStart === -1 ? '' : window.location.hash.slice(queryStart + 1)
    );
    for (const [key, value] of Object.entries(newState)) {
      params.set(key, value);
    }
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}#/?${params.toString()}`
    );
  };

  return [state, updateState];
}
