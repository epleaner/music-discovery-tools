import { Component, For, createSignal } from 'solid-js';
import GenreSelect from './GenreSelect';
import {
  buildRateYourMusicChartsUrl,
  buildRateYourMusicYearOptions,
  type RateYourMusicTimeRange,
} from '../lib/rym-charts';

const RateYourMusicChartsPanel: Component = () => {
  const [genres, setGenres] = createSignal<string[]>([]);
  const [year, setYear] = createSignal(2025);
  const [timeRange, setTimeRange] =
    createSignal<RateYourMusicTimeRange>('year');

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
