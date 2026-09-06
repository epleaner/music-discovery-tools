import { Component, For, Show, createSignal, createEffect } from 'solid-js';
import type { Track, TrackInfo, TrackInfoResponse } from '@soundscape/types';
import {
  fetchTrackInfo,
  getCached,
  getTrackCacheKey,
} from '@soundscape/utils';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';
import InfoButton from './InfoButton';

interface TrackListProps {
  tracks: Track[];
  isLoading?: boolean;
  error?: Error | null;
  onTrackClick?: (track: Track) => void;
}

const TrackList: Component<TrackListProps> = (props) => {
  const [trackInfoCache, setTrackInfoCache] = createSignal<
    Record<string, TrackInfo>
  >({});
  const [loadingInfo, setLoadingInfo] = createSignal<Set<string>>(new Set());

  const getTrackKey = (track: Track) =>
    `${track.artist['#text']}-${track.name}`;

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

  const handleInfoClick = (track: Track, e: MouseEvent) => {
    e.stopPropagation();
    const key = getTrackKey(track);
    fetchTrackInfoForKey(key, track.artist['#text'], track.name);
  };

  const getImageUrl = (track: Track) => {
    const image = track.image?.find(
      (img) => img.size === 'small' || img.size === 'medium'
    );
    return image?.['#text'] || '';
  };

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
    <div class='space-y-px'>
      <Show when={props.error}>
        <ErrorMessage class="p-2 bg-bg-muted border border-border">
          {props.error?.message}
        </ErrorMessage>
      </Show>

      <Show when={props.isLoading && props.tracks.length === 0}>
        <EmptyState class="py-8 text-center">Loading...</EmptyState>
      </Show>

      <For each={props.tracks}>
        {(track) => {
          const key = getTrackKey(track);
          const info = () => trackInfoCache()[key];
          const isLoading = () => loadingInfo().has(key);

          // Check cache immediately and load if available (but don't fetch from API)
          createEffect(() => {
            if (!info()) {
              loadCachedInfoForKey(key, track.artist['#text'], track.name);
            }
          });

          return (
            <div
              class='flex items-center gap-2 p-2 transition-colors border-b border-border hover:bg-bg-subtle cursor-pointer'
              onClick={() => props.onTrackClick?.(track)}>
              <Show when={getImageUrl(track)}>
                <img
                  src={getImageUrl(track)}
                  alt={track.album['#text']}
                  class='w-8 h-8'
                />
              </Show>
              <div class='flex-1 min-w-0'>
                <div class='text-sm truncate'>{track.name}</div>
                <div class='flex items-center gap-2'>
                  <div class='text-xs truncate text-fg-muted'>
                    {track.artist['#text']}
                  </div>
                </div>
                <Show
                  when={info()?.toptags?.tag && info()!.toptags.tag.length > 0}>
                  <div class='flex gap-1 text-xs text-fg-muted'>
                    <For each={info()!.toptags.tag.slice(0, 3)}>
                      {(tag, index) => (
                        <span>
                          {tag.name}
                          {index() < Math.min(2, info()!.toptags.tag.length - 1)
                            ? ','
                            : ''}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
              <div class='text-xs text-fg-subtle whitespace-nowrap'>
                {formatDate(track)}
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

      <Show
        when={props.tracks.length === 0 && !props.isLoading && !props.error}>
        <EmptyState class="py-8 text-center">No tracks</EmptyState>
      </Show>
    </div>
  );
};

export default TrackList;
