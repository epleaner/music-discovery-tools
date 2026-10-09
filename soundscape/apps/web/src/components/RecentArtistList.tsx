import { Component, For, Show } from 'solid-js';
import type { RecentArtist, Track } from '@soundscape/types';
import LookupActions from './LookupActions';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';
import Artwork from './Artwork';

interface RecentArtistListProps {
  artists: RecentArtist[];
  tracks: Track[];
  isLoading?: boolean;
  error?: Error | null;
  onArtistRowClick?: (artist: RecentArtist) => void;
  onNTSLookup?: (artistName: string) => void;
}

const RecentArtistList: Component<RecentArtistListProps> = (props) => {
  return (
    <div>
      <Show when={props.error}>
        <ErrorMessage class="section-content">
          {props.error?.message}
        </ErrorMessage>
      </Show>

      <Show when={props.isLoading && props.artists.length === 0}>
        <EmptyState class="section-content">Loading...</EmptyState>
      </Show>

      <div>
        <For each={props.artists}>
          {(artist) => (
            <div class="list-row">
              <button
                type="button"
                class="list-select"
                onClick={() => props.onArtistRowClick?.(artist)}
              >
                <Artwork images={artist.image} />
                <span class="list-main">
                  <span class="list-title">{artist.name}</span>
                  <span class="list-count">
                    {artist.trackCount}{' '}
                    {artist.trackCount === 1 ? 'track' : 'tracks'}
                  </span>
                </span>
              </button>
              <LookupActions
                artist={artist.name}
                onNTSLookup={props.onNTSLookup}
              />
            </div>
          )}
        </For>
      </div>

      <Show
        when={props.artists.length === 0 && !props.isLoading && !props.error}
      >
        <EmptyState class="section-content">No artists</EmptyState>
      </Show>
    </div>
  );
};

export default RecentArtistList;
