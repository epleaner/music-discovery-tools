import { Component, Show, For } from 'solid-js';
import type { BandcampRelease, BandcampAlbumDetail } from '@soundscape/types';
import BandcampPlayer from './BandcampPlayer';
import Button from './Button';
import Chip from './Chip';
import ExternalLink from './ExternalLink';

interface BandcampResultsProps {
  releases: BandcampRelease[];
  album: BandcampAlbumDetail | null;
  currentLabel: { name: string; url: string } | null;
  status: string | null;
  isLabelResult: boolean;
  isRelatedResult: boolean;
  showExploreLabel?: boolean;
  showRelated?: boolean;
  onExploreLabel?: () => void;
  onRelated?: () => void;
}

const BandcampResults: Component<BandcampResultsProps> = (props) => {
  return (
    <>
      <Show when={props.status}>
        <div class="text-fg-muted">{props.status}</div>
      </Show>

      <div class="flex flex-wrap gap-2">
        <Show when={props.showExploreLabel}>
          <Button
            onClick={() => props.onExploreLabel?.()}
            variant="secondary"
            class="text-xs px-3 py-1"
          >
            Explore label: {props.currentLabel?.name} →
          </Button>
        </Show>
        <Show when={props.showRelated}>
          <Button
            onClick={() => props.onRelated?.()}
            variant="secondary"
            class="text-xs px-3 py-1"
          >
            Related →
          </Button>
        </Show>
        <Show when={props.album}>
          <ExternalLink
            href={props.album!.url}
            class="btn-secondary text-xs px-3 py-1"
          >
            Buy / open on Bandcamp ↗
          </ExternalLink>
        </Show>
      </div>

      <Show when={props.album}>
        <div class="flex flex-col gap-3">
          <div class="flex gap-3">
            <Show when={props.album!.imageUrl}>
              <img
                src={props.album!.imageUrl}
                alt={props.album!.title}
                class="w-24 h-24 object-cover rounded shrink-0"
              />
            </Show>
            <div class="flex flex-col gap-1 min-w-0">
              <div class="font-medium text-fg leading-tight">{props.album!.title}</div>
              <div class="text-fg-muted">{props.album!.artist}</div>
              <Show when={props.album!.releaseDate}>
                <div class="text-fg-subtle">
                  {props.album!.releaseDate!.replace(/ \d{2}:\d{2}:\d{2}.*/, '')}
                </div>
              </Show>
            <Show when={props.album!.tags && props.album!.tags!.length > 0}>
              <div class="flex flex-wrap gap-1 mt-1">
                <For each={props.album!.tags}>
                  {(tag) => <Chip>{tag}</Chip>}
                </For>
              </div>
            </Show>
                </div>
            </div>
          <BandcampPlayer
            tracks={props.album!.tracks.map((t, i) => ({
              name: t.name,
              position: t.position ?? i + 1,
              duration: t.duration ?? null,
              streamUrl: t.streamUrl ?? null,
            }))}
          />
        </div>
      </Show>

      <Show when={props.releases.length > 0}>
        <Show when={props.isLabelResult && props.currentLabel}>
          <div class="text-xs font-medium text-fg">Releases on {props.currentLabel?.name}</div>
        </Show>
        <Show when={props.isRelatedResult}>
          <div class="text-xs font-medium text-fg">You may also like</div>
        </Show>
        <div class="grid grid-cols-2 gap-3">
          <For each={props.releases}>
            {(release) => (
              <ExternalLink
                href={release.url}
                class="flex flex-col gap-1.5 rounded-md border border-border p-2 hover:bg-bg-muted transition-colors"
              >
                <Show when={release.imageUrl}>
                  <img
                    src={release.imageUrl}
                    alt={release.title}
                    class="w-full aspect-square object-cover rounded"
                  />
                </Show>
                <div class="font-medium text-fg leading-tight">{release.title}</div>
                <Show when={release.artist}>
                  <div class="text-fg-muted">{release.artist}</div>
                </Show>
              </ExternalLink>
            )}
          </For>
        </div>
      </Show>
    </>
  );
};

export default BandcampResults;
