import { Component, For, Show, createSignal } from 'solid-js';
import type { Artist, SimilarArtist, ArtistInfo } from '@soundscape/types';
import { getRYMArtistUrl, fetchArtistInfo } from '@soundscape/utils';

interface ArtistListProps {
  artists: Artist[] | SimilarArtist[];
  isLoading?: boolean;
  error?: Error | null;
  onArtistClick?: (artistName: string) => void;
  showPlaycount?: boolean;
  showMatch?: boolean;
}

const ArtistList: Component<ArtistListProps> = (props) => {
  const [expandedArtistName, setExpandedArtistName] = createSignal<string | null>(null);
  const [artistInfoCache, setArtistInfoCache] = createSignal<Record<string, ArtistInfo>>({});

  const toggleArtistInfo = async (artistName: string, e: MouseEvent) => {
    e.stopPropagation();
    if (expandedArtistName() === artistName) {
      setExpandedArtistName(null);
    } else {
      setExpandedArtistName(artistName);
      if (!artistInfoCache()[artistName]) {
        try {
          const response = await fetchArtistInfo(artistName);
          setArtistInfoCache({ ...artistInfoCache(), [artistName]: response.artist });
        } catch (err) {
          console.error('Failed to fetch artist info:', err);
        }
      }
    }
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
            const isExpanded = () => expandedArtistName() === artist.name;
            const info = () => artistInfoCache()[artist.name];
            
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
                    <Show when={props.showPlaycount && getPlaycount(artist)}>
                      <div class='text-xs text-fg-muted'>
                        {parseInt(getPlaycount(artist)!).toLocaleString()} plays
                      </div>
                    </Show>
                    <Show when={props.showMatch && getMatch(artist)}>
                      <div class='text-xs text-fg-muted'>
                        {Math.round(parseFloat(getMatch(artist)!) * 100)}% match
                      </div>
                    </Show>
                  </div>
                  <button
                    onClick={(e) => toggleArtistInfo(artist.name, e)}
                    class='text-xs text-fg-subtle hover:text-fg px-1'
                    title='Toggle artist info'>
                    {isExpanded() ? '−' : 'ⓘ'}
                  </button>
                </div>
                <Show when={isExpanded() && info()}>
                  <div class='px-4 py-2 bg-bg-subtle text-xs space-y-1'>
                    <Show when={info()?.ontour === '1'}>
                      <div class='text-fg'>Currently on tour</div>
                    </Show>
                    <Show when={info()?.tags?.tag && info()!.tags.tag.length > 0}>
                      <div class='flex gap-1 flex-wrap'>
                        <span class='text-fg-muted'>Tags:</span>
                        <For each={info()!.tags.tag.slice(0, 5)}>
                          {(tag) => (
                            <span class='text-fg-subtle'>{tag.name}</span>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Show>
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
