import { Component, For, Show, createMemo, createSignal } from 'solid-js';
import { createNewsletterDetailResource } from '../lib/newsletter-resource.js';
import {
  createNewsletterBandcampQuery,
  findBandcampHref,
  shouldEnableBandcampLookup,
} from '../lib/newsletter-bandcamp-query.js';
import type {
  NewsletterApi,
  NewsletterBandcampLookupItem,
  NewsletterSummary,
} from '../lib/newsletters.js';
import {
  formatNewsletterDate,
  type NewsletterLinkModel,
} from './newsletter-panel-model.js';

export interface NewsletterListProps {
  newsletters: NewsletterSummary[];
  isLoading?: boolean;
  error?: Error | null;
  api?: NewsletterApi;
}

interface ExpandableNewsletterRowProps {
  newsletter: NewsletterSummary;
  api?: NewsletterApi;
}

interface SectionToggleProps {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  count?: number;
}

interface BandcampEntityItem {
  name: string;
  primaryArtistName: string | null;
  text: string;
}

interface NewsletterModalProps {
  title: string;
  sourceLabel: string;
  summary: string | null;
  text: string | null;
  artists: BandcampEntityItem[];
  albums: BandcampEntityItem[];
  tracks: BandcampEntityItem[];
  links: NewsletterLinkModel[];
  artistLookups: NewsletterBandcampLookupItem[];
  albumLookups: NewsletterBandcampLookupItem[];
  trackLookups: NewsletterBandcampLookupItem[];
  isLoading: boolean;
  error: Error | null;
  bandcampError: Error | null;
  isBandcampLoading: boolean;
  onClose: () => void;
}

const SectionToggle: Component<SectionToggleProps> = (props) => {
  const suffix = () => (props.count != null ? ` (${props.count})` : '');

  return (
    <button
      type="button"
      onClick={props.onToggle}
      class={`px-1.5 py-0.5 text-[10px] border border-border transition-colors ${
        props.expanded ? 'bg-bg-subtle text-fg' : 'text-fg-muted hover:text-fg'
      }`}
    >
      {props.expanded ? '−' : '+'} {props.label}
      {suffix()}
    </button>
  );
};

const BandcampEntityText: Component<{
  item: BandcampEntityItem;
  lookups: NewsletterBandcampLookupItem[];
  linkClass?: string;
  textClass?: string;
}> = (props) => {
  const href = createMemo(() =>
    findBandcampHref(props.lookups, {
      name: props.item.name,
      primaryArtistName: props.item.primaryArtistName,
    })
  );

  return (
    <Show
      when={href()}
      fallback={<span class={props.textClass}>{props.item.text}</span>}
    >
      <a
        href={href() ?? '#'}
        target="_blank"
        rel="noreferrer"
        class={props.linkClass ?? 'hover:text-fg'}
      >
        {props.item.text}
      </a>
    </Show>
  );
};

const BandcampChipList: Component<{
  items: BandcampEntityItem[];
  lookups: NewsletterBandcampLookupItem[];
}> = (props) => {
  return (
    <div class="flex flex-wrap gap-1">
      <For each={props.items}>
        {(item) => (
          <div class="flex items-center gap-1 px-1.5 py-0.5 text-xs border border-border">
            <BandcampEntityText item={item} lookups={props.lookups} />
          </div>
        )}
      </For>
    </div>
  );
};

const BandcampTextList: Component<{
  items: BandcampEntityItem[];
  lookups: NewsletterBandcampLookupItem[];
}> = (props) => {
  return (
    <div class="space-y-1 text-xs">
      <For each={props.items}>
        {(item) => (
          <div class="flex items-center justify-between gap-2">
            <BandcampEntityText
              item={item}
              lookups={props.lookups}
              textClass="text-fg-muted"
              linkClass="text-fg-muted hover:text-fg"
            />
          </div>
        )}
      </For>
    </div>
  );
};

