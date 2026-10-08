import { Component, For, Show, createSignal, createEffect } from 'solid-js';
import type {
  RecentAlbum,
  Track,
  AlbumInfo,
  AlbumInfoResponse,
} from '@soundscape/types';
import { fetchAlbumInfo, getCached, getAlbumCacheKey } from '@soundscape/utils';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';
import InfoButton from './InfoButton';
import Artwork from './Artwork';

interface AlbumListProps {
  albums: RecentAlbum[];
  tracks: Track[];
  isLoading?: boolean;
  error?: Error | null;
  onAlbumClick?: (album: RecentAlbum) => void;
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
        <ErrorMessage class="section-content">
          {props.error?.message}
        </ErrorMessage>
      </Show>

      <Show when={props.isLoading && props.albums.length === 0}>
        <EmptyState class="section-content">Loading...</EmptyState>
      </Show>

      <div>
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
              <div class="list-row">
                <button
                  type="button"
                  class="list-select"
                  onClick={() => props.onAlbumClick?.(album)}
                >
                  <Artwork images={album.image} />
                  <span class="list-main">
                    <span class="list-title">{album.name}</span>
                    <span class="list-meta">{album.artist}</span>
                    <span class="list-count">{formatDate(album)}</span>
                    <Show
                      when={info()?.tags?.tag && info()!.tags.tag.length > 0}
                    >
                      <span class="list-meta">
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
      </div>

      <Show
        when={props.albums.length === 0 && !props.isLoading && !props.error}
      >
        <EmptyState class="section-content">No albums</EmptyState>
      </Show>
    </div>
  );
};

export default AlbumList;
