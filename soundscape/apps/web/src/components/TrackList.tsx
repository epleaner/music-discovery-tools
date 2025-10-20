import { Component, For, Show, createSignal } from 'solid-js';
import type { Track, TrackInfo } from '@soundscape/types';
import { fetchTrackInfo } from '@soundscape/utils';

interface TrackListProps {
  tracks: Track[];
  isLoading?: boolean;
  error?: Error | null;
  onArtistClick?: (artistName: string) => void;
}

const TrackList: Component<TrackListProps> = (props) => {
  const [expandedTrackKey, setExpandedTrackKey] = createSignal<string | null>(
    null
  );
  const [trackInfoCache, setTrackInfoCache] = createSignal<
    Record<string, TrackInfo>
  >({});

  const getTrackKey = (track: Track) =>
    `${track.artist['#text']}-${track.name}`;

  const toggleTrackInfo = async (track: Track) => {
    const key = getTrackKey(track);
    if (expandedTrackKey() === key) {
      setExpandedTrackKey(null);
    } else {
      setExpandedTrackKey(key);
      if (!trackInfoCache()[key]) {
        try {
          const response = await fetchTrackInfo(
            track.artist['#text'],
            track.name
          );
          setTrackInfoCache({ ...trackInfoCache(), [key]: response.track });
        } catch (err) {
          console.error('Failed to fetch track info:', err);
        }
      }
    }
  };

  const getImageUrl = (track: Track) => {
    const image = track.image?.find(
      (img) => img.size === 'small' || img.size === 'medium'
    );
    return image?.['#text'] || '';
  };

  const formatDate = (track: Track) => {
    if (!track.date) return 'Now';
    const date = new Date(parseInt(track.date.uts) * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div class='space-y-px'>
      <Show when={props.error}>
        <div class='p-2 text-xs bg-bg-muted border border-border'>
          {props.error?.message}
        </div>
      </Show>

      <Show when={props.isLoading && props.tracks.length === 0}>
        <div class='py-8 text-xs text-center text-fg-muted'>Loading...</div>
      </Show>

      <For each={props.tracks}>
        {(track) => {
          const key = getTrackKey(track);
          const isExpanded = () => expandedTrackKey() === key;
          const info = () => trackInfoCache()[key];

          return (
            <div>
              <div class='flex items-center gap-2 p-2 transition-colors border-b border-border hover:bg-bg-subtle'>
                <Show when={getImageUrl(track)}>
                  <img
                    src={getImageUrl(track)}
                    alt={track.album['#text']}
                    class='w-8 h-8'
                  />
                </Show>
                <div class='flex-1 min-w-0'>
                  <div class='text-sm truncate'>{track.name}</div>
                  <div class='flex items-center gap-2'>
                    <div class='text-xs truncate text-fg-muted'>
                      {track.artist['#text']}
                    </div>
                    <Show when={props.onArtistClick}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onArtistClick?.(track.artist['#text']);
                        }}
                        class='text-xs text-fg-subtle hover:text-fg whitespace-nowrap'>
                        similar →
                      </button>
                    </Show>
                  </div>
                </div>
                <div class='text-xs text-fg-subtle whitespace-nowrap'>
                  {formatDate(track)}
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

      <Show
        when={props.tracks.length === 0 && !props.isLoading && !props.error}>
        <div class='py-8 text-xs text-center text-fg-muted'>No tracks</div>
      </Show>
    </div>
  );
};

export default TrackList;
