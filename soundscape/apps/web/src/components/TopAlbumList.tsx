import { Component, Show, For } from 'solid-js';
import type { TopAlbum } from '@soundscape/types';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';
import Artwork from './Artwork';

interface TopAlbumListProps {
  albums: TopAlbum[];
  isLoading: boolean;
  error: Error | null;
  onAlbumClick?: (album: TopAlbum) => void;
}

const TopAlbumList: Component<TopAlbumListProps> = (props) => {
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
        when={!props.isLoading && !props.error && props.albums.length === 0}
      >
        <EmptyState class="section-content">No albums found</EmptyState>
      </Show>

      <Show when={!props.isLoading && !props.error && props.albums.length > 0}>
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
                  <span class="list-meta">{album.artist.name}</span>
                  <span class="list-count">{album.playcount} plays</span>
                </span>
              </button>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
};

export default TopAlbumList;
