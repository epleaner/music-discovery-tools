export const LASTFM_USERNAME_STORAGE_KEY = 'lastfmUsername';

interface ResolveInitialLastfmUsernameInput {
  hashUsername?: string | null;
  storedUsername?: string | null;
}

interface StorageLike {
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function normalizeUsername(username: string | null | undefined): string {
  return username?.trim() ?? '';
}

export function resolveInitialLastfmUsername(
  input: ResolveInitialLastfmUsernameInput
): string {
  return normalizeUsername(input.hashUsername) || normalizeUsername(input.storedUsername);
}

export function persistLastfmUsername(
  storage: StorageLike,
  username: string | null | undefined
): void {
  const normalized = normalizeUsername(username);

  if (normalized) {
    storage.setItem(LASTFM_USERNAME_STORAGE_KEY, normalized);
    return;
  }

  storage.removeItem(LASTFM_USERNAME_STORAGE_KEY);
}
