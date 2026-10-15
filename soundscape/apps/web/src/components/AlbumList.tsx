import { Component, For, Show } from 'solid-js';
import type { RecentAlbum, Track } from '@soundscape/types';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';
import Artwork from './Artwork';

interface AlbumListProps {
  albums: RecentAlbum[];
  tracks: Track[];
  isLoading?: boolean;
  error?: Error | null;
  onAlbumClick?: (album: RecentAlbum) => void;
}

const AlbumList: Component<AlbumListProps> = (props) => {
  const formatDate = (album: RecentAlbum) => {
    const date = new Date(parseInt(album.lastPlayed) * 1000);
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

      <Show when={props.isLoading && props.albums.length === 0}>
        <EmptyState class="section-content">Loading...</EmptyState>
      </Show>

      <div>
        <For each={props.albums}>
          {(album) => (
            <div class="list-row">
              <button
                type="button"
                class="list-select"
                onClick={() => props.onAlbumClick?.(album)}
              >
                <Artwork images={album.image} />
                <span class="list-main">
                  <span class="list-title">{album.name}</span>
                  <span class="list-meta">{album.artist}</span>
                  <span class="list-count">{formatDate(album)}</span>
                </span>
              </button>
            </div>
          )}
        </For>
      </div>

      <Show
        when={props.albums.length === 0 && !props.isLoading && !props.error}
      >
        <EmptyState class="section-content">No albums</EmptyState>
      </Show>
    </div>
  );
};

export default AlbumList;
