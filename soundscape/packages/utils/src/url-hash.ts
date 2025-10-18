/**
 * URL hash state management utilities
 * Provides type-safe reading and writing of state to URL hash
 */

export type HashState = Record<string, string | undefined>;

/**
 * Parse URL hash into a key-value object
 */
export function parseHash(hash: string = window.location.hash): HashState {
  if (!hash || hash === '#') return {};

  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(cleanHash);
  const state: HashState = {};

  params.forEach((value, key) => {
    state[key] = value;
  });

  return state;
}

/**
 * Serialize state object to URL hash format
 */
export function stringifyHash(state: HashState): string {
  const params = new URLSearchParams();

  Object.entries(state).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, value);
    }
  });

  const hashString = params.toString();
  return hashString ? `#${hashString}` : '';
}

/**
 * Update URL hash without triggering page reload
 */
export function updateHash(state: HashState, replace: boolean = false): void {
  const newHash = stringifyHash(state);

  if (replace) {
    window.history.replaceState(null, '', newHash || window.location.pathname);
  } else {
    window.history.pushState(null, '', newHash || window.location.pathname);
  }
}

/**
 * Get a single value from the current URL hash
 */
export function getHashValue(key: string): string | undefined {
  const state = parseHash();
  return state[key];
}

/**
 * Set a single value in the URL hash
 */
export function setHashValue(
  key: string,
  value: string | undefined,
  replace: boolean = true
): void {
  const state = parseHash();
  if (value === undefined) {
    delete state[key];
  } else {
    state[key] = value;
  }
  updateHash(state, replace);
}

/**
 * Merge new state into existing hash state
 */
export function mergeHashState(
  newState: HashState,
  replace: boolean = true
): void {
  const currentState = parseHash();
  const mergedState = { ...currentState, ...newState };
  updateHash(mergedState, replace);
}
