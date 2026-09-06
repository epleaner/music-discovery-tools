import { Component, Show, For, createSignal, createEffect } from 'solid-js';
import type { TopAlbum, AlbumInfo, AlbumInfoResponse } from '@soundscape/types';
import {
  fetchAlbumInfo,
  getCached,
  getAlbumCacheKey,
} from '@soundscape/utils';
import EmptyState from './EmptyState';
import InfoButton from './InfoButton';

interface TopAlbumListProps {
  albums: TopAlbum[];
  isLoading: boolean;
  error: any;
  onAlbumClick?: (album: TopAlbum) => void;
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
        <EmptyState class='p-4 text-center'>Loading...</EmptyState>
      </Show>
      <Show when={props.error}>
        <EmptyState class='p-4 text-center'>
          Error: {props.error?.toString()}
        </EmptyState>
      </Show>

      <Show
        when={!props.isLoading && !props.error && props.albums.length === 0}>
        <EmptyState class="p-4 text-center">No albums found</EmptyState>
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
              <div
                class='flex gap-2 items-center p-2 text-xs border-b border-border hover:bg-bg-subtle cursor-pointer'
                onClick={() => props.onAlbumClick?.(album)}>
                <div class='flex-1 min-w-0'>
                  <div class='flex gap-1 items-center'>
                    <span class='font-medium truncate'>{album.name}</span>
                  </div>
                  <div class='flex gap-1 items-center text-fg-muted'>
                    <span>{album.artist.name}</span>
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
                <Show when={isLoading() || !info()}>
                  <InfoButton
                    loading={isLoading()}
                    label="album"
                    onClick={(e: MouseEvent) => handleInfoClick(album, e)}
                  />
                </Show>
                <div class='flex-shrink-0 text-fg-subtle'>
                  {album.playcount} plays
                </div>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
};

export default TopAlbumList;
