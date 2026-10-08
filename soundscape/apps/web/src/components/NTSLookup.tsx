import { Component, createEffect, createSignal, onCleanup } from 'solid-js';
import {
  searchNTS,
  type NTSLookupResult,
  type NTSLookupType,
} from '../lib/nts';
import Button from './Button';
import NTSLookupResults from './NTSLookupResults';
import Input from './Input';
import Select from './Select';

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
    <section class="flex h-full min-h-0 flex-col" aria-label="NTS lookup">
      <div role="status" aria-live="polite" class="sr-only">
        {isLoading()
          ? 'Searching NTS'
          : hasSearched()
            ? `Found ${results().length} NTS results`
            : ''}
      </div>
      <form
        class="toolbar section-content border-b border-border"
        onSubmit={(event) => {
          event.preventDefault();
          void performSearch(query(), type());
        }}
      >
        <label class="sr-only" for="nts-query">
          Search NTS for an artist or track
        </label>
        <Input
          id="nts-query"
          name="query"
          autocomplete="off"
          class="min-w-0 flex-1 basis-full sm:basis-auto"
          type="search"
          placeholder="Search NTS for an artist or track"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        <label class="sr-only" for="nts-search-type">
          Search type
        </label>
        <Select
          id="nts-search-type"
          name="type"
          value={type()}
          onChange={(event) =>
            setType(event.currentTarget.value === 'track' ? 'track' : 'artist')
          }
        >
          <option value="artist">Artist</option>
          <option value="track">Track</option>
        </Select>
        <Button type="submit" disabled={isLoading() || !query().trim()}>
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
