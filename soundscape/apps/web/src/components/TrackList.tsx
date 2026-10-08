import { Component, For, Show } from 'solid-js';
import type { Track } from '@soundscape/types';
import NTSTrackButton from './NTSTrackButton';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';
import Artwork from './Artwork';

interface TrackListProps {
  tracks: Track[];
  isLoading?: boolean;
  error?: Error | null;
  onTrackClick?: (track: Track) => void;
  onNTSLookup?: (track: Track) => void;
}

const TrackList: Component<TrackListProps> = (props) => {
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
    <div>
      <Show when={props.error}>
        <ErrorMessage class="section-content">
          {props.error?.message}
        </ErrorMessage>
      </Show>

      <Show when={props.isLoading && props.tracks.length === 0}>
        <EmptyState class="section-content">Loading...</EmptyState>
      </Show>

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
                <span class="list-meta">{track.artist['#text']}</span>
                <span class="list-count">{formatDate(track)}</span>
              </span>
            </button>
            <div class="list-actions">
              <NTSTrackButton
                track={track.name}
                artist={track.artist['#text']}
                onClick={() => props.onNTSLookup?.(track)}
              />
            </div>
          </div>
        )}
      </For>

      <Show
        when={props.tracks.length === 0 && !props.isLoading && !props.error}
      >
        <EmptyState class="section-content">No tracks</EmptyState>
      </Show>
    </div>
  );
};

export default TrackList;
