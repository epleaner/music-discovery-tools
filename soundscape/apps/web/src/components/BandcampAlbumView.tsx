import { Component, Show, For, createResource, createMemo } from 'solid-js';
import { trpc } from '../lib/trpc.js';
import BandcampPlayer from './BandcampPlayer.js';
import { bcArtUrl } from '../lib/bandcamp-slug.js';

interface BandcampAlbumViewProps {
  albumUrl: string;
  onTagClick?: (tag: string) => void;
  onAlbumClick?: (albumUrl: string) => void;
}

const normalizeUrl = (url: string) => url.replace(/\/+$/, '');

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

  const primaryKeyword = createMemo(() => {
    const kw = album()?.keywords;
    return kw && kw.length > 0 ? kw[0] : null;
  });

  const [relatedReleases] = createResource(
    () => primaryKeyword() ?? undefined,
    (tag) => trpc.bandcamp.getTagReleases.query({ tag, page: 1 })
  );

  const filteredReleases = createMemo(() => {
    const releases = relatedReleases();
    if (!releases) return [];
    const current = normalizeUrl(props.albumUrl);
    return releases.filter((r) => normalizeUrl(r.url) !== current);
  });

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
                    <button
                      class="px-1.5 py-0.5 rounded bg-bg-subtle text-fg-muted hover:text-fg hover:bg-border text-[10px]"
                      onClick={() => props.onTagClick?.(tag)}
                    >
                      {tag}
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <BandcampPlayer tracks={data().tracks} />

            <Show when={primaryKeyword() && !relatedReleases.loading && filteredReleases().length > 0}>
              <div class="mt-4">
                <div class="text-[10px] font-medium text-fg-muted uppercase tracking-wide mb-2">
                  Related in {primaryKeyword()}
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <For each={filteredReleases()}>
                    {(release) => (
                      <button
                        class="text-left flex flex-col gap-1 p-1.5 rounded hover:bg-bg-subtle transition-colors"
                        onClick={() => props.onAlbumClick?.(release.url)}
                      >
                        <Show
                          when={release.imageUrl}
                          fallback={<div class="w-full aspect-square bg-bg-subtle rounded" />}
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
              </div>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
};

export default BandcampAlbumView;