const NewsletterModal: Component<NewsletterModalProps> = (props) => {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-fg/20 px-4 py-6">
      <div class="flex max-h-full w-full max-w-3xl flex-col overflow-hidden border border-border bg-bg">
        <div class="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div class="min-w-0">
            <div class="text-[10px] uppercase tracking-[0.18em] text-fg-muted">
              {props.sourceLabel}
            </div>
            <div class="mt-1 text-sm font-medium">{props.title}</div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            class="px-2 py-1 text-xs border border-border text-fg-muted hover:text-fg"
          >
            Close
          </button>
        </div>

        <div class="overflow-y-auto px-4 py-3">
          <Show when={props.error}>
            <div class="text-xs text-fg-muted">{props.error?.message}</div>
          </Show>

          <Show when={props.bandcampError && !props.error}>
            <div class="mb-2 text-xs text-fg-muted">
              {props.bandcampError?.message}
            </div>
          </Show>

          <Show when={props.isLoading}>
            <div class="text-xs text-fg-muted">Loading full newsletter…</div>
          </Show>

          <Show when={props.isBandcampLoading && !props.isLoading}>
            <div class="mb-2 text-xs text-fg-muted">Loading Bandcamp links…</div>
          </Show>

          <Show when={!props.isLoading && !props.error && props.summary}>
            <section class="mb-4">
              <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
                Summary
              </div>
              <p class="text-xs leading-5 text-fg-muted">{props.summary}</p>
            </section>
          </Show>

          <Show when={!props.isLoading && !props.error && props.text}>
            <section class="mb-4">
              <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
                Full text
              </div>
              <p class="text-xs leading-5 whitespace-pre-wrap text-fg-muted">
                {props.text}
              </p>
            </section>
          </Show>

          <Show
            when={!props.isLoading && !props.error && props.artists.length > 0}
          >
            <section class="mb-4">
              <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
                Artists
              </div>
              <BandcampChipList
                items={props.artists}
                lookups={props.artistLookups}
              />
            </section>
          </Show>

          <Show
            when={!props.isLoading && !props.error && props.albums.length > 0}
          >
            <section class="mb-4">
              <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
                Albums
              </div>
              <BandcampTextList
                items={props.albums}
                lookups={props.albumLookups}
              />
            </section>
          </Show>

          <Show
            when={!props.isLoading && !props.error && props.tracks.length > 0}
          >
            <section class="mb-4">
              <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
                Tracks
              </div>
              <BandcampTextList
                items={props.tracks}
                lookups={props.trackLookups}
              />
            </section>
          </Show>

          <Show
            when={!props.isLoading && !props.error && props.links.length > 0}
          >
            <section>
              <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
                Links
              </div>
              <div class="space-y-1 text-xs">
                <For each={props.links}>
                  {(link) => (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      class="block truncate text-fg-muted hover:text-fg"
                    >
                      {link.label}
                    </a>
                  )}
                </For>
              </div>
            </section>
          </Show>
        </div>
      </div>
    </div>
  );
};

function formatSectionItems(items: string[]): string[] {
  return items.filter((item) => item.trim().length > 0);
}

function buildArtistItems(
  artists: Array<{ name: string }>
): BandcampEntityItem[] {
  return artists
    .filter((artist) => artist.name.trim().length > 0)
    .map((artist) => ({
      name: artist.name,
      primaryArtistName: null,
      text: artist.name,
    }));
}

function buildReleaseItems(
  items: Array<{ name: string; primaryArtistName: string | null }>
): BandcampEntityItem[] {
  return items
    .filter((item) => item.name.trim().length > 0)
    .map((item) => ({
      name: item.name,
      primaryArtistName: item.primaryArtistName,
      text: item.primaryArtistName
        ? `${item.name} — ${item.primaryArtistName}`
        : item.name,
    }));
}

function buildLinkItems(newsletter: NewsletterSummary): NewsletterLinkModel[] {
  return newsletter.links.map((link) => ({
    label: link.title ?? link.domain ?? link.url,
    url: link.url,
  }));
}

