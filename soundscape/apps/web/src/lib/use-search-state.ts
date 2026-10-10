import { Accessor, createSignal, onCleanup } from 'solid-js';
import { useSearchParams } from '@solidjs/router';

type SearchState = Record<string, string>;

/**
 * Keeps interactive state synchronous while persisting it in the hash query.
 */
export function useSearchState<T extends SearchState>(
  initialState: T
): [Accessor<T>, (newState: Partial<T>) => void] {
  const [, setSearchParams] = useSearchParams();
  const readLocationState = () => {
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
    readLocationState() as Exclude<T, Function>
  );
  const syncFromLocation = () =>
    setState(readLocationState() as Exclude<T, Function>);
  window.addEventListener('hashchange', syncFromLocation);
  onCleanup(() => window.removeEventListener('hashchange', syncFromLocation));

  const updateState = (newState: Partial<T>) => {
    setState((previous) => ({ ...previous, ...newState }));

    setSearchParams(newState, { replace: true });
  };

  return [state, updateState];
}
