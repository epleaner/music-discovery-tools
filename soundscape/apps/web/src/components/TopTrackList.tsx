import { Component, Show, For } from 'solid-js';
import type { TopTrack } from '@soundscape/types';
import LookupActions from './LookupActions';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';
import Artwork from './Artwork';

interface TopTrackListProps {
  tracks: TopTrack[];
  isLoading: boolean;
  error: Error | null;
  onTrackClick?: (track: TopTrack) => void;
}

const TopTrackList: Component<TopTrackListProps> = (props) => {
  return (
    <div>
      <Show when={props.isLoading}>
        <EmptyState class="section-content">Loading...</EmptyState>
      </Show>
      <Show when={props.error}>
        <ErrorMessage class="section-content">
          {props.error?.message}
        </ErrorMessage>
      </Show>

      <Show
        when={!props.isLoading && !props.error && props.tracks.length === 0}
      >
        <EmptyState class="section-content">No tracks found</EmptyState>
      </Show>

      <Show when={!props.isLoading && !props.error && props.tracks.length > 0}>
        <For each={props.tracks}>
          {(track) => (
            <div class="list-row">
              <button
                type="button"
                class="list-select"
                onClick={() => props.onTrackClick?.(track)}
              >
                <Artwork images={track.image} />
                <span class="list-main">
                  <span class="list-title">{track.name}</span>
                  <span class="list-meta">{track.artist.name}</span>
                  <span class="list-count">{track.playcount} plays</span>
                </span>
              </button>
              <LookupActions track={track.name} artist={track.artist.name} />
            </div>
          )}
        </For>
      </Show>
    </div>
  );
};

export default TopTrackList;
