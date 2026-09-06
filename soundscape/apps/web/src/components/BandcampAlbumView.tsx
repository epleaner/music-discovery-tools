import { Component, Show, For, createResource } from 'solid-js';
import { trpc } from '../lib/trpc.js';
import BandcampPlayer from './BandcampPlayer.js';
import { bcArtUrl } from '../lib/bandcamp-slug.js';

interface BandcampAlbumViewProps {
  albumUrl: string;
}

// Bandcamp returns dates like "13 Nov 2020 00:00:00 GMT" — show just the date.
const formatReleaseDate = (raw: string) => {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw.replace(/\s\d{2}:\d{2}:\d{2}.*$/, '');
  }
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const BandcampAlbumView: Component<BandcampAlbumViewProps> = (props) => {
  const [album] = createResource(
    () => props.albumUrl,
    (url) => trpc.bandcamp.getAlbum.query({ albumUrl: url })
  );

  return (
    <div class="p-4 text-xs overflow-y-auto h-full">
      <Show when={album.loading}>
        <div class="text-fg-muted">Loading...</div>
      </Show>

      <Show when={!album.loading && (album.error || !album())}>
        <div class="text-fg-muted">
          <div class="mb-2">Album not found.</div>
          <a
            href={props.albumUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="text-fg underline hover:text-fg-muted break-all"
          >
            {props.albumUrl}
          </a>
        </div>
      </Show>

      <Show when={!album.loading && album()}>
        {(data) => (
          <div>
            <div class="flex gap-3 mb-3">
              <Show when={data().imageUrl}>
                <img
                  src={bcArtUrl(data().imageUrl!, '_10')}
                  alt={data().name}
                  class="w-24 h-24 object-cover rounded shrink-0"
                />
              </Show>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-fg leading-tight">
                  <Show when={data().artist}>
                    <span>{data().artist} — </span>
                  </Show>
                  <span>{data().name}</span>
                </div>
                <Show when={data().releaseDate}>
                  <div class="text-fg-muted mt-0.5">{formatReleaseDate(data().releaseDate!)}</div>
                </Show>
                <Show when={data().label}>
                  <div class="text-fg-muted">{data().label!.name}</div>
                </Show>
                <div class="mt-1">
                  <a
                    href={props.albumUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-fg-muted underline hover:text-fg"
                  >
                    Buy on Bandcamp
                  </a>
                </div>
              </div>
            </div>

            <Show when={data().description}>
              <p class="text-fg-muted mb-3 line-clamp-3">{data().description}</p>
            </Show>

            <Show when={data().keywords.length > 0}>
              <div class="flex flex-wrap gap-1 mb-3">
                <For each={data().keywords}>
                  {(tag) => (
                    <span class="control-size px-1.5 rounded bg-bg-subtle text-fg-muted">
                      {tag}
                    </span>
                  )}
                </For>
              </div>
            </Show>

            <BandcampPlayer tracks={data().tracks} />
          </div>
        )}
      </Show>
    </div>
  );
};

export default BandcampAlbumView;
