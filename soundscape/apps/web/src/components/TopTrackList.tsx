import { Component, Show, For, createSignal, createEffect } from 'solid-js';
import type { TopTrack, TrackInfo, TrackInfoResponse } from '@soundscape/types';
import {
  fetchTrackInfo,
  getCached,
  getTrackCacheKey,
  getRYMSearchUrl,
} from '@soundscape/utils';

interface TopTrackListProps {
  tracks: TopTrack[];
  isLoading: boolean;
  error: any;
  onArtistClick?: (artistName: string) => void;
}

const TopTrackList: Component<TopTrackListProps> = (props) => {
  const [trackInfoCache, setTrackInfoCache] = createSignal<
    Record<string, TrackInfo>
  >({});
  const [loadingInfo, setLoadingInfo] = createSignal<Set<string>>(new Set());

  const getTrackKey = (track: TopTrack) => `${track.artist.name}-${track.name}`;

  const fetchTrackInfoForKey = async (
    key: string,
    artistName: string,
    trackName: string
  ) => {
    if (!trackInfoCache()[key]) {
      setLoadingInfo((prev) => new Set(prev).add(key));
      try {
        const response = await fetchTrackInfo(artistName, trackName);
        setTrackInfoCache({ ...trackInfoCache(), [key]: response.track });
      } catch (err) {
        console.error('Failed to fetch track info:', err);
      } finally {
        setLoadingInfo((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    }
  };

  const loadCachedInfoForKey = async (
    key: string,
    artistName: string,
    trackName: string
  ) => {
    const cacheKey = getTrackCacheKey(artistName, trackName);
    const cached = await getCached<TrackInfoResponse>(cacheKey);
    if (cached) {
      setTrackInfoCache({ ...trackInfoCache(), [key]: cached.track });
    }
  };

  const handleInfoClick = (track: TopTrack, e: MouseEvent) => {
    e.stopPropagation();
    const key = getTrackKey(track);
    fetchTrackInfoForKey(key, track.artist.name, track.name);
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

      <Show
        when={!props.isLoading && !props.error && props.tracks.length === 0}>
        <div class='p-4 text-xs text-center text-fg-muted'>No tracks found</div>
      </Show>

      <Show when={!props.isLoading && !props.error && props.tracks.length > 0}>
        <For each={props.tracks}>
          {(track) => {
            const key = getTrackKey(track);
            const info = () => trackInfoCache()[key];
            const isLoading = () => loadingInfo().has(key);

            // Check cache immediately and load if available (but don't fetch from API)
            createEffect(() => {
              if (!info()) {
                loadCachedInfoForKey(key, track.artist.name, track.name);
              }
            });

            return (
              <div class='flex items-center gap-2 p-2 text-xs border-b border-border hover:bg-bg-subtle'>
                <div class='flex-1 min-w-0'>
                  <div class='font-medium truncate'>{track.name}</div>
                  <div class='flex gap-1 items-center text-fg-muted'>
                    <button
                      onClick={() => props.onArtistClick?.(track.artist.name)}
                      class='hover:underline'>
                      {track.artist.name}
                    </button>
                    <a
                      href={getRYMSearchUrl(track.artist.name)}
                      target='_blank'
                      rel='noopener noreferrer'
                      onClick={(e) => e.stopPropagation()}
                      class='text-[10px] hover:underline text-fg-subtle'
                      title='View on RateYourMusic'>
                      rym
                    </a>
                    <button
                      onClick={() => props.onArtistClick?.(track.artist.name)}
                      class='text-[10px] hover:underline'
                      title='View similar artists'>
                      similar →
                    </button>
                  </div>
                  <Show
                    when={
                      info()?.toptags?.tag && info()!.toptags.tag.length > 0
                    }>
                    <div class='flex gap-1 text-fg-muted'>
                      <For each={info()!.toptags.tag.slice(0, 3)}>
                        {(tag, index) => (
                          <span>
                            {tag.name}
                            {index() <
                            Math.min(2, info()!.toptags.tag.length - 1)
                              ? ','
                              : ''}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
                <div class='flex-shrink-0 text-fg-subtle'>
                  {track.playcount} plays
                </div>
                <Show when={isLoading() || !info()}>
                  <button
                    onClick={(e) => handleInfoClick(track, e)}
                    class='text-xs text-fg-subtle hover:text-fg px-1'
                    title='Fetch track info'>
                    {isLoading() ? '◐' : 'ⓘ'}
                  </button>
                </Show>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
};

export default TopTrackList;
