import { Component, For, Show, createSignal, createEffect } from 'solid-js';
import type { Artist, SimilarArtist, ArtistInfo, ArtistInfoResponse } from '@soundscape/types';
import { getRYMArtistUrl, fetchArtistInfo, getCached, getArtistCacheKey } from '@soundscape/utils';

interface ArtistListProps {
  artists: Artist[] | SimilarArtist[];
  isLoading?: boolean;
  error?: Error | null;
  onArtistClick?: (artistName: string) => void;
  showPlaycount?: boolean;
  showMatch?: boolean;
}

const ArtistList: Component<ArtistListProps> = (props) => {
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

  const isArtist = (artist: Artist | SimilarArtist): artist is Artist => {
    return 'playcount' in artist;
  };

  const isSimilarArtist = (
    artist: Artist | SimilarArtist
  ): artist is SimilarArtist => {
    return 'match' in artist;
  };

  const getPlaycount = (artist: Artist | SimilarArtist): string | undefined => {
    return isArtist(artist) ? artist.playcount : undefined;
  };

  const getMatch = (artist: Artist | SimilarArtist): string | undefined => {
    return isSimilarArtist(artist) ? artist.match : undefined;
  };

  return (
    <div>
      <Show when={props.error}>
        <div class='p-2 mb-2 text-xs border bg-bg-muted border-border'>
          {props.error?.message}
        </div>
      </Show>

      <Show when={props.isLoading && props.artists.length === 0}>
        <div class='py-8 text-xs text-center text-fg-muted'>Loading...</div>
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
                  class='flex gap-2 items-center p-2 transition-colors cursor-pointer hover:bg-bg-subtle'
                  onClick={() => props.onArtistClick?.(artist.name)}>
                  <div class='flex-1 min-w-0'>
                    <div class='flex gap-2 items-center'>
                      <div class='text-sm truncate'>{artist.name}</div>
                      <a
                        href={getRYMArtistUrl(artist.name)}
                        target='_blank'
                        rel='noopener noreferrer'
                        onClick={(e) => e.stopPropagation()}
                        class='text-xs whitespace-nowrap text-fg-subtle hover:text-fg'
                        title='View on RateYourMusic'>
                        rym
                      </a>
                    </div>
                    <div class='flex gap-1 items-center text-xs text-fg-muted'>
                      <Show when={props.showPlaycount && getPlaycount(artist)}>
                        <span>
                          {parseInt(getPlaycount(artist)!).toLocaleString()}{' '}
                          plays
                        </span>
                      </Show>
                      <Show when={props.showMatch && getMatch(artist)}>
                        <span>
                          {Math.round(parseFloat(getMatch(artist)!) * 100)}%
                          match
                        </span>
                      </Show>
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
                  <button
                    onClick={(e) => handleInfoClick(artist.name, e)}
                    class='text-xs text-fg-subtle hover:text-fg px-1'
                    title='Fetch artist info'>
                    {isLoading() ? '◐' : info() ? '✓' : 'ⓘ'}
                  </button>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      <Show
        when={props.artists.length === 0 && !props.isLoading && !props.error}>
        <div class='py-8 text-xs text-center text-fg-muted'>No artists</div>
      </Show>
    </div>
  );
};

export default ArtistList;
