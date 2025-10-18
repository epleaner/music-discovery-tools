import { Component, For, Show } from 'solid-js';
import type { Artist, SimilarArtist } from '@soundscape/types';

interface ArtistListProps {
  artists: Artist[] | SimilarArtist[];
  isLoading?: boolean;
  error?: Error | null;
  onArtistClick?: (artistName: string) => void;
  showPlaycount?: boolean;
  showMatch?: boolean;
}

const ArtistList: Component<ArtistListProps> = (props) => {
  const getImageUrl = (artist: Artist | SimilarArtist) => {
    const image = artist.image?.find(
      (img) => img.size === 'small' || img.size === 'medium'
    );
    return image?.['#text'] || '';
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
        <div class='p-2 mb-2 text-xs bg-bg-muted border border-border'>
          {props.error?.message}
        </div>
      </Show>

      <Show when={props.isLoading && props.artists.length === 0}>
        <div class='py-8 text-xs text-center text-fg-muted'>Loading...</div>
      </Show>

      <div class='grid grid-cols-2 gap-px bg-border'>
        <For each={props.artists}>
          {(artist) => (
            <div
              class='flex items-center gap-2 p-2 transition-colors cursor-pointer bg-bg hover:bg-bg-subtle'
              onClick={() => props.onArtistClick?.(artist.name)}>
              <Show when={getImageUrl(artist)}>
                <img
                  src={getImageUrl(artist)}
                  alt={artist.name}
                  class='w-8 h-8'
                />
              </Show>
              <div class='flex-1 min-w-0'>
                <div class='text-sm truncate'>{artist.name}</div>
                <Show when={props.showPlaycount && getPlaycount(artist)}>
                  <div class='text-xs text-fg-muted'>
                    {parseInt(getPlaycount(artist)!).toLocaleString()}
                  </div>
                </Show>
                <Show when={props.showMatch && getMatch(artist)}>
                  <div class='text-xs text-fg-muted'>
                    {Math.round(parseFloat(getMatch(artist)!) * 100)}%
                  </div>
                </Show>
              </div>
            </div>
          )}
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
