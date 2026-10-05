import { Component, For, Show } from 'solid-js';
import { getNTSResultUrl, type NTSLookupResult } from '../lib/nts';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';
import ExternalLink from './ExternalLink';

interface NTSLookupResultsProps {
  results: NTSLookupResult[];
  isLoading: boolean;
  error?: string;
  hasSearched: boolean;
}

const NTSLookupResults: Component<NTSLookupResultsProps> = (props) => (
  <div class='min-h-0 flex-1 overflow-y-auto'>
    <Show when={props.error}>
      <ErrorMessage class='m-2 border border-border bg-bg-muted p-2'>
        {props.error}
      </ErrorMessage>
    </Show>
    <Show when={props.isLoading}>
      <div role='status' aria-live='polite'>
        <EmptyState class='py-8 text-center'>Searching NTS…</EmptyState>
      </div>
    </Show>
    <Show when={!props.isLoading && props.results.length > 0}>
      <div class='space-y-px'>
        <For each={props.results}>
          {(result) => {
            const url = getNTSResultUrl(result.articlePath);
            const isArtist = result.article_type === 'artist';
            return (
              <article class='flex items-center gap-2 border-b border-border p-2 text-sm hover:bg-bg-subtle'>
                <Show when={isArtist && result.imageUrl}>
                  <img
                    width={36}
                    height={36}
                    src={result.imageUrl}
                    alt=''
                    class='h-9 w-9 object-cover'
                    loading='lazy'
                  />
                </Show>
                <div class='min-w-0 flex-1'>
                  <Show
                    when={url}
                    fallback={<div class='truncate'>{result.title}</div>}
                  >
                    <ExternalLink
                      href={url!}
                      class='block truncate hover:underline'
                      title={`Open ${result.title} on NTS`}
                    >
                      {result.title}
                    </ExternalLink>
                  </Show>
                  <Show when={isArtist}>
                    <div class='text-xs text-fg-muted'>NTS artist</div>
                  </Show>
                  <Show when={!isArtist}>
                    <div class='truncate text-xs text-fg-muted'>
                      {result.artists.join(', ')}
                      <Show
                        when={result.artists.length > 0 && result.episodeTitle}
                      >
                        {' · '}
                      </Show>
                      <Show when={result.episodeTitle}>
                        {result.episodeTitle}
                      </Show>
                      <Show when={result.localDate}>
                        {' · '}
                        {result.localDate}
                      </Show>
                    </div>
                  </Show>
                </div>
                <span class='shrink-0 text-xs text-fg-muted'>NTS</span>
              </article>
            );
          }}
        </For>
      </div>
    </Show>
    <Show
      when={
        !props.isLoading &&
        props.hasSearched &&
        props.results.length === 0 &&
        !props.error
      }
    >
      <div role='status' aria-live='polite'>
        <EmptyState class='py-8 text-center'>No NTS results</EmptyState>
      </div>
    </Show>
    <Show when={!props.isLoading && !props.hasSearched}>
      <EmptyState class='py-8 text-center'>
        Search NTS for artist profiles or track appearances
      </EmptyState>
    </Show>
  </div>
);

export default NTSLookupResults;
