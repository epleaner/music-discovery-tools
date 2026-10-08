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
  <div class="panel-scroll">
    <Show when={props.error}>
      <ErrorMessage class="section-content">{props.error}</ErrorMessage>
    </Show>
    <Show when={props.isLoading}>
      <div role="status" aria-live="polite">
        <EmptyState class="section-content">Searching NTS…</EmptyState>
      </div>
    </Show>
    <Show when={!props.isLoading && props.results.length > 0}>
      <div class="result-list section-content">
        <For each={props.results}>
          {(result) => {
            const url = getNTSResultUrl(result.articlePath);
            const isArtist = result.article_type === 'artist';
            return (
              <article class="result-row">
                <Show when={isArtist && result.imageUrl}>
                  <img
                    width={64}
                    height={64}
                    src={result.imageUrl}
                    alt=""
                    class="result-cover"
                    loading="lazy"
                  />
                </Show>
                <div class="result-main">
                  <Show
                    when={url}
                    fallback={
                      <div class="result-title break-words">{result.title}</div>
                    }
                  >
                    <ExternalLink
                      href={url!}
                      class="result-title block break-words"
                      title={`Open ${result.title} on NTS`}
                    >
                      {result.title}
                    </ExternalLink>
                  </Show>
                  <Show when={isArtist}>
                    <div class="result-meta">NTS artist</div>
                  </Show>
                  <Show when={!isArtist}>
                    <div class="result-meta break-words">
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
      <div role="status" aria-live="polite">
        <EmptyState class="section-content">No NTS results</EmptyState>
      </div>
    </Show>
    <Show when={!props.isLoading && !props.hasSearched}>
      <EmptyState class="section-content">Search by artist or track</EmptyState>
    </Show>
  </div>
);

export default NTSLookupResults;
