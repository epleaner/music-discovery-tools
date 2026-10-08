import { Component, For, Show, createSignal, createEffect } from 'solid-js';
import type {
  RecentArtist,
  Track,
  ArtistInfo,
  ArtistInfoResponse,
} from '@soundscape/types';
import {
  fetchArtistInfo,
  getCached,
  getArtistCacheKey,
} from '@soundscape/utils';
import Button from './Button';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';
import InfoButton from './InfoButton';
import Artwork from './Artwork';

interface RecentArtistListProps {
  artists: RecentArtist[];
  tracks: Track[];
  isLoading?: boolean;
  error?: Error | null;
  onArtistRowClick?: (artist: RecentArtist) => void;
  onNTSLookup?: (artistName: string) => void;
}

const RecentArtistList: Component<RecentArtistListProps> = (props) => {
  const [artistInfoCache, setArtistInfoCache] = createSignal<
    Record<string, ArtistInfo>
  >({});
  const [loadingInfo, setLoadingInfo] = createSignal<Set<string>>(new Set());

  const fetchArtistInfoForName = async (artistName: string) => {
    if (!artistInfoCache()[artistName]) {
      setLoadingInfo((prev) => new Set(prev).add(artistName));
      try {
        const response = await fetchArtistInfo(artistName);
        setArtistInfoCache({
          ...artistInfoCache(),
          [artistName]: response.artist,
        });
      } catch (err) {
        console.error('Failed to fetch artist info:', err);
      } finally {
        setLoadingInfo((prev) => {
          const next = new Set(prev);
          next.delete(artistName);
          return next;
        });
      }
    }
  };

  const loadCachedInfoForName = async (artistName: string) => {
    const cacheKey = getArtistCacheKey(artistName);
    const cached = await getCached<ArtistInfoResponse>(cacheKey);
    if (cached) {
      setArtistInfoCache({
        ...artistInfoCache(),
        [artistName]: cached.artist,
      });
    }
  };

  const handleInfoClick = (artistName: string, e: MouseEvent) => {
    e.stopPropagation();
    fetchArtistInfoForName(artistName);
  };

  return (
    <div>
      <Show when={props.error}>
        <ErrorMessage class="section-content">
          {props.error?.message}
        </ErrorMessage>
      </Show>

      <Show when={props.isLoading && props.artists.length === 0}>
        <EmptyState class="section-content">Loading...</EmptyState>
      </Show>

      <div>
        <For each={props.artists}>
          {(artist) => {
            const info = () => artistInfoCache()[artist.name];
            const isLoading = () => loadingInfo().has(artist.name);

            // Check cache immediately and load if available (but don't fetch from API)
            createEffect(() => {
              if (!info()) {
                loadCachedInfoForName(artist.name);
              }
            });

            return (
              <div class="list-row">
                <button
                  type="button"
                  class="list-select"
                  onClick={() => props.onArtistRowClick?.(artist)}
                >
                  <Artwork images={artist.image} />
                  <span class="list-main">
                    <span class="list-title">{artist.name}</span>
                    <span class="list-count">
                      {artist.trackCount}{' '}
                      {artist.trackCount === 1 ? 'track' : 'tracks'}
                    </span>
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
                  <Button
                    variant="link"
                    title={`Search NTS for ${artist.name}`}
                    aria-label={`Search NTS for ${artist.name}`}
                    onClick={() => props.onNTSLookup?.(artist.name)}
                  >
                    NTS
                  </Button>
                  <Show when={isLoading() || !info()}>
                    <InfoButton
                      loading={isLoading()}
                      label="artist"
                      onClick={(e: MouseEvent) =>
                        handleInfoClick(artist.name, e)
                      }
                    />
                  </Show>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      <Show
        when={props.artists.length === 0 && !props.isLoading && !props.error}
      >
        <EmptyState class="section-content">No artists</EmptyState>
      </Show>
    </div>
  );
};

export default RecentArtistList;
