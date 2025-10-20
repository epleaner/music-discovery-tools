import { Component, For, Show, createSignal } from 'solid-js';
import type { RecentAlbum, Track, AlbumInfo } from '@soundscape/types';
import { getRYMAlbumUrl, fetchAlbumInfo } from '@soundscape/utils';

interface AlbumListProps {
  albums: RecentAlbum[];
  tracks: Track[];
  isLoading?: boolean;
  error?: Error | null;
  onArtistClick?: (artistName: string) => void;
}

const AlbumList: Component<AlbumListProps> = (props) => {
  const [expandedAlbums, setExpandedAlbums] = createSignal<Set<string>>(
    new Set()
  );
  const [albumInfoExpanded, setAlbumInfoExpanded] = createSignal<Set<string>>(
    new Set()
  );
  const [albumInfoCache, setAlbumInfoCache] = createSignal<Record<string, AlbumInfo>>({});

  const toggleAlbumInfo = async (album: RecentAlbum, e: MouseEvent) => {
    e.stopPropagation();
    const key = getAlbumKey(album);
    
    setAlbumInfoExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    if (!albumInfoCache()[key]) {
      try {
        const response = await fetchAlbumInfo(album.artist, album.name);
        setAlbumInfoCache({ ...albumInfoCache(), [key]: response.album });
      } catch (err) {
        console.error('Failed to fetch album info:', err);
      }
    }
  };

  const getImageUrl = (album: RecentAlbum) => {
    const image = album.image?.find(
      (img) => img.size === 'small' || img.size === 'medium'
    );
    return image?.['#text'] || '';
  };

  const formatDate = (album: RecentAlbum) => {
    const date = new Date(parseInt(album.lastPlayed) * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const formatTrackDate = (track: Track) => {
    if (!track.date) return 'Now';
    const date = new Date(parseInt(track.date.uts) * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const toggleAlbum = (albumKey: string) => {
    setExpandedAlbums((prev) => {
      const next = new Set(prev);
      if (next.has(albumKey)) {
        next.delete(albumKey);
      } else {
        next.add(albumKey);
      }
      return next;
    });
  };

  const getAlbumKey = (album: RecentAlbum) => `${album.name}::${album.artist}`;

  const getTracksForAlbum = (album: RecentAlbum) => {
    return props.tracks.filter(
      (track) =>
        track.album['#text'] === album.name &&
        track.artist['#text'] === album.artist
    );
  };

  const isExpanded = (albumKey: string) => expandedAlbums().has(albumKey);

  return (
    <div class='space-y-px'>
      <Show when={props.error}>
        <div class='p-2 text-xs bg-bg-muted border border-border'>
          {props.error?.message}
        </div>
      </Show>

      <Show when={props.isLoading && props.albums.length === 0}>
        <div class='py-8 text-xs text-center text-fg-muted'>Loading...</div>
      </Show>

      <For each={props.albums}>
        {(album) => {
          const albumKey = getAlbumKey(album);
          const expanded = () => isExpanded(albumKey);
          const albumTracks = () => getTracksForAlbum(album);

          return (
            <div class='border-b border-border'>
              <div
                class='flex items-center gap-2 p-2 transition-colors cursor-pointer hover:bg-bg-subtle'
                onClick={() => toggleAlbum(albumKey)}>
                <Show when={getImageUrl(album)}>
                  <img
                    src={getImageUrl(album)}
                    alt={album.name}
                    class='w-8 h-8'
                  />
                </Show>
                <div class='flex-1 min-w-0'>
                  <div class='flex items-center gap-2'>
                    <div class='text-sm truncate'>{album.name}</div>
                    <a
                      href={getRYMAlbumUrl(album.artist, album.name)}
                      target='_blank'
                      rel='noopener noreferrer'
                      onClick={(e) => e.stopPropagation()}
                      class='text-xs text-fg-subtle hover:text-fg whitespace-nowrap'
                      title='View on RateYourMusic'>
                      rym
                    </a>
                  </div>
                  <div class='flex items-center gap-2'>
                    <div class='text-xs truncate text-fg-muted'>
                      {album.artist}
                    </div>
                    <Show when={props.onArtistClick}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onArtistClick?.(album.artist);
                        }}
                        class='text-xs text-fg-subtle hover:text-fg whitespace-nowrap'>
                        similar →
                      </button>
                    </Show>
                  </div>
                </div>
                <div class='flex items-center gap-2'>
                  <div class='text-xs text-fg-subtle'>
                    {album.trackCount}{' '}
                    {album.trackCount === 1 ? 'track' : 'tracks'}
                  </div>
                  <div class='text-xs text-fg-subtle whitespace-nowrap'>
                    {formatDate(album)}
                  </div>
                  <div class='text-xs text-fg-subtle'>
                    {expanded() ? '−' : '+'}
                  </div>
                  <button
                    onClick={(e) => toggleAlbumInfo(album, e)}
                    class='text-xs text-fg-subtle hover:text-fg px-1'
                    title='Toggle album info'>
                    {albumInfoExpanded().has(albumKey) ? '−' : 'ⓘ'}
                  </button>
                </div>
              </div>
              <Show when={expanded()}>
                <div class='bg-bg-subtle'>
                  <For each={albumTracks()}>
                    {(track) => (
                      <div class='flex items-center gap-2 px-2 py-1 pl-12 border-t border-border'>
                        <div class='flex-1 min-w-0'>
                          <div class='text-xs truncate'>{track.name}</div>
                        </div>
                        <div class='text-xs text-fg-subtle whitespace-nowrap'>
                          {formatTrackDate(track)}
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={albumInfoExpanded().has(albumKey) && albumInfoCache()[albumKey]}>
                <div class='px-4 py-2 bg-bg-subtle border-t border-border text-xs'>
                  <Show when={albumInfoCache()[albumKey]?.tags?.tag && albumInfoCache()[albumKey]!.tags.tag.length > 0}>
                    <div class='flex gap-1 flex-wrap'>
                      <span class='text-fg-muted'>Tags:</span>
                      <For each={albumInfoCache()[albumKey]!.tags.tag.slice(0, 5)}>
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

      <Show
        when={props.albums.length === 0 && !props.isLoading && !props.error}>
        <div class='py-8 text-xs text-center text-fg-muted'>No albums</div>
      </Show>
    </div>
  );
};

export default AlbumList;
