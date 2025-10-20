import { Component, Show, For } from 'solid-js';
import type { TopTrack } from '@soundscape/types';

interface TopTrackListProps {
  tracks: TopTrack[];
  isLoading: boolean;
  error: any;
  onArtistClick?: (artistName: string) => void;
}

const TopTrackList: Component<TopTrackListProps> = (props) => {
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

      <Show when={!props.isLoading && !props.error && props.tracks.length === 0}>
        <div class='p-4 text-xs text-center text-fg-muted'>
          No tracks found
        </div>
      </Show>

      <Show when={!props.isLoading && !props.error && props.tracks.length > 0}>
        <For each={props.tracks}>
          {(track) => (
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
            </div>
          )}
        </For>
      </Show>
    </div>
  );
};

export default TopTrackList;

