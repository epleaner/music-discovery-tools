import { Component, For, Show, createSignal, createEffect } from 'solid-js';
import type { Track, TrackInfo, TrackInfoResponse } from '@soundscape/types';
import { fetchTrackInfo, getCached, getTrackCacheKey } from '@soundscape/utils';
import Button from './Button';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';
import InfoButton from './InfoButton';
import Artwork from './Artwork';

interface TrackListProps {
  tracks: Track[];
  isLoading?: boolean;
  error?: Error | null;
  onTrackClick?: (track: Track) => void;
  onNTSLookup?: (track: Track) => void;
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
            <div class="list-row">
              <button
                type="button"
                class="list-select"
                onClick={() => props.onTrackClick?.(track)}
              >
                <Artwork images={track.image} />
                <span class="list-main">
                  <span class="list-title block">{track.name}</span>
                  <span class="list-meta block">{track.artist['#text']}</span>
                  <Show
                    when={
                      info()?.toptags?.tag && info()!.toptags.tag.length > 0
                    }
                  >
                    <span class="list-meta block">
                      <For each={info()!.toptags.tag.slice(0, 3)}>
                        {(tag, index) => (
                          <span>
                            {index() > 0 ? ', ' : ''}
                            {tag.name}
                          </span>
                        )}
                      </For>
                    </span>
                  </Show>
                  <span class="list-count block">{formatDate(track)}</span>
                </span>
              </button>
              <div class="list-actions">
                <Button
                  variant="link"
                  title={`Search NTS for ${track.name}`}
                  aria-label={`Search NTS for ${track.name}`}
                  onClick={() => props.onNTSLookup?.(track)}
                >
                  NTS
                </Button>
                <Show when={isLoading() || !info()}>
                  <InfoButton
                    loading={isLoading()}
                    label="track"
                    onClick={(e: MouseEvent) => handleInfoClick(track, e)}
                  />
                </Show>
              </div>
            </div>
          );
        }}
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
