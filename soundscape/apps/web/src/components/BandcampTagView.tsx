import { Component, Show, For, createResource } from 'solid-js';
import { trpc } from '../lib/trpc.js';
import { bcArtUrl } from '../lib/bandcamp-slug.js';

interface BandcampTagViewProps {
  tag: string;
  onAlbumClick: (url: string) => void;
  onBack: () => void;
}

const normalizeTag = (tag: string) =>
  tag
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[']/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9-]/g, '');

const BandcampTagView: Component<BandcampTagViewProps> = (props) => {
  const [releases] = createResource(
    () => props.tag,
    (tag) => trpc.bandcamp.getTagReleases.query({ tag: normalizeTag(tag), page: 1 })
  );

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex flex-shrink-0 items-center gap-2 p-2 border-b border-border">
        <button
          onClick={props.onBack}
          class="text-xs text-fg-muted hover:text-fg px-1 py-0.5"
        >
          ← Back
        </button>
        <span class="text-xs font-medium text-fg truncate">{props.tag}</span>
      </div>

      <div class="overflow-y-auto flex-1 p-3">
        <Show when={releases.loading}>
          <div class="text-xs text-fg-muted">Loading...</div>
        </Show>

        <Show when={!releases.loading && releases.error}>
          <div class="text-xs text-fg-muted">Failed to load releases.</div>
        </Show>

        <Show when={!releases.loading && releases()}>
          {(data) => (
            <div class="grid grid-cols-2 gap-2">
              <For each={data()}>
                {(release) => (
                  <button
                    class="text-left flex flex-col gap-1 p-1.5 rounded hover:bg-bg-subtle transition-colors"
                    onClick={() => props.onAlbumClick(release.url)}
                  >
                    <Show
                      when={release.imageUrl}
                      fallback={
                        <div class="w-full aspect-square bg-bg-subtle rounded" />
                      }
                    >
                      <img
                        src={bcArtUrl(release.imageUrl!, '_9')}
                        alt={release.name}
                        class="w-full aspect-square object-cover rounded"
                      />
                    </Show>
                    <div class="text-[10px] leading-tight font-medium text-fg line-clamp-2">
                      {release.name}
                    </div>
                    <Show when={release.artist}>
                      <div class="text-[10px] leading-tight text-fg-muted line-clamp-1">
                        {release.artist}
                      </div>
                    </Show>
                  </button>
                )}
              </For>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
};

export default BandcampTagView;
