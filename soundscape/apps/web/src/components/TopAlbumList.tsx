import { Component, Show, For, createSignal } from 'solid-js';
import type { TopAlbum, AlbumInfo } from '@soundscape/types';
import { getRYMAlbumUrl, fetchAlbumInfo } from '@soundscape/utils';

interface TopAlbumListProps {
  albums: TopAlbum[];
  isLoading: boolean;
  error: any;
  onArtistClick?: (artistName: string) => void;
}

const TopAlbumList: Component<TopAlbumListProps> = (props) => {
  const [expandedAlbumKey, setExpandedAlbumKey] = createSignal<string | null>(null);
  const [albumInfoCache, setAlbumInfoCache] = createSignal<Record<string, AlbumInfo>>({});

  const getAlbumKey = (album: TopAlbum) => `${album.artist.name}-${album.name}`;

  const toggleAlbumInfo = async (album: TopAlbum) => {
    const key = getAlbumKey(album);
    if (expandedAlbumKey() === key) {
      setExpandedAlbumKey(null);
    } else {
      setExpandedAlbumKey(key);
      if (!albumInfoCache()[key]) {
        try {
          const response = await fetchAlbumInfo(album.artist.name, album.name);
          setAlbumInfoCache({ ...albumInfoCache(), [key]: response.album });
        } catch (err) {
          console.error('Failed to fetch album info:', err);
        }
      }
    }
  };

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
          {(album) => {
            const key = getAlbumKey(album);
            const isExpanded = () => expandedAlbumKey() === key;
            const info = () => albumInfoCache()[key];
            
            return (
              <div>
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
                  <button
                    onClick={() => toggleAlbumInfo(album)}
                    class='text-xs text-fg-subtle hover:text-fg px-1'
                    title='Toggle album info'>
                    {isExpanded() ? '−' : 'ⓘ'}
                  </button>
                </div>
                <Show when={isExpanded() && info()}>
                  <div class='px-4 py-2 bg-bg-subtle border-b border-border text-xs'>
                    <Show when={info()?.tags?.tag && info()!.tags.tag.length > 0}>
                      <div class='flex gap-1 flex-wrap'>
                        <span class='text-fg-muted'>Tags:</span>
                        <For each={info()!.tags.tag.slice(0, 5)}>
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
      </Show>
    </div>
  );
};

export default TopAlbumList;