const ExpandableNewsletterRow: Component<ExpandableNewsletterRowProps> = (
  props
) => {
  const [showArtists, setShowArtists] = createSignal(false);
  const [showAlbums, setShowAlbums] = createSignal(false);
  const [showTracks, setShowTracks] = createSignal(false);
  const [showLinks, setShowLinks] = createSignal(false);
  const [showModal, setShowModal] = createSignal(false);

  const detailResource = createNewsletterDetailResource(
    () => (showModal() ? props.newsletter.id : null),
    {
      api: props.api,
    }
  );
  const bandcampEnabled = createMemo(() =>
    shouldEnableBandcampLookup({
      isModalOpen: showModal(),
      showArtists: showArtists(),
      showAlbums: showAlbums(),
      showTracks: showTracks(),
    })
  );
  const bandcampQuery = createNewsletterBandcampQuery({
    newsletterId: () => props.newsletter.id,
    enabled: bandcampEnabled,
    api: props.api,
  });

  const artists = createMemo(() =>
    formatSectionItems(props.newsletter.artists.map((artist) => artist.name))
  );
  const albums = createMemo(() =>
    formatSectionItems(
      props.newsletter.albums.map((album) =>
        album.primaryArtistName
          ? `${album.name} — ${album.primaryArtistName}`
          : album.name
      )
    )
  );
  const tracks = createMemo(() =>
    formatSectionItems(
      props.newsletter.tracks.map((track) =>
        track.primaryArtistName
          ? `${track.name} — ${track.primaryArtistName}`
          : track.name
      )
    )
  );
  const links = createMemo(() => buildLinkItems(props.newsletter));
  const sourceLabel = createMemo(
    () =>
      props.newsletter.source.canonicalName ??
      props.newsletter.source.senderEmail ??
      'Unknown source'
  );
  const artistItems = createMemo(() => buildArtistItems(props.newsletter.artists));
  const albumItems = createMemo(() => buildReleaseItems(props.newsletter.albums));
  const trackItems = createMemo(() => buildReleaseItems(props.newsletter.tracks));
  const modalArtists = createMemo(
    () => buildArtistItems(detailResource.newsletter()?.artists ?? props.newsletter.artists)
  );
  const modalAlbums = createMemo(
    () => buildReleaseItems(detailResource.newsletter()?.albums ?? props.newsletter.albums)
  );
  const modalTracks = createMemo(
    () => buildReleaseItems(detailResource.newsletter()?.tracks ?? props.newsletter.tracks)
  );
  const modalLinks = createMemo(
    () =>
      detailResource.newsletter()?.links.map((link) => ({
        label: link.title ?? link.domain ?? link.url,
        url: link.url,
      })) ?? links()
  );

  return (
    <article class="border-b border-border bg-bg">
      <div class="px-2.5 py-2">
        <div class="flex justify-between items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
          <span class="truncate">{sourceLabel()}</span>
          <span class="flex-shrink-0">
            {formatNewsletterDate(props.newsletter.sentAt)}
          </span>
        </div>

        <div class="mt-1 text-xs font-medium">
          {props.newsletter.subject ?? 'Untitled newsletter'}
        </div>

        <Show when={props.newsletter.summary}>
          <div class="mt-1 text-xs leading-5 text-fg-muted">
            <p class="line-clamp-3 inline">{props.newsletter.summary}</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              class="ml-1 inline text-xs text-fg-muted hover:text-fg"
            >
              +
            </button>
          </div>
        </Show>

        <Show when={!props.newsletter.summary}>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            class="mt-2 text-[10px] tracking-[0.18em] text-fg-muted hover:text-fg"
          >
            +
          </button>
        </Show>

        <div class="flex flex-wrap gap-1 mt-2">
          <Show when={artists().length > 0}>
            <SectionToggle
              label="Artists"
              count={artists().length}
              expanded={showArtists()}
              onToggle={() => setShowArtists((value) => !value)}
            />
          </Show>
          <Show when={albums().length > 0}>
            <SectionToggle
              label="Albums"
              count={albums().length}
              expanded={showAlbums()}
              onToggle={() => setShowAlbums((value) => !value)}
            />
          </Show>
          <Show when={tracks().length > 0}>
            <SectionToggle
              label="Tracks"
              count={tracks().length}
              expanded={showTracks()}
              onToggle={() => setShowTracks((value) => !value)}
            />
          </Show>
          <Show when={links().length > 0}>
            <SectionToggle
              label="Links"
              count={links().length}
              expanded={showLinks()}
              onToggle={() => setShowLinks((value) => !value)}
            />
          </Show>
        </div>
      </div>

      <Show when={showArtists()}>
        <section class="px-2.5 py-2 border-t border-border bg-bg-subtle">
          <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
            Artists
          </div>
          <BandcampChipList
            items={artistItems()}
            lookups={bandcampQuery.data?.artists ?? []}
          />
        </section>
      </Show>

      <Show when={showAlbums()}>
        <section class="px-2.5 py-2 border-t border-border bg-bg-subtle">
          <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
            Albums
          </div>
          <BandcampTextList
            items={albumItems()}
            lookups={bandcampQuery.data?.albums ?? []}
          />
        </section>
      </Show>

      <Show when={showTracks()}>
        <section class="px-2.5 py-2 border-t border-border bg-bg-subtle">
          <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
            Tracks
          </div>
          <BandcampTextList
            items={trackItems()}
            lookups={bandcampQuery.data?.tracks ?? []}
          />
        </section>
      </Show>

      <Show when={showLinks()}>
        <section class="px-2.5 py-2 border-t border-border bg-bg-subtle">
          <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
            Links
          </div>
          <div class="space-y-1 text-xs">
            <For each={links()}>
              {(link) => (
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  class="block truncate text-fg-muted hover:text-fg"
                >
                  {link.label}
                </a>
              )}
            </For>
          </div>
        </section>
      </Show>

      <Show when={showModal()}>
        <NewsletterModal
          title={props.newsletter.subject ?? 'Untitled newsletter'}
          sourceLabel={`${sourceLabel()} · ${formatNewsletterDate(props.newsletter.sentAt)}`}
          summary={props.newsletter.summary}
          text={detailResource.newsletter()?.cleanedText ?? null}
          artists={modalArtists()}
          albums={modalAlbums()}
          tracks={modalTracks()}
          links={modalLinks()}
          artistLookups={bandcampQuery.data?.artists ?? []}
          albumLookups={bandcampQuery.data?.albums ?? []}
          trackLookups={bandcampQuery.data?.tracks ?? []}
          isLoading={detailResource.status() === 'loading'}
          error={detailResource.error()}
          bandcampError={bandcampQuery.error ?? null}
          isBandcampLoading={bandcampQuery.isLoading}
          onClose={() => setShowModal(false)}
        />
      </Show>
    </article>
  );
};

const NewsletterList: Component<NewsletterListProps> = (props) => {
  return (
    <div class="flex flex-col h-full">
      <div class="px-2 py-1.5 text-[10px] tracking-[0.24em] uppercase border-b border-border text-fg-muted">
        Newsletters
      </div>

      <Show when={props.error}>
        <div class="p-2 text-xs border-b border-border text-fg-muted">
          {props.error?.message}
        </div>
      </Show>

      <Show when={props.isLoading && props.newsletters.length === 0}>
        <div class="px-3 py-8 text-xs text-center text-fg-muted">
          Loading newsletters…
        </div>
      </Show>

      <Show
        when={
          !props.isLoading && props.newsletters.length === 0 && !props.error
        }
      >
        <div class="px-3 py-8 text-xs text-center text-fg-muted">
          <div>No newsletters yet.</div>
          <div class="mt-1">
            Run the local ingest worker to populate this panel.
          </div>
        </div>
      </Show>

      <div class="overflow-y-auto flex-1">
        <For each={props.newsletters}>
          {(newsletter) => (
            <ExpandableNewsletterRow newsletter={newsletter} api={props.api} />
          )}
        </For>
      </div>
    </div>
  );
};

export default NewsletterList;
