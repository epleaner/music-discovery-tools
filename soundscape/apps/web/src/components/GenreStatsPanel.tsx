import { Component, For, Show, createSignal } from 'solid-js';
import { TIME_PERIOD_LABELS, type TimePeriod } from '@soundscape/types';
import { createGenreStatsResource } from '../lib/lastfm-resource';

interface GenreStatsPanelProps {
  username: () => string;
}

const GenreStatsPanel: Component<GenreStatsPanelProps> = (props) => {
  const [period, setPeriod] = createSignal<TimePeriod>('7day');
  const genreStats = createGenreStatsResource(props.username, period);
  const maxPlaycount = () => genreStats.genres()[0]?.playcount ?? 0;
  const formatArtistCount = (count: number) =>
    `${count} ${count === 1 ? 'artist' : 'artists'}`;

  return (
    <div class="flex h-full flex-col bg-bg text-fg">
      <div class="flex-shrink-0 border-b border-border bg-bg p-2">
        <div class="mb-2">
          <h2 class="text-sm font-medium">Genre Stats</h2>
          <div class="mt-1 text-xs text-fg-muted">
            Derived from top artists and weighted by artist playcount.
          </div>
        </div>
        <div class="flex gap-1 overflow-x-auto">
          <For each={Object.keys(TIME_PERIOD_LABELS) as TimePeriod[]}>
            {(timePeriod) => (
              <button
                type="button"
                on:click={() => setPeriod(timePeriod)}
                class={`px-2 py-1 text-xs whitespace-nowrap ${
                  period() === timePeriod
                    ? 'bg-accent text-bg'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                {TIME_PERIOD_LABELS[timePeriod]}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-2">
        <Show
          when={props.username().trim()}
          fallback={
            <div class="py-8 text-center text-xs text-fg-muted">
              Enter a username to load genre stats
            </div>
          }
        >
          <Show
            when={!genreStats.isLoading()}
            fallback={
              <div class="py-8 text-center text-xs text-fg-muted">
                Loading genre stats…
              </div>
            }
          >
            <Show
              when={!genreStats.error()}
              fallback={
                <div class="py-8 text-center text-xs text-fg-muted">
                  Failed to fetch genre stats
                </div>
              }
            >
              <Show
                when={genreStats.genres().length > 0}
                fallback={
                  <div class="py-8 text-center text-xs text-fg-muted">
                    No genre tags found
                  </div>
                }
              >
                <div class="space-y-1">
                  <For each={genreStats.genres().slice(0, 50)}>
                    {(genre, index) => (
                      <div class="border border-border p-2">
                        <div class="mb-1 flex items-center justify-between gap-2 text-xs">
                          <div class="min-w-0 truncate font-medium">
                            {index() + 1}. {genre.name}
                          </div>
                          <div class="flex-shrink-0 text-fg-muted">
                            {genre.playcount.toLocaleString()} plays ·{' '}
                            {formatArtistCount(genre.artists)}
                          </div>
                        </div>
                        <div class="h-1 bg-bg-muted">
                          <div
                            class="h-full bg-accent"
                            style={{
                              width: `${Math.max(
                                4,
                                (genre.playcount / maxPlaycount()) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default GenreStatsPanel;
