/**
 * IndexedDB-based cache for LastFM API responses
 */

const DB_NAME = 'soundscape-cache';
const DB_VERSION = 1;
const STORE_NAME = 'lastfm-info';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize the IndexedDB database
 */
function initDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });

  return dbPromise;
}

/**
 * Get a cached entry from IndexedDB
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const db = await initDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if cache entry is expired
        const now = Date.now();
        if (now - entry.timestamp > CACHE_DURATION) {
          // Expired, delete it
          const deleteTransaction = db.transaction(STORE_NAME, 'readwrite');
          const deleteStore = deleteTransaction.objectStore(STORE_NAME);
          deleteStore.delete(key);
          resolve(null);
        } else {
          resolve(entry.data);
        }
      };
    });
  } catch (err) {
    console.error('Failed to get cached entry:', err);
    return null;
  }
}

/**
 * Set a cached entry in IndexedDB
 */
export async function setCached<T>(key: string, data: T): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error('Failed to set cached entry:', err);
  }
}

/**
 * Clear all cached entries (useful for debugging or settings)
 */
export async function clearCache(): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error('Failed to clear cache:', err);
  }
}

/**
 * Generate cache key for artist info
 */
export function getArtistCacheKey(artistName: string): string {
  return `artist:${artistName.toLowerCase().trim()}`;
}

/**
 * Generate cache key for album info
 */
export function getAlbumCacheKey(artistName: string, albumName: string): string {
  return `album:${artistName.toLowerCase().trim()}:${albumName.toLowerCase().trim()}`;
}

/**
 * Generate cache key for track info
 */
export function getTrackCacheKey(artistName: string, trackName: string): string {
  return `track:${artistName.toLowerCase().trim()}:${trackName.toLowerCase().trim()}`;
}

