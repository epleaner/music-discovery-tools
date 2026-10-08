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
        <div class="status break-words" role="status">
          {props.status}
        </div>
      </Show>

      <div class="result-actions">
        <Show when={props.showExploreLabel}>
          <Button
            onClick={() => props.onExploreLabel?.()}
            variant="secondary"
            class="max-w-full whitespace-normal text-left"
          >
            Explore label: {props.currentLabel?.name}
          </Button>
        </Show>
        <Show when={props.showRelated}>
          <Button onClick={() => props.onRelated?.()} variant="secondary">
            Related releases
          </Button>
        </Show>
        <Show when={props.album}>
          <ExternalLink
            href={props.album!.url}
            class="btn-secondary max-w-full whitespace-normal"
          >
            Buy / open on Bandcamp
          </ExternalLink>
        </Show>
      </div>

      <Show when={props.album}>
        <div class="space-y-4">
          <div class="result-row">
            <Show when={props.album!.imageUrl}>
              <img
                src={props.album!.imageUrl}
                alt={props.album!.title}
                class="result-cover"
                width="64"
                height="64"
              />
            </Show>
            <div class="result-main">
              <h3 class="entity-heading break-words">{props.album!.title}</h3>
              <div class="result-meta break-words">{props.album!.artist}</div>
              <Show when={props.album!.releaseDate}>
                <div class="result-meta">
                  {props.album!.releaseDate!.replace(
                    / \d{2}:\d{2}:\d{2}.*/,
                    ''
                  )}
                </div>
              </Show>
              <Show when={props.album!.tags && props.album!.tags!.length > 0}>
                <div class="result-actions">
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
          <h3 class="section-title">Releases on {props.currentLabel?.name}</h3>
        </Show>
        <Show when={props.isRelatedResult}>
          <h3 class="section-title">Related releases</h3>
        </Show>
        <div class="result-list">
          <For each={props.releases}>
            {(release) => (
              <article class="result-row">
                <Show when={release.imageUrl}>
                  <img
                    src={release.imageUrl}
                    alt={release.title}
                    class="result-cover"
                    width="64"
                    height="64"
                    loading="lazy"
                  />
                </Show>
                <div class="result-main">
                  <h4 class="result-title break-words">
                    <ExternalLink href={release.url}>
                      {release.title}
                    </ExternalLink>
                  </h4>
                  <Show when={release.artist}>
                    <div class="result-meta break-words">{release.artist}</div>
                  </Show>
                </div>
              </article>
            )}
          </For>
        </div>
      </Show>
    </>
  );
};

export default BandcampResults;
