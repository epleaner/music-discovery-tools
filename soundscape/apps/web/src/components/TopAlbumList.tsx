import { Component, Show, For, createSignal, createEffect } from 'solid-js';
import type { TopAlbum, AlbumInfo, AlbumInfoResponse } from '@soundscape/types';
import {
  getRYMAlbumUrl,
  fetchAlbumInfo,
  getCached,
  getAlbumCacheKey,
} from '@soundscape/utils';

interface TopAlbumListProps {
  albums: TopAlbum[];
  isLoading: boolean;
  error: any;
  onArtistClick?: (artistName: string) => void;
}

const TopAlbumList: Component<TopAlbumListProps> = (props) => {
  const [albumInfoCache, setAlbumInfoCache] = createSignal<
    Record<string, AlbumInfo>
  >({});
  const [loadingInfo, setLoadingInfo] = createSignal<Set<string>>(new Set());

  const getAlbumKey = (album: TopAlbum) => `${album.artist.name}-${album.name}`;

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

  const handleInfoClick = (album: TopAlbum, e: MouseEvent) => {
    e.stopPropagation();
    const key = getAlbumKey(album);
    fetchAlbumInfoForKey(key, album.artist.name, album.name);
  };

  return (
    <div>
      <Show when={props.isLoading}>
        <div class='p-4 text-xs text-center text-fg-muted'>Loading...</div>
      </Show>

      <Show when={props.error}>
        <div class='p-4 text-xs text-center text-fg-muted'>
          Error: {props.error?.toString()}
        </div>
      </Show>

      <Show
        when={!props.isLoading && !props.error && props.albums.length === 0}>
        <div class='p-4 text-xs text-center text-fg-muted'>No albums found</div>
      </Show>

      <Show when={!props.isLoading && !props.error && props.albums.length > 0}>
        <For each={props.albums}>
          {(album) => {
            const key = getAlbumKey(album);
            const info = () => albumInfoCache()[key];
            const isLoading = () => loadingInfo().has(key);

            // Check cache immediately and load if available (but don't fetch from API)
            createEffect(() => {
              if (!info()) {
                loadCachedInfoForKey(key, album.artist.name, album.name);
              }
            });

            return (
              <div class='flex items-center gap-2 p-2 text-xs border-b border-border hover:bg-bg-subtle'>
                <div class='flex-1 min-w-0'>
                  <div class='flex gap-1 items-center'>
                    <span class='font-medium truncate'>{album.name}</span>
                    <a
                      href={getRYMAlbumUrl(album.artist.name, album.name)}
                      target='_blank'
                      rel='noopener noreferrer'
                      class='text-[10px] hover:underline text-fg-subtle'
                      title='View on RateYourMusic'>
                      rym
                    </a>
                  </div>
                  <div class='flex gap-1 items-center text-fg-muted'>
                    <button
                      onClick={() => props.onArtistClick?.(album.artist.name)}
                      class='hover:underline'>
                      {album.artist.name}
                    </button>
                    <button
                      onClick={() => props.onArtistClick?.(album.artist.name)}
                      class='text-[10px] hover:underline'
                      title='View similar artists'>
                      similar →
                    </button>
                  </div>
                  <Show when={info()?.tags?.tag && info()!.tags.tag.length > 0}>
                    <div class='flex gap-1 text-fg-muted'>
                      <For each={info()!.tags.tag.slice(0, 3)}>
                        {(tag, index) => (
                          <span>
                            {tag.name}
                            {index() < Math.min(2, info()!.tags.tag.length - 1)
                              ? ','
                              : ''}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
                <div class='flex-shrink-0 text-fg-subtle'>
                  {album.playcount} plays
                </div>
                <button
                  onClick={(e) => handleInfoClick(album, e)}
                  class='text-xs text-fg-subtle hover:text-fg px-1'
                  title='Fetch album info'>
                  {isLoading() ? '◐' : info() ? '✓' : 'ⓘ'}
                </button>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
};

export default TopAlbumList;
