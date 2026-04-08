import { Component, For, Show } from 'solid-js';
import type { NewsletterSummary } from '../lib/newsletters.js';
import {
  buildNewsletterEntityLabels,
  formatNewsletterDate,
} from './newsletter-panel-model.js';

export interface NewsletterListProps {
  newsletters: NewsletterSummary[];
  selectedId?: number | null;
  isLoading?: boolean;
  error?: Error | null;
  onSelect?: (id: number) => void;
}

const NewsletterList: Component<NewsletterListProps> = (props) => {
  return (
    <div class='flex flex-col h-full'>
      <div class='px-2 py-1.5 text-[10px] tracking-[0.24em] uppercase border-b border-border text-fg-muted'>
        Newsletters
      </div>

      <Show when={props.error}>
        <div class='p-2 text-xs border-b border-border text-fg-muted'>
          {props.error?.message}
        </div>
      </Show>

      <Show when={props.isLoading && props.newsletters.length === 0}>
        <div class='px-3 py-8 text-xs text-center text-fg-muted'>
          Loading newsletters…
        </div>
      </Show>

      <Show when={!props.isLoading && props.newsletters.length === 0 && !props.error}>
        <div class='px-3 py-8 text-xs text-center text-fg-muted'>
          <div>No newsletters yet.</div>
          <div class='mt-1'>Run the local ingest worker to populate this panel.</div>
        </div>
      </Show>

      <div class='overflow-y-auto flex-1'>
        <For each={props.newsletters}>
          {(newsletter) => {
            const isSelected = () => props.selectedId === newsletter.id;
            const entitySummary = () => buildNewsletterEntityLabels(newsletter);

            return (
              <button
                type='button'
                data-selected={isSelected() ? 'true' : 'false'}
                onClick={() => props.onSelect?.(newsletter.id)}
                class={`block px-2.5 py-2 w-full text-left border-b border-border transition-colors hover:bg-bg-subtle ${
                  isSelected() ? 'bg-bg-subtle' : ''
                }`}>
                <div class='flex justify-between items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-fg-muted'>
                  <span class='truncate'>
                    {newsletter.source.canonicalName ?? newsletter.source.senderEmail ?? 'Unknown source'}
                  </span>
                  <span class='flex-shrink-0'>{formatNewsletterDate(newsletter.sentAt)}</span>
                </div>
                <div class='mt-1 text-xs font-medium truncate'>
                  {newsletter.subject ?? 'Untitled newsletter'}
                </div>
                <Show when={newsletter.summary}>
                  <div class='mt-1 text-xs leading-5 line-clamp-3 text-fg-muted'>
                    {newsletter.summary}
                  </div>
                </Show>
                <Show when={entitySummary().length > 0}>
                  <div class='flex flex-wrap gap-1 mt-2'>
                    <For each={entitySummary()}>
                      {(item) => (
                        <span class='px-1.5 py-0.5 text-[10px] border border-border text-fg-muted'>
                          {item}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
};

export default NewsletterList;
