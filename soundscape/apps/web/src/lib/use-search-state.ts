import { Accessor, createMemo } from 'solid-js';
import { useSearchParams } from '@solidjs/router';

/**
 * Hook for syncing SolidJS state with router search params (hash query string)
 * Drop-in replacement for useHashState backed by @solidjs/router
 */
export function useSearchState<T extends Record<string, string>>(
  initialState: T
): [Accessor<T>, (newState: Partial<T>) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const state: Accessor<T> = createMemo(() => {
    const result = { ...initialState } as T;
    for (const key of Object.keys(initialState) as (keyof T)[]) {
      const value = searchParams[key as string];
      if (typeof value === 'string') {
        result[key] = value as T[keyof T];
      }
    }
    return result;
  });

  const updateState = (newState: Partial<T>) => {
    setSearchParams(newState, { replace: true });
  };

  return [state, updateState];
}
