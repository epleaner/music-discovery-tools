import { Component, Show, For, createSignal, createEffect } from 'solid-js';
import type { TopAlbum, AlbumInfo, AlbumInfoResponse } from '@soundscape/types';
import { fetchAlbumInfo, getCached, getAlbumCacheKey } from '@soundscape/utils';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';
import InfoButton from './InfoButton';
import Artwork from './Artwork';

interface TopAlbumListProps {
  albums: TopAlbum[];
  isLoading: boolean;
  error: Error | null;
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
        <EmptyState class="section-content">Loading...</EmptyState>
      </Show>
      <Show when={props.error}>
        <ErrorMessage class="section-content">
          {props.error?.message}
        </ErrorMessage>
      </Show>

      <Show
        when={!props.isLoading && !props.error && props.albums.length === 0}
      >
        <EmptyState class="section-content">No albums found</EmptyState>
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
              <div class="list-row">
                <button
                  type="button"
                  class="list-select"
                  onClick={() => props.onAlbumClick?.(album)}
                >
                  <Artwork images={album.image} />
                  <span class="list-main">
                    <span class="list-title block">{album.name}</span>
                    <span class="list-meta block">{album.artist.name}</span>
                    <Show
                      when={info()?.tags?.tag && info()!.tags.tag.length > 0}
                    >
                      <span class="list-meta block">
                        <For each={info()!.tags.tag.slice(0, 3)}>
                          {(tag, index) => (
                            <span>
                              {index() > 0 ? ', ' : ''}
                              {tag.name}
                            </span>
                          )}
                        </For>
                      </span>
                    </Show>
                    <span class="list-count block">
                      {album.playcount} plays
                    </span>
                  </span>
                </button>
                <div class="list-actions">
                  <Show when={isLoading() || !info()}>
                    <InfoButton
                      loading={isLoading()}
                      label="album"
                      onClick={(e: MouseEvent) => handleInfoClick(album, e)}
                    />
                  </Show>
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
