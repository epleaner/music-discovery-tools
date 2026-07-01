import { Component, For, Show, createSignal, createEffect } from 'solid-js';
import type {
  RecentAlbum,
  Track,
  AlbumInfo,
  AlbumInfoResponse,
} from '@soundscape/types';
import {
  getRYMAlbumUrl,
  fetchAlbumInfo,
  getCached,
  getAlbumCacheKey,
} from '@soundscape/utils';

interface AlbumListProps {
  albums: RecentAlbum[];
  tracks: Track[];
  isLoading?: boolean;
  error?: Error | null;
  onArtistClick?: (artistName: string) => void;
  onAlbumClick?: (album: RecentAlbum) => void;
  onRymScrape?: (url: string) => void;
}

const AlbumList: Component<AlbumListProps> = (props) => {
  const [albumInfoCache, setAlbumInfoCache] = createSignal<
    Record<string, AlbumInfo>
  >({});
  const [loadingInfo, setLoadingInfo] = createSignal<Set<string>>(new Set());

  const fetchAlbumInfoForKey = async (
    key: string,
    artistName: string,
    albumName: string
  ) => {
    if (!albumInfoCache()[key]) {
      setLoadingInfo((prev) => new Set(prev).add(key));
      try {
        const response = await fetchAlbumInfo(artistName, albumName);
        setAlbumInfoCache({ ...albumInfoCache(), [key]: response.album });
      } catch (err) {
        console.error('Failed to fetch album info:', err);
      } finally {
        setLoadingInfo((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    }
  };

  const loadCachedInfoForKey = async (
    key: string,
    artistName: string,
    albumName: string
  ) => {
    const cacheKey = getAlbumCacheKey(artistName, albumName);
    const cached = await getCached<AlbumInfoResponse>(cacheKey);
    if (cached) {
      setAlbumInfoCache({ ...albumInfoCache(), [key]: cached.album });
    }
  };

  const handleInfoClick = (album: RecentAlbum, e: MouseEvent) => {
    e.stopPropagation();
    const key = getAlbumKey(album);
    fetchAlbumInfoForKey(key, album.artist, album.name);
  };

  const getImageUrl = (album: RecentAlbum) => {
    const image = album.image?.find(
      (img) => img.size === 'small' || img.size === 'medium'
    );
    return image?.['#text'] || '';
  };

  const formatDate = (album: RecentAlbum) => {
    const date = new Date(parseInt(album.lastPlayed) * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const getAlbumKey = (album: RecentAlbum) => `${album.name}::${album.artist}`;

  return (
    <div>
      <Show when={props.error}>
        <div class='p-2 mb-2 text-xs bg-bg-muted border border-border'>
          {props.error?.message}
        </div>
      </Show>

      <Show when={props.isLoading && props.albums.length === 0}>
        <div class='py-8 text-xs text-center text-fg-muted'>Loading...</div>
      </Show>

      <div class='grid grid-cols-2 gap-px bg-border'>
        <For each={props.albums}>
          {(album) => {
            const albumKey = getAlbumKey(album);
            const info = () => albumInfoCache()[albumKey];
            const isLoading = () => loadingInfo().has(albumKey);

            // Check cache immediately and load if available (but don't fetch from API)
            createEffect(() => {
              if (!info()) {
                loadCachedInfoForKey(albumKey, album.artist, album.name);
              }
            });

            return (
              <div class='bg-bg'>
                <div
                  class='flex gap-2 items-center p-2 transition-colors hover:bg-bg-subtle cursor-pointer'
                  onClick={() => props.onAlbumClick?.(album)}>
                  <Show when={getImageUrl(album)}>
                    <img
                      src={getImageUrl(album)}
                      alt={album.name}
                      class='w-8 h-8'
                    />
                  </Show>
                  <div class='flex-1 min-w-0'>
                    <div class='flex items-center gap-2'>
                      <div class='text-sm truncate'>{album.name}</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onRymScrape?.(getRYMAlbumUrl(album.artist, album.name));
                        }}
                        class='text-xs text-fg-subtle hover:text-fg whitespace-nowrap'
                        title='Scrape on RateYourMusic'>
                        rym
                      </button>
                    </div>
                    <div class='flex items-center gap-2'>
                      <div class='text-xs truncate text-fg-muted'>
                        {album.artist}
                      </div>
                      <Show when={props.onArtistClick}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onArtistClick?.(album.artist);
                          }}
                          class='text-xs text-fg-subtle hover:text-fg whitespace-nowrap'>
                          similar →
                        </button>
                      </Show>
                    </div>
                    <Show
                      when={info()?.tags?.tag && info()!.tags.tag.length > 0}>
                      <div class='flex gap-1 text-xs text-fg-muted'>
                        <For each={info()!.tags.tag.slice(0, 3)}>
                          {(tag, index) => (
                            <span>
                              {tag.name}
                              {index() <
                              Math.min(2, info()!.tags.tag.length - 1)
                                ? ','
                                : ''}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                  <div class='flex items-center gap-2'>
                    <div class='text-xs text-fg-subtle whitespace-nowrap'>
                      {formatDate(album)}
                    </div>
                    <Show when={isLoading() || !info()}>
                      <button
                        onClick={(e) => handleInfoClick(album, e)}
                        class='text-xs text-fg-subtle hover:text-fg px-1'
                        title='Fetch album info'>
                        {isLoading() ? '◐' : 'ⓘ'}
                      </button>
                    </Show>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      <Show
        when={props.albums.length === 0 && !props.isLoading && !props.error}>
        <div class='py-8 text-xs text-center text-fg-muted'>No albums</div>
      </Show>
    </div>
  );
};

export default AlbumList;
