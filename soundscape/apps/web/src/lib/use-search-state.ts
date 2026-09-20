import { type Accessor } from 'solid-js';
import { useSearchParams } from '@solidjs/router';

type SearchState = Record<string, string>;

/**
 * Reads and updates application state through the HashRouter search params.
 */
export function useSearchState<T extends SearchState>(
  initialState: T
): [Accessor<T>, (newState: Partial<T>) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = () => {
    const result = { ...initialState } as T;
    for (const key of Object.keys(initialState) as (keyof T)[]) {
      const value = searchParams[key as string];
      if (typeof value === 'string') {
        result[key] = value as T[keyof T];
      }
    }
    return result;
  };

  const updateState = (newState: Partial<T>) => {
    setSearchParams(newState as Record<string, string>);
  };

  return [state, updateState];
}
