import { Component, For, Show, createSignal, createEffect } from 'solid-js';
import type {
  Artist,
  SimilarArtist,
  ArtistInfo,
  ArtistInfoResponse,
} from '@soundscape/types';
import {
  getRYMSearchUrl,
  fetchArtistInfo,
  getCached,
  getArtistCacheKey,
} from '@soundscape/utils';
import Button from './Button';
import EmptyState from './EmptyState';
import ExternalLink from './ExternalLink';
import ErrorMessage from './ErrorMessage';
import InfoButton from './InfoButton';
import Artwork from './Artwork';

interface ArtistListProps {
  artists: Artist[] | SimilarArtist[];
  isLoading?: boolean;
  error?: Error | null;
  onArtistClick?: (artistName: string) => void;
  onNTSLookup?: (artistName: string) => void;
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
    <>
      <Show when={props.error}>
        <ErrorMessage>{props.error?.message}</ErrorMessage>
      </Show>

      <Show when={props.isLoading && props.artists.length === 0}>
        <EmptyState>Loading...</EmptyState>
      </Show>

      <Show when={props.artists.length > 0}>
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
                    onClick={() => props.onArtistClick?.(artist.name)}
                  >
                    <Artwork images={artist.image} />
                    <span class="list-main">
                      <span class="list-title block">{artist.name}</span>
                      <span class="list-count block">
                        <Show
                          when={props.showPlaycount && getPlaycount(artist)}
                        >
                          <span>
                            {parseInt(getPlaycount(artist)!).toLocaleString()}{' '}
                            plays
                          </span>
                        </Show>
                        <Show when={props.showMatch && getMatch(artist)}>
                          <span>
                            {props.showPlaycount && getPlaycount(artist)
                              ? ' · '
                              : ''}
                            {Math.round(parseFloat(getMatch(artist)!) * 100)}%
                            match
                          </span>
                        </Show>
                      </span>
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
                    <ExternalLink
                      href={getRYMSearchUrl(artist.name)}
                      title={`View ${artist.name} on RateYourMusic`}
                    >
                      RYM
                    </ExternalLink>
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
      </Show>

      <Show
        when={props.artists.length === 0 && !props.isLoading && !props.error}
      >
        <EmptyState>No artists</EmptyState>
      </Show>
    </>
  );
};

export default ArtistList;
