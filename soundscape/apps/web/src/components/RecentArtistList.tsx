import { Component, For, Show, createSignal } from 'solid-js';
import type { RecentArtist, Track, ArtistInfo } from '@soundscape/types';
import { getRYMArtistUrl, fetchArtistInfo } from '@soundscape/utils';

interface RecentArtistListProps {
  artists: RecentArtist[];
  tracks: Track[];
  isLoading?: boolean;
  error?: Error | null;
  onArtistClick?: (artistName: string) => void;
}

const RecentArtistList: Component<RecentArtistListProps> = (props) => {
  const [expandedArtists, setExpandedArtists] = createSignal<Set<string>>(
    new Set()
  );
  const [artistInfoExpanded, setArtistInfoExpanded] = createSignal<Set<string>>(
    new Set()
  );
  const [artistInfoCache, setArtistInfoCache] = createSignal<Record<string, ArtistInfo>>({});

  const toggleArtistInfo = async (artistName: string, e: MouseEvent) => {
    e.stopPropagation();
    
    setArtistInfoExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(artistName)) {
        next.delete(artistName);
      } else {
        next.add(artistName);
      }
      return next;
    });

    if (!artistInfoCache()[artistName]) {
      try {
        const response = await fetchArtistInfo(artistName);
        setArtistInfoCache({ ...artistInfoCache(), [artistName]: response.artist });
      } catch (err) {
        console.error('Failed to fetch artist info:', err);
      }
    }
  };

  const getImageUrl = (artist: RecentArtist) => {
    const image = artist.image?.find(
      (img) => img.size === 'small' || img.size === 'medium'
    );
    return image?.['#text'] || '';
  };

  const formatTrackDate = (track: Track) => {
    if (!track.date) return 'Now';
    const date = new Date(parseInt(track.date.uts) * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const toggleArtist = (artistName: string) => {
    setExpandedArtists((prev) => {
      const next = new Set(prev);
      if (next.has(artistName)) {
        next.delete(artistName);
      } else {
        next.add(artistName);
      }
      return next;
    });
  };

  const getTracksForArtist = (artistName: string) => {
    return props.tracks.filter((track) => track.artist['#text'] === artistName);
  };

  const isExpanded = (artistName: string) => expandedArtists().has(artistName);

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

      <div class='space-y-px'>
        <For each={props.artists}>
          {(artist) => {
            const expanded = () => isExpanded(artist.name);
            const artistTracks = () => getTracksForArtist(artist.name);

            return (
              <div class='border-b border-border'>
                <div
                  class='flex items-center gap-2 p-2 transition-colors cursor-pointer hover:bg-bg-subtle'
                  onClick={() => toggleArtist(artist.name)}>
                  <Show when={getImageUrl(artist)}>
                    <img
                      src={getImageUrl(artist)}
                      alt={artist.name}
                      class='w-8 h-8'
                    />
                  </Show>
                  <div class='flex-1 min-w-0'>
                    <div class='flex items-center gap-2'>
                      <div class='text-sm truncate'>{artist.name}</div>
                      <a
                        href={getRYMArtistUrl(artist.name)}
                        target='_blank'
                        rel='noopener noreferrer'
                        onClick={(e) => e.stopPropagation()}
                        class='text-xs text-fg-subtle hover:text-fg whitespace-nowrap'
                        title='View on RateYourMusic'>
                        rym
                      </a>
                      <Show when={props.onArtistClick}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onArtistClick?.(artist.name);
                          }}
                          class='text-xs text-fg-subtle hover:text-fg whitespace-nowrap'>
                          similar →
                        </button>
                      </Show>
                    </div>
                    <div class='text-xs text-fg-muted'>
                      {artist.trackCount}{' '}
                      {artist.trackCount === 1 ? 'track' : 'tracks'}
                    </div>
                  </div>
                  <div class='flex items-center gap-2'>
                    <div class='text-xs text-fg-subtle'>
                      {expanded() ? '−' : '+'}
                    </div>
                    <button
                      onClick={(e) => toggleArtistInfo(artist.name, e)}
                      class='text-xs text-fg-subtle hover:text-fg px-1'
                      title='Toggle artist info'>
                      {artistInfoExpanded().has(artist.name) ? '−' : 'ⓘ'}
                    </button>
                  </div>
                </div>
                <Show when={expanded()}>
                  <div class='bg-bg-subtle'>
                    <For each={artistTracks()}>
                      {(track) => (
                        <div class='flex items-center gap-2 px-2 py-1 pl-12 border-t border-border'>
                          <div class='flex-1 min-w-0'>
                            <div class='text-xs truncate'>{track.name}</div>
                            <div class='text-xs truncate text-fg-muted'>
                              {track.album['#text']}
                            </div>
                          </div>
                          <div class='text-xs text-fg-subtle whitespace-nowrap'>
                            {formatTrackDate(track)}
                          </div>
                        </div>
                      )}
                    </For>
                    <Show when={props.onArtistClick}>
                      <button
                        class='w-full py-1 text-xs text-center border-t border-border text-fg-muted hover:text-fg hover:bg-bg'
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onArtistClick?.(artist.name);
                        }}>
                        View Similar Artists →
                      </button>
                    </Show>
                  </div>
                </Show>
                <Show when={artistInfoExpanded().has(artist.name) && artistInfoCache()[artist.name]}>
                  <div class='px-4 py-2 bg-bg-subtle border-t border-border text-xs space-y-1'>
                    <Show when={artistInfoCache()[artist.name]?.ontour === '1'}>
                      <div class='text-fg'>Currently on tour</div>
                    </Show>
                    <Show when={artistInfoCache()[artist.name]?.tags?.tag && artistInfoCache()[artist.name]!.tags.tag.length > 0}>
                      <div class='flex gap-1 flex-wrap'>
                        <span class='text-fg-muted'>Tags:</span>
                        <For each={artistInfoCache()[artist.name]!.tags.tag.slice(0, 5)}>
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

export default RecentArtistList;
