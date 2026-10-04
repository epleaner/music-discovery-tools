import { Component, Show, For, createSignal, createEffect } from 'solid-js';
import type { TopTrack, TrackInfo, TrackInfoResponse } from '@soundscape/types';
import {
  fetchTrackInfo,
  getCached,
  getTrackCacheKey,
} from '@soundscape/utils';
import Button from './Button';
import EmptyState from './EmptyState';
import InfoButton from './InfoButton';

interface TopTrackListProps {
  tracks: TopTrack[];
  isLoading: boolean;
  error: Error | null;
  onTrackClick?: (track: TopTrack) => void;
  onNTSLookup?: (track: TopTrack) => void;
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
        <EmptyState class='p-4 text-center'>Loading...</EmptyState>
      </Show>
      <Show when={props.error}>
        <EmptyState class='p-4 text-center'>
          Error: {props.error?.toString()}
        </EmptyState>
      </Show>

      <Show
        when={!props.isLoading && !props.error && props.tracks.length === 0}>
        <EmptyState class="p-4 text-center">No tracks found</EmptyState>
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
              <div
                class='flex items-center gap-2 p-2 text-xs border-b border-border hover:bg-bg-subtle cursor-pointer'
                onClick={() => props.onTrackClick?.(track)}>
                <div class='flex-1 min-w-0'>
                  <div class='font-medium truncate'>{track.name}</div>
                  <div class='flex gap-1 items-center text-fg-muted'>
                    <span>{track.artist.name}</span>
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
                <Button
                  variant='link'
                  class='px-1 text-xs'
                  title={`Search NTS for ${track.name}`}
                  aria-label={`Search NTS for ${track.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onNTSLookup?.(track);
                  }}
                >
                  NTS
                </Button>
                <div class='flex-shrink-0 text-fg-subtle'>
                  {track.playcount} plays
                </div>
                <Show when={isLoading() || !info()}>
                  <InfoButton
                    loading={isLoading()}
                    label="track"
                    onClick={(e: MouseEvent) => handleInfoClick(track, e)}
                  />
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
