import { Component, Show, For, createResource, createEffect } from 'solid-js';
import { trpc } from '../lib/trpc.js';
import { bcArtUrl } from '../lib/bandcamp-slug.js';

interface Props {
  bandUrl: string;
  onAlbumClick: (albumUrl: string) => void;
  onSlugGuessFailed?: () => void;
}

const BandcampArtistView: Component<Props> = (props) => {
  const [data] = createResource(
    () => props.bandUrl,
    (url) =>
      Promise.all([
        trpc.bandcamp.getArtist.query({ bandUrl: url }),
        trpc.bandcamp.getDiscography.query({ bandUrl: url }),
      ])
  );

  createEffect(() => {
    if (!data.loading && data()) {
      const [artist, discography] = data()!;
      if (!artist && discography.length === 0) {
        props.onSlugGuessFailed?.();
      }
    }
  });

  const artist = () => data()?.[0];
  const discography = () =>
    (data()?.[1] ?? []).filter(
      (e) => e.type === 'album' || e.type === 'ep'
    );

  return (
    <div class="p-4 text-xs overflow-y-auto h-full">
      <Show when={data.loading}>
        <div class="text-fg-muted">Loading...</div>
      </Show>

      <Show when={!data.loading && data()}>
        <Show when={artist()}>
          {(a) => (
            <div class="mb-4">
              <div class="flex gap-3 mb-3">
                <Show when={bcArtUrl(a().imageUrl, '_10')}>
                  <img
                    src={bcArtUrl(a().imageUrl, '_10')!}
                    alt={a().name}
                    class="w-20 h-20 object-cover rounded shrink-0"
                  />
                </Show>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-fg leading-tight">{a().name}</div>
                  <Show when={a().location}>
                    <div class="text-fg-muted mt-0.5">{a().location}</div>
                  </Show>
                </div>
              </div>
              <Show when={a().description}>
                <p class="text-fg-muted line-clamp-3 mb-3">{a().description}</p>
              </Show>
            </div>
          )}
        </Show>

        <Show when={discography().length > 0}>
          <div>
            <div class="text-fg-muted mb-2 font-medium">Discography</div>
            <div class="space-y-1">
              <For each={discography()}>
                {(entry) => (
                  <button
                    class="w-full text-left px-2 py-1.5 rounded hover:bg-bg-subtle text-fg-muted hover:text-fg transition-colors"
                    onClick={() => props.onAlbumClick(entry.url)}
                  >
                    {entry.name}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default BandcampArtistView;
