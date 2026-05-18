import { Component, For, Show, createSignal } from 'solid-js';
import GenreSelect from './GenreSelect';
import {
  buildRateYourMusicChartsUrl,
  buildRateYourMusicYearOptions,
  type RateYourMusicTimeRange,
} from '../lib/rym-charts';
import { createGenreStatsResource } from '../lib/lastfm-resource';
import {
  shuffleTasteGenreCombination,
  type TasteGenreCombination,
  type TasteShuffleMode,
} from '../lib/rym-taste-shuffle';

interface RateYourMusicChartsPanelProps {
  username: () => string;
}

const tasteShuffleModeLabels: Record<TasteShuffleMode, string> = {
  close: 'Near',
  balanced: 'Balanced',
  fringe: 'Fringe',
};

const RateYourMusicChartsPanel: Component<RateYourMusicChartsPanelProps> = (
  props
) => {
  const [genres, setGenres] = createSignal<string[]>([]);
  const [year, setYear] = createSignal(2025);
  const [timeRange, setTimeRange] =
    createSignal<RateYourMusicTimeRange>('year');
  const [tasteShuffleMode, setTasteShuffleMode] =
    createSignal<TasteShuffleMode>('balanced');
  const [tasteCombination, setTasteCombination] =
    createSignal<TasteGenreCombination>();
  const tasteStats = createGenreStatsResource(props.username, () => '12month');

  const currentYear = new Date().getFullYear();
  const years = buildRateYourMusicYearOptions(currentYear);

  const openCharts = () => {
    window.open(
      buildRateYourMusicChartsUrl({
        genres: genres(),
        year: year(),
        timeRange: timeRange(),
      }),
      '_blank'
    );
  };

  const shuffleYear = () => {
    const randomIndex = Math.floor(Math.random() * years.length);
    setYear(years[randomIndex]);
  };

  const shuffleTasteGenres = () => {
    const combination = shuffleTasteGenreCombination(
      tasteStats.genres(),
      undefined,
      {
        mode: tasteShuffleMode(),
      }
    );
    setTasteCombination(combination);
    setGenres(combination.chartGenres);
  };

  return (
    <div class="h-full overflow-y-auto bg-bg p-3 text-fg">
      <div class="mx-auto max-w-md space-y-3">
        <div>
          <h2 class="text-sm font-medium">RateYourMusic Charts</h2>
          <p class="mt-1 text-xs text-fg-muted">
            Build a RateYourMusic album chart link by genre and time range.
          </p>
        </div>

        <GenreSelect value={genres()} onValueChange={setGenres} />

        <div class="border border-border bg-bg-subtle p-2">
          <div class="mb-2 flex items-start justify-between gap-2">
            <div>
              <h3 class="text-xs font-medium">Taste shuffle</h3>
              <p class="mt-1 text-[11px] text-fg-muted">
                Shuffles RYM genre combinations from your Last.fm last-year
                genre profile.
              </p>
            </div>
            <Show when={tasteStats.isLoading()}>
              <div class="text-xs text-fg-muted">Loading…</div>
            </Show>
          </div>

          <div class="mb-2 grid grid-cols-3 gap-1">
            <For
              each={Object.keys(tasteShuffleModeLabels) as TasteShuffleMode[]}
            >
              {(mode) => (
                <button
                  type="button"
                  on:click={() => setTasteShuffleMode(mode)}
                  class={`px-2 py-1 text-xs ${
                    tasteShuffleMode() === mode
                      ? 'bg-accent text-bg'
                      : 'border border-border bg-bg text-fg-muted hover:text-fg'
                  }`}
                >
                  {tasteShuffleModeLabels[mode]}
                </button>
              )}
            </For>
          </div>

          <button
            type="button"
            on:click={shuffleTasteGenres}
            disabled={
              tasteStats.isLoading() || tasteStats.genres().length === 0
            }
            class="w-full py-1.5 text-xs btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Shuffle from my taste →
          </button>

          <Show
            when={props.username().trim()}
            fallback={
              <div class="mt-2 text-[11px] text-fg-muted">
                Enter a Last.fm username to enable taste shuffling.
              </div>
            }
          >
            <Show when={tasteStats.error()}>
              <div class="mt-2 text-[11px] text-fg-muted">
                Could not load your Last.fm genre profile.
              </div>
            </Show>
            <Show
              when={
                !tasteStats.isLoading() &&
                tasteStats.genres().length === 0 &&
                !tasteStats.error()
              }
            >
              <div class="mt-2 text-[11px] text-fg-muted">
                No Last.fm genre profile found yet.
              </div>
            </Show>
          </Show>

          <Show when={tasteCombination()}>
            {(combination) => (
              <div class="mt-2 space-y-1">
                <div class="text-[11px] text-fg-muted">
                  {combination().summary}
                </div>
                <For each={combination().genres}>
                  {(genre) => (
                    <div class="border border-border bg-bg p-2">
                      <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="font-medium text-fg">{genre.name}</span>
                        <span class="text-[10px] uppercase tracking-wide text-fg-subtle">
                          {genre.distance}
                        </span>
                      </div>
                      <Show when={genre.reason}>
                        <div class="mt-1 text-[11px] text-fg-muted">
                          {genre.reason}
                        </div>
                      </Show>
                      <div class="mt-1 truncate text-[10px] text-fg-subtle">
                        {genre.path}
                      </div>
                    </div>
                  )}
                </For>
              </div>
            )}
          </Show>
        </div>

        <div class="flex gap-2">
          <div class="flex-1">
            <label class="block mb-1 text-xs text-fg-muted">Range</label>
            <div class="flex gap-1">
              <button
                type="button"
                on:click={() => setTimeRange('year')}
                class={`flex-1 px-2 py-1 text-xs ${
                  timeRange() === 'year'
                    ? 'bg-accent text-bg'
                    : 'text-fg-muted hover:text-fg border border-border'
                }`}
              >
                Year
              </button>
              <button
                type="button"
                on:click={() => setTimeRange('decade')}
                class={`flex-1 px-2 py-1 text-xs ${
                  timeRange() === 'decade'
                    ? 'bg-accent text-bg'
                    : 'text-fg-muted hover:text-fg border border-border'
                }`}
              >
                Decade
              </button>
            </div>
          </div>

          <div class="flex-1">
            <div class="flex items-center gap-1 mb-1">
              <label class="block text-xs text-fg-muted">
                {timeRange() === 'year' ? 'Year' : 'Decade'}
              </label>
              <button
                type="button"
                on:click={shuffleYear}
                class="px-1 text-xs text-fg-muted hover:text-fg"
                title="Shuffle year/decade"
              >
                ↻
              </button>
            </div>
            <select
              value={year()}
              on:change={(event) =>
                setYear(parseInt(event.currentTarget.value))
              }
              class="w-full text-xs input"
            >
              <For each={years}>
                {(optionYear) => (
                  <option value={optionYear}>
                    {timeRange() === 'decade'
                      ? `${Math.floor(optionYear / 10) * 10}s`
                      : optionYear}
                  </option>
                )}
              </For>
            </select>
          </div>
        </div>

        <button
          type="button"
          on:click={openCharts}
          class="py-2 w-full text-xs btn-primary"
        >
          Open in RateYourMusic →
        </button>
      </div>
    </div>
  );
};

export default RateYourMusicChartsPanel;
