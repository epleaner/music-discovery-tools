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

  const getImageUrl = (artist: RecentArtist) => {
    const image = artist.image?.find(
      (img) => img.size === 'small' || img.size === 'medium'
    );
    return image?.['#text'] || '';
  };

  return (
    <div>
      <Show when={props.error}>
        <ErrorMessage class='p-2 mb-2 bg-bg-muted border border-border'>
          {props.error?.message}
        </ErrorMessage>
      </Show>

      <Show when={props.isLoading && props.artists.length === 0}>
        <EmptyState class='py-8 text-center'>Loading...</EmptyState>
      </Show>

      <div class='grid grid-cols-2 gap-px bg-border'>
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
              <div class='bg-bg'>
                <div
                  class='flex gap-2 items-center p-2 transition-colors hover:bg-bg-subtle cursor-pointer'
                  onClick={() => props.onArtistRowClick?.(artist)}>
                  <Show when={getImageUrl(artist)}>
                    <img
                      src={getImageUrl(artist)}
                      alt={artist.name}
                      class='w-8 h-8'
                    />
                  </Show>
                  <div class='flex-1 min-w-0'>
                    <div class='flex gap-2 items-center'>
                      <div class='text-sm truncate'>{artist.name}</div>
                    </div>
                    <div class='flex gap-1 items-center text-xs text-fg-muted'>
                      <span>
                        {artist.trackCount}{' '}
                        {artist.trackCount === 1 ? 'track' : 'tracks'}
                      </span>
                      <Show
                        when={info()?.tags?.tag && info()!.tags.tag.length > 0}>
                        <span class='flex gap-1'>
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
                        </span>
                      </Show>
                    </div>
                  </div>
                  <Button
                    variant='link'
                    class='px-1 text-xs'
                    title={`Search NTS for ${artist.name}`}
                    aria-label={`Search NTS for ${artist.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onNTSLookup?.(artist.name);
                    }}
                  >
                    NTS
                  </Button>
                  <Show when={isLoading() || !info()}>
                    <InfoButton
                      loading={isLoading()}
                      label="artist"
                      onClick={(e: MouseEvent) => handleInfoClick(artist.name, e)}
                    />
                  </Show>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      <Show
        when={props.artists.length === 0 && !props.isLoading && !props.error}>
        <EmptyState class="py-8 text-center">No artists</EmptyState>
      </Show>
    </div>
  );
};

export default RecentArtistList;
