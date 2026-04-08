import { Component, For, Show } from 'solid-js';
import type { NewsletterDetail as NewsletterDetailData } from '../lib/newsletters.js';
import { formatNewsletterDetailDate } from './newsletter-panel-model.js';

export interface NewsletterDetailProps {
  newsletter?: NewsletterDetailData | null;
  isLoading?: boolean;
  isEmpty?: boolean;
  error?: Error | null;
}

const NewsletterDetail: Component<NewsletterDetailProps> = (props) => {
  const artists = () => props.newsletter?.artists ?? [];
  const albums = () => props.newsletter?.albums ?? [];
  const tracks = () => props.newsletter?.tracks ?? [];
  const links = () => props.newsletter?.links ?? [];

  return (
    <div class='flex flex-col h-full'>
      <div class='px-3 py-1.5 text-[10px] tracking-[0.24em] uppercase border-b border-border text-fg-muted'>
        Detail
      </div>

      <Show when={props.error}>
        <div class='p-3 text-xs border-b border-border text-fg-muted'>
          {props.error?.message}
        </div>
      </Show>

      <Show when={props.isLoading}>
        <div class='px-3 py-8 text-xs text-center text-fg-muted'>
          Loading newsletter detail…
        </div>
      </Show>

      <Show when={!props.isLoading && !props.error && (props.isEmpty || !props.newsletter)}>
        <div class='px-3 py-8 text-xs text-center text-fg-muted'>
          Select a newsletter to inspect extracted artists, releases, and links.
        </div>
      </Show>

      <Show when={!props.isLoading && !props.error && props.newsletter}>
        {(newsletter) => (
          <div class='overflow-y-auto flex-1'>
            <div class='p-3 border-b border-border'>
              <div class='flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.18em] text-fg-muted'>
                <span>{newsletter().source.canonicalName ?? newsletter().source.senderEmail ?? 'Unknown source'}</span>
                <span>{formatNewsletterDetailDate(newsletter().sentAt)}</span>
                <span>{newsletter().extractionStatus}</span>
              </div>
              <div class='mt-2 text-sm font-medium'>
                {newsletter().subject ?? 'Untitled newsletter'}
              </div>
              <Show when={newsletter().summary}>
                <p class='mt-2 text-xs leading-5 text-fg-muted'>{newsletter().summary}</p>
              </Show>
            </div>

            <div class='grid grid-cols-1 gap-px bg-border'>
              <Show when={artists().length > 0}>
                <section class='p-3 bg-bg'>
                  <div class='mb-2 text-[10px] uppercase tracking-[0.18em] text-fg-muted'>Artists</div>
                  <div class='flex flex-wrap gap-1'>
                    <For each={artists()}>
                      {(artist) => (
                        <span class='px-1.5 py-0.5 text-xs border border-border'>
                          {artist.name}
                        </span>
                      )}
                    </For>
                  </div>
                </section>
              </Show>

              <Show when={albums().length > 0}>
                <section class='p-3 bg-bg'>
                  <div class='mb-2 text-[10px] uppercase tracking-[0.18em] text-fg-muted'>Albums</div>
                  <div class='space-y-1 text-xs'>
                    <For each={albums()}>
                      {(album) => (
                        <div>
                          <span>{album.name}</span>
                          <Show when={album.primaryArtistName}>
                            <span class='text-fg-muted'> — {album.primaryArtistName}</span>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </section>
              </Show>

              <Show when={tracks().length > 0}>
                <section class='p-3 bg-bg'>
                  <div class='mb-2 text-[10px] uppercase tracking-[0.18em] text-fg-muted'>Tracks</div>
                  <div class='space-y-1 text-xs'>
                    <For each={tracks()}>
                      {(track) => (
                        <div>
                          <span>{track.name}</span>
                          <Show when={track.primaryArtistName}>
                            <span class='text-fg-muted'> — {track.primaryArtistName}</span>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </section>
              </Show>

              <Show when={links().length > 0}>
                <section class='p-3 bg-bg'>
                  <div class='mb-2 text-[10px] uppercase tracking-[0.18em] text-fg-muted'>Links</div>
                  <div class='space-y-1 text-xs'>
                    <For each={links()}>
                      {(link) => (
                        <a
                          href={link.url}
                          target='_blank'
                          rel='noreferrer'
                          class='block truncate text-fg-muted hover:text-fg'>
                          {link.title ?? link.domain ?? link.url}
                        </a>
                      )}
                    </For>
                  </div>
                </section>
              </Show>

              <Show when={newsletter().cleanedText}>
                <section class='p-3 bg-bg'>
                  <div class='mb-2 text-[10px] uppercase tracking-[0.18em] text-fg-muted'>Excerpt</div>
                  <p class='text-xs leading-5 whitespace-pre-wrap text-fg-muted'>
                    {newsletter().cleanedText}
                  </p>
                </section>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};

export default NewsletterDetail;
