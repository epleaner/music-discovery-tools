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
      (img) => img.size === 'medium' || img.size === 'large'
    );
    return image?.['#text'] || '';
  };

  const formatDate = (track: Track) => {
    if (!track.date) return 'Now playing';
    const date = new Date(parseInt(track.date.uts) * 1000);
    return date.toLocaleString();
  };

  return (
    <div class='w-full'>
      <Show when={props.error}>
        <div class='p-4 bg-destructive/10 text-destructive rounded-lg mb-4'>
          {props.error?.message}
        </div>
      </Show>

      <Show when={props.isLoading && props.tracks.length === 0}>
        <div class='text-center py-8 text-muted-foreground'>
          Loading tracks...
        </div>
      </Show>

      <div class='space-y-2'>
        <For each={props.tracks}>
          {(track) => (
            <div class='flex items-center gap-4 p-3 bg-card rounded-lg hover:bg-accent transition-colors'>
              <Show when={getImageUrl(track)}>
                <img
                  src={getImageUrl(track)}
                  alt={track.album['#text']}
                  class='w-16 h-16 rounded object-cover'
                />
              </Show>
              <div class='flex-1 min-w-0'>
                <div class='font-medium text-foreground truncate'>
                  {track.name}
                </div>
                <div class='text-sm text-muted-foreground truncate'>
                  {track.artist['#text']}
                </div>
                <Show when={track.album['#text']}>
                  <div class='text-xs text-muted-foreground truncate'>
                    {track.album['#text']}
                  </div>
                </Show>
              </div>
              <div class='text-xs text-muted-foreground whitespace-nowrap'>
                {formatDate(track)}
              </div>
            </div>
          )}
        </For>
      </div>

      <Show
        when={props.tracks.length === 0 && !props.isLoading && !props.error}>
        <div class='text-center py-8 text-muted-foreground'>
          No tracks found
        </div>
      </Show>
    </div>
  );
};

export default TrackList;


