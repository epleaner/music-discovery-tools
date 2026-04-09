import { Component, For, Show, createMemo, createSignal } from 'solid-js';
import { createNewsletterDetailResource } from '../lib/newsletter-resource.js';
import type { NewsletterApi, NewsletterSummary } from '../lib/newsletters.js';
import {
  buildNewsletterEntityLabels,
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

function formatSectionItems(items: string[]): string[] {
  return items.filter((item) => item.trim().length > 0);
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
  const [showText, setShowText] = createSignal(false);
  const [showArtists, setShowArtists] = createSignal(false);
  const [showAlbums, setShowAlbums] = createSignal(false);
  const [showTracks, setShowTracks] = createSignal(false);
  const [showLinks, setShowLinks] = createSignal(false);

  const detailResource = createNewsletterDetailResource(
    () => (showText() ? props.newsletter.id : null),
    {
      api: props.api,
    }
  );

  const entitySummary = createMemo(() =>
    buildNewsletterEntityLabels(props.newsletter)
  );
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

  return (
    <article class="border-b border-border bg-bg">
      <div class="px-2.5 py-2">
        <div class="flex justify-between items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
          <span class="truncate">
            {props.newsletter.source.canonicalName ??
              props.newsletter.source.senderEmail ??
              'Unknown source'}
          </span>
          <span class="flex-shrink-0">
            {formatNewsletterDate(props.newsletter.sentAt)}
          </span>
        </div>

        <div class="mt-1 text-xs font-medium">
          {props.newsletter.subject ?? 'Untitled newsletter'}
        </div>

        <Show when={props.newsletter.summary}>
          <div class="mt-1 text-xs leading-5 text-fg-muted">
            {props.newsletter.summary}
          </div>
        </Show>

        <Show when={entitySummary().length > 0}>
          <div class="flex flex-wrap gap-1 mt-2">
            <For each={entitySummary()}>
              {(item) => (
                <span class="px-1.5 py-0.5 text-[10px] border border-border text-fg-muted">
                  {item}
                </span>
              )}
            </For>
          </div>
        </Show>

        <div class="flex flex-wrap gap-1 mt-2">
          <SectionToggle
            label="Text"
            expanded={showText()}
            onToggle={() => setShowText((value) => !value)}
          />
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

      <Show when={showText()}>
        <section class="px-2.5 py-2 border-t border-border bg-bg-subtle">
          <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
            Text
          </div>
          <Show when={detailResource.error()}>
            <div class="text-xs text-fg-muted">
              {detailResource.error()?.message}
            </div>
          </Show>
          <Show when={detailResource.status() === 'loading'}>
            <div class="text-xs text-fg-muted">Loading text…</div>
          </Show>
          <Show
            when={
              detailResource.status() !== 'loading' &&
              !detailResource.error() &&
              detailResource.newsletter()?.cleanedText
            }
          >
            <p class="text-xs leading-5 whitespace-pre-wrap text-fg-muted">
              {detailResource.newsletter()?.cleanedText}
            </p>
          </Show>
          <Show
            when={
              detailResource.status() !== 'loading' &&
              !detailResource.error() &&
              !detailResource.newsletter()?.cleanedText
            }
          >
            <div class="text-xs text-fg-muted">
              No extracted text available.
            </div>
          </Show>
        </section>
      </Show>

      <Show when={showArtists()}>
        <section class="px-2.5 py-2 border-t border-border bg-bg-subtle">
          <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
            Artists
          </div>
          <div class="flex flex-wrap gap-1">
            <For each={artists()}>
              {(artist) => (
                <span class="px-1.5 py-0.5 text-xs border border-border">
                  {artist}
                </span>
              )}
            </For>
          </div>
        </section>
      </Show>

      <Show when={showAlbums()}>
        <section class="px-2.5 py-2 border-t border-border bg-bg-subtle">
          <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
            Albums
          </div>
          <div class="space-y-1 text-xs">
            <For each={albums()}>{(album) => <div>{album}</div>}</For>
          </div>
        </section>
      </Show>

      <Show when={showTracks()}>
        <section class="px-2.5 py-2 border-t border-border bg-bg-subtle">
          <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
            Tracks
          </div>
          <div class="space-y-1 text-xs">
            <For each={tracks()}>{(track) => <div>{track}</div>}</For>
          </div>
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
