import { Component, Show, For } from 'solid-js';
import type { BandcampRelease, BandcampAlbumDetail } from '@soundscape/types';
import BandcampPlayer from './BandcampPlayer';
import Button from './Button';
import Chip from './Chip';
import SourceLink from './SourceLink';
import EmptyState from './EmptyState';

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
      <Show when={!props.status && !props.album && props.releases.length === 0}>
        <EmptyState>No results</EmptyState>
      </Show>

      <Show
        when={
          (props.currentLabel && !props.isLabelResult) ||
          props.showExploreLabel ||
          props.showRelated ||
          props.album
        }
      >
        <div class="result-actions">
          <Show when={props.currentLabel && !props.isLabelResult}>
            <SourceLink
              href={props.currentLabel!.url}
              base="https://bandcamp.com"
            >
              {props.currentLabel!.name}
            </SourceLink>
          </Show>
          <Show when={props.showExploreLabel}>
            <Button
              onClick={() => props.onExploreLabel?.()}
              variant="secondary"
              class="max-w-full whitespace-normal text-left"
              aria-label={
                props.currentLabel
                  ? `Explore releases on ${props.currentLabel.name}`
                  : 'Explore label'
              }
            >
              Explore label
            </Button>
          </Show>
          <Show when={props.showRelated}>
            <Button onClick={() => props.onRelated?.()} variant="secondary">
              Related releases
            </Button>
          </Show>
          <Show when={props.album}>
            <SourceLink
              href={props.album!.url}
              base="https://bandcamp.com"
              class="btn-secondary max-w-full whitespace-normal"
            >
              Buy / open on Bandcamp
            </SourceLink>
          </Show>
        </div>
      </Show>

      <Show when={props.album}>
        <div class="space-y-4">
          <div class="result-list">
            <div class="result-row">
              <Show when={props.album!.imageUrl}>
                <SourceLink
                  href={props.album!.url}
                  base="https://bandcamp.com"
                  class="shrink-0"
                >
                  <img
                    src={props.album!.imageUrl}
                    alt={props.album!.title}
                    class="result-cover"
                    width="64"
                    height="64"
                  />
                </SourceLink>
              </Show>
              <div class="result-main">
                <h3 class="entity-heading break-words">
                  <SourceLink
                    href={props.album!.url}
                    base="https://bandcamp.com"
                  >
                    {props.album!.title}
                  </SourceLink>
                </h3>
                <div class="result-meta break-words">
                  <SourceLink
                    href={props.album!.artistUrl}
                    base={props.album!.url}
                  >
                    {props.album!.artist}
                  </SourceLink>
                </div>
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
                      {(tag) => (
                        <Chip>
                          <SourceLink
                            href={
                              props.album!.tagLinks?.find(
                                (link) => link.name === tag
                              )?.url
                            }
                            base={props.album!.url}
                          >
                            {tag}
                          </SourceLink>
                        </Chip>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </div>
          <BandcampPlayer
            tracks={props.album!.tracks.map((t, i) => ({
              name: t.name,
              url: t.url,
              position: t.position ?? i + 1,
              duration: t.duration ?? null,
              streamUrl: t.streamUrl ?? null,
            }))}
            base={props.album!.url}
          />
        </div>
      </Show>

      <Show when={props.releases.length > 0}>
        <Show when={props.isLabelResult && props.currentLabel}>
          <h3 class="section-title">
            Releases on{' '}
            <SourceLink
              href={props.currentLabel!.url}
              base="https://bandcamp.com"
            >
              {props.currentLabel!.name}
            </SourceLink>
          </h3>
        </Show>
        <Show when={props.isRelatedResult}>
          <h3 class="section-title">Related releases</h3>
        </Show>
        <div class="result-list">
          <For each={props.releases}>
            {(release) => (
              <article class="result-row">
                <Show when={release.imageUrl}>
                  <SourceLink
                    href={release.url}
                    base="https://bandcamp.com"
                    class="shrink-0"
                  >
                    <img
                      src={release.imageUrl}
                      alt={release.title}
                      class="result-cover"
                      width="64"
                      height="64"
                      loading="lazy"
                    />
                  </SourceLink>
                </Show>
                <div class="result-main">
                  <h4 class="result-title break-words">
                    <SourceLink href={release.url} base="https://bandcamp.com">
                      {release.title}
                    </SourceLink>
                  </h4>
                  <Show when={release.artist}>
                    <div class="result-meta break-words">
                      <SourceLink href={release.artistUrl} base={release.url}>
                        {release.artist}
                      </SourceLink>
                    </div>
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
