import { Component, Show, For } from 'solid-js';
import type { TopAlbum } from '@soundscape/types';
import { getRYMAlbumUrl } from '@soundscape/utils';

interface TopAlbumListProps {
  albums: TopAlbum[];
  isLoading: boolean;
  error: any;
  onArtistClick?: (artistName: string) => void;
}

const TopAlbumList: Component<TopAlbumListProps> = (props) => {
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

      <Show when={!props.isLoading && !props.error && props.albums.length === 0}>
        <div class='p-4 text-xs text-center text-fg-muted'>
          No albums found
        </div>
      </Show>

      <Show when={!props.isLoading && !props.error && props.albums.length > 0}>
        <For each={props.albums}>
          {(album) => (
            <div class='flex items-center gap-2 p-2 text-xs border-b border-border hover:bg-bg-subtle'>
              <div class='flex-1 min-w-0'>
                <div class='flex gap-1 items-center'>
                  <span class='font-medium truncate'>{album.name}</span>
                  <a
                    href={getRYMAlbumUrl(album.artist.name, album.name)}
                    target='_blank'
                    rel='noopener noreferrer'
                    class='text-[10px] hover:underline text-fg-subtle'
                    title='View on RateYourMusic'>
                    rym
                  </a>
                </div>
                <div class='flex gap-1 items-center text-fg-muted'>
                  <button
                    onClick={() => props.onArtistClick?.(album.artist.name)}
                    class='hover:underline'>
                    {album.artist.name}
                  </button>
                  <button
                    onClick={() => props.onArtistClick?.(album.artist.name)}
                    class='text-[10px] hover:underline'
                    title='View similar artists'>
                    similar →
                  </button>
                </div>
              </div>
              <div class='flex-shrink-0 text-fg-subtle'>
                {album.playcount} plays
              </div>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
};

export default TopAlbumList;

