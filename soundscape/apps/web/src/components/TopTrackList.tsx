import { Component, Show, For, createSignal } from 'solid-js';
import type { TopTrack, TrackInfo } from '@soundscape/types';
import { fetchTrackInfo } from '@soundscape/utils';

interface TopTrackListProps {
  tracks: TopTrack[];
  isLoading: boolean;
  error: any;
  onArtistClick?: (artistName: string) => void;
}

const TopTrackList: Component<TopTrackListProps> = (props) => {
  const [expandedTrackKey, setExpandedTrackKey] = createSignal<string | null>(
    null
  );
  const [trackInfoCache, setTrackInfoCache] = createSignal<
    Record<string, TrackInfo>
  >({});

  const getTrackKey = (track: TopTrack) => `${track.artist.name}-${track.name}`;

  const toggleTrackInfo = async (track: TopTrack) => {
    const key = getTrackKey(track);
    if (expandedTrackKey() === key) {
      setExpandedTrackKey(null);
    } else {
      setExpandedTrackKey(key);
      if (!trackInfoCache()[key]) {
        try {
          const response = await fetchTrackInfo(track.artist.name, track.name);
          setTrackInfoCache({ ...trackInfoCache(), [key]: response.track });
        } catch (err) {
          console.error('Failed to fetch track info:', err);
        }
      }
    }
  };

  return (
    <div>
      <Show when={props.isLoading}>
        <div class='p-4 text-xs text-center text-fg-muted'>Loading...</div>
      </Show>

      <Show when={props.error}>
        <div class='p-4 text-xs text-center text-fg-muted'>
          Error: {props.error?.toString()}
        </div>
      </Show>

      <Show
        when={!props.isLoading && !props.error && props.tracks.length === 0}>
        <div class='p-4 text-xs text-center text-fg-muted'>No tracks found</div>
      </Show>

      <Show when={!props.isLoading && !props.error && props.tracks.length > 0}>
        <For each={props.tracks}>
          {(track) => {
            const key = getTrackKey(track);
            const isExpanded = () => expandedTrackKey() === key;
            const info = () => trackInfoCache()[key];

            return (
              <div>
                <div class='flex items-center gap-2 p-2 text-xs border-b border-border hover:bg-bg-subtle'>
                  <div class='flex-1 min-w-0'>
                    <div class='font-medium truncate'>{track.name}</div>
                    <div class='flex gap-1 items-center text-fg-muted'>
                      <button
                        onClick={() => props.onArtistClick?.(track.artist.name)}
                        class='hover:underline'>
                        {track.artist.name}
                      </button>
                      <button
                        onClick={() => props.onArtistClick?.(track.artist.name)}
                        class='text-[10px] hover:underline'
                        title='View similar artists'>
                        similar →
                      </button>
                    </div>
                  </div>
                  <div class='flex-shrink-0 text-fg-subtle'>
                    {track.playcount} plays
                  </div>
                  <button
                    onClick={() => toggleTrackInfo(track)}
                    class='text-xs text-fg-subtle hover:text-fg px-1'
                    title='Toggle track info'>
                    {isExpanded() ? '−' : 'ⓘ'}
                  </button>
                </div>
                <Show when={isExpanded() && info()}>
                  <div class='px-4 py-2 bg-bg-subtle border-b border-border text-xs'>
                    <Show
                      when={
                        info()?.toptags?.tag && info()!.toptags.tag.length > 0
                      }>
                      <div class='flex gap-1 flex-wrap'>
                        <span class='text-fg-muted'>Tags:</span>
                        <For each={info()!.toptags.tag.slice(0, 5)}>
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
      </Show>
    </div>
  );
};

export default TopTrackList;
