import { Component, createEffect, createSignal, onCleanup } from 'solid-js';
import {
  searchNTS,
  type NTSLookupResult,
  type NTSLookupType,
} from '../lib/nts';
import Button from './Button';
import NTSLookupResults from './NTSLookupResults';

export interface NTSLookupPreset {
  query: string;
  type: NTSLookupType;
}

interface NTSLookupProps {
  preset?: NTSLookupPreset;
}

const NTSLookup: Component<NTSLookupProps> = (props) => {
  const [query, setQuery] = createSignal('');
  const [type, setType] = createSignal<NTSLookupType>('artist');
  const [results, setResults] = createSignal<NTSLookupResult[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [hasSearched, setHasSearched] = createSignal(false);
  let activeRequest: AbortController | undefined;

  const performSearch = async (
    searchText: string,
    searchType: NTSLookupType
  ): Promise<void> => {
    const normalizedQuery = searchText.trim();
    if (!normalizedQuery) return;

    activeRequest?.abort();
    const request = new AbortController();
    activeRequest = request;
    setQuery(searchText);
    setType(searchType);
    setResults([]);
    setError(undefined);
    setIsLoading(true);
    setHasSearched(true);

    try {
      setResults(await searchNTS(normalizedQuery, searchType, request.signal));
    } catch (caught) {
      if (request.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'NTS search failed');
    } finally {
      if (activeRequest === request) {
        activeRequest = undefined;
        setIsLoading(false);
      }
    }
  };

  createEffect(() => {
    const preset = props.preset;
    if (preset) void performSearch(preset.query, preset.type);
  });

  onCleanup(() => activeRequest?.abort());

  return (
    <section class='flex h-full min-h-0 flex-col' aria-label='NTS lookup'>
      <div role='status' aria-live='polite' class='sr-only'>
        {isLoading()
          ? 'Searching NTS'
          : hasSearched()
            ? `Found ${results().length} NTS results`
            : ''}
      </div>
      <form
        class='flex flex-wrap items-center gap-2 border-b border-border p-2'
        onSubmit={(event) => {
          event.preventDefault();
          void performSearch(query(), type());
        }}
      >
        <label class='sr-only' for='nts-query'>
          Search NTS for an artist or track
        </label>
        <input
          id='nts-query'
          name='query'
          autocomplete='off'
          class='min-w-0 flex-1 basis-full border border-border bg-bg px-2 py-1 text-sm text-fg sm:basis-auto'
          type='search'
          placeholder='Search NTS for an artist or track'
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        <label class='sr-only' for='nts-search-type'>
          Search type
        </label>
        <select
          id='nts-search-type'
          name='type'
          class='border border-border bg-bg px-2 py-1 text-sm text-fg'
          value={type()}
          onChange={(event) =>
            setType(event.currentTarget.value === 'track' ? 'track' : 'artist')
          }
        >
          <option value='artist'>Artist</option>
          <option value='track'>Track</option>
        </select>
        <Button type='submit' disabled={isLoading() || !query().trim()}>
          {isLoading() ? 'Searching…' : 'Search'}
        </Button>
      </form>
      <NTSLookupResults
        results={results()}
        isLoading={isLoading()}
        error={error()}
        hasSearched={hasSearched()}
      />
    </section>
  );
};

export default NTSLookup;
