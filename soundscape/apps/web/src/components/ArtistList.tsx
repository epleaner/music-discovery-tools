import { Component, For, Show } from 'solid-js';
import type { Artist, SimilarArtist } from '@soundscape/types';
import LookupActions from './LookupActions';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';
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
        <ErrorMessage class="section-content">
          {props.error?.message}
        </ErrorMessage>
      </Show>

      <Show when={props.isLoading && props.artists.length === 0}>
        <EmptyState class="section-content">Loading...</EmptyState>
      </Show>

      <Show when={props.artists.length > 0}>
        <div>
          <For each={props.artists}>
            {(artist) => (
              <div class="list-row">
                <button
                  type="button"
                  class="list-select"
                  onClick={() => props.onArtistClick?.(artist.name)}
                >
                  <Artwork images={artist.image} />
                  <span class="list-main">
                    <span class="list-title">{artist.name}</span>
                    <span class="list-count">
                      <Show when={props.showPlaycount && getPlaycount(artist)}>
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
                  </span>
                </button>
                <LookupActions
                  artist={artist.name}
                  onNTSLookup={props.onNTSLookup}
                />
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show
        when={props.artists.length === 0 && !props.isLoading && !props.error}
      >
        <EmptyState class="section-content">No artists</EmptyState>
      </Show>
    </>
  );
};

export default ArtistList;
