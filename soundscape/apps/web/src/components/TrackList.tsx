import { Component, For, Show } from 'solid-js';
import type { Track } from '@soundscape/types';

interface TrackListProps {
  tracks: Track[];
  isLoading?: boolean;
  error?: Error | null;
}

const TrackList: Component<TrackListProps> = (props) => {
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
        {(track) => (
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
              <div class='text-xs truncate text-fg-muted'>
                {track.artist['#text']}
              </div>
            </div>
            <div class='text-xs text-fg-subtle whitespace-nowrap'>
              {formatDate(track)}
            </div>
          </div>
        )}
      </For>

      <Show
        when={props.tracks.length === 0 && !props.isLoading && !props.error}>
        <div class='py-8 text-xs text-center text-fg-muted'>No tracks</div>
      </Show>
    </div>
  );
};

export default TrackList;
