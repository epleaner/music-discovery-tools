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
      (img) => img.size === 'medium' || img.size === 'large'
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
    <div class='w-full'>
      <Show when={props.error}>
        <div class='p-4 bg-destructive/10 text-destructive rounded-lg mb-4'>
          {props.error?.message}
        </div>
      </Show>

      <Show when={props.isLoading && props.artists.length === 0}>
        <div class='text-center py-8 text-muted-foreground'>
          Loading artists...
        </div>
      </Show>

      <div class='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
        <For each={props.artists}>
          {(artist) => (
            <div
              class='flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent transition-colors cursor-pointer'
              onClick={() => props.onArtistClick?.(artist.name)}>
              <Show when={getImageUrl(artist)}>
                <img
                  src={getImageUrl(artist)}
                  alt={artist.name}
                  class='w-16 h-16 rounded object-cover'
                />
              </Show>
              <div class='flex-1 min-w-0'>
                <div class='font-medium text-foreground truncate'>
                  {artist.name}
                </div>
                <Show when={props.showPlaycount && getPlaycount(artist)}>
                  <div class='text-sm text-muted-foreground'>
                    {parseInt(getPlaycount(artist)!).toLocaleString()} plays
                  </div>
                </Show>
                <Show when={props.showMatch && getMatch(artist)}>
                  <div class='text-sm text-muted-foreground'>
                    {Math.round(parseFloat(getMatch(artist)!) * 100)}% match
                  </div>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>

      <Show
        when={props.artists.length === 0 && !props.isLoading && !props.error}>
        <div class='text-center py-8 text-muted-foreground'>
          No artists found
        </div>
      </Show>
    </div>
  );
};

export default ArtistList;
