import { Component, For, Show, createMemo, createSignal } from 'solid-js';
import { createNewsletterDetailResource } from '../lib/newsletter-resource.js';
import type { NewsletterApi, NewsletterSummary } from '../lib/newsletters.js';
import {
  formatNewsletterDate,
  formatNewsletterLinkLabel,
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

interface NewsletterModalProps {
  title: string;
  sourceLabel: string;
  summary: string | null;
  text: string | null;
  links: NewsletterLinkModel[];
  isLoading: boolean;
  error: Error | null;
  onClose: () => void;
}

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

          <Show when={props.isLoading}>
            <div class="text-xs text-fg-muted">Loading full newsletter…</div>
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

          <Show when={!props.isLoading && !props.error && props.links.length > 0}>
            <section>
              <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
                Bandcamp links
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

function buildLinkItems(newsletter: NewsletterSummary): NewsletterLinkModel[] {
  return newsletter.links.map((link) => ({
    label: formatNewsletterLinkLabel(link),
    url: link.url,
  }));
}

const ExpandableNewsletterRow: Component<ExpandableNewsletterRowProps> = (
  props
) => {
  const [showModal, setShowModal] = createSignal(false);

  const detailResource = createNewsletterDetailResource(
    () => (showModal() ? props.newsletter.id : null),
    {
      api: props.api,
    }
  );

  const links = createMemo(() => buildLinkItems(props.newsletter));
  const sourceLabel = createMemo(
    () =>
      props.newsletter.source.canonicalName ??
      props.newsletter.source.senderEmail ??
      'Unknown source'
  );
  const modalLinks = createMemo(
    () =>
      detailResource.newsletter()?.links.map((link) => ({
        label: formatNewsletterLinkLabel(link),
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

        <Show when={links().length > 0}>
          <section class="mt-2 border-t border-border bg-bg-subtle py-2">
            <div class="mb-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted">
              Bandcamp links
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
      </div>

      <Show when={showModal()}>
        <NewsletterModal
          title={props.newsletter.subject ?? 'Untitled newsletter'}
          sourceLabel={`${sourceLabel()} · ${formatNewsletterDate(props.newsletter.sentAt)}`}
          summary={props.newsletter.summary}
          text={detailResource.newsletter()?.cleanedText ?? null}
          links={modalLinks()}
          isLoading={detailResource.status() === 'loading'}
          error={detailResource.error()}
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
