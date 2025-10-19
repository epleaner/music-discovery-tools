import {
  Component,
  Show,
  Switch,
  Match,
  For,
  createMemo,
  createSignal,
} from 'solid-js';
import UsernameInput from './components/UsernameInput';
import TrackList from './components/TrackList';
import ArtistList from './components/ArtistList';
import AlbumList from './components/AlbumList';
import RecentArtistList from './components/RecentArtistList';
import SiteViewer from './components/SiteViewer';
import ResizablePanels from './components/ResizablePanels';
import ResizableBottom from './components/ResizableBottom';
import {
  createRecentTracksResource,
  createTopArtistsResource,
  createSimilarArtistsResource,
} from './lib/lastfm-resource';
import {
  TIME_PERIOD_LABELS,
  type TimePeriod,
  type RecentViewType,
} from '@soundscape/types';
import { groupTracksByAlbum, groupTracksByArtist } from '@soundscape/utils';
import { useHashState } from './lib/use-hash-state';
import { useTheme } from './lib/use-theme';

type View = 'recent' | 'top' | 'similar';

interface AppState extends Record<string, string> {
  username: string;
  view: string;
  subview: string;
  period: string;
  artist: string;
  sites: string; // JSON-encoded array of sites
}

const App: Component = () => {
  const defaultSites = [
    {
      id: 'secret-ambient',
      name: 'Secret Ambient Club',
      url: 'https://secretambient.club/',
    },
  ];

  const [state, updateState] = useHashState<AppState>({
    username: '',
    view: 'recent',
    subview: 'tracks',
    period: '7day',
    artist: '',
    sites: JSON.stringify(defaultSites),
  });

  const { theme, toggleTheme } = useTheme();

  // Getters for reactive access
  const username = () => state().username;
  const currentView = () => state().view;
  const recentViewType = () => state().subview;
  const period = () => state().period as TimePeriod;
  const selectedArtist = () => state().artist;
  const musicSites = createMemo(() => {
    try {
      return JSON.parse(state().sites || JSON.stringify(defaultSites));
    } catch {
      return defaultSites;
    }
  });

  const recentTracks = createRecentTracksResource(username);
  const topArtists = createTopArtistsResource(username, period);
  const similarArtists = createSimilarArtistsResource(selectedArtist);

  const recentAlbums = createMemo(() =>
    groupTracksByAlbum(recentTracks.tracks())
  );
  const recentArtists = createMemo(() =>
    groupTracksByArtist(recentTracks.tracks())
  );

  const handleUsernameSubmit = (newUsername: string) => {
    updateState({
      username: newUsername,
      view: 'recent',
      subview: 'tracks',
    });
    recentTracks.reset();
  };

  const handleArtistClick = (artistName: string) => {
    updateState({
      artist: artistName,
    });
  };

  const tabs: { id: View; label: string }[] = [
    { id: 'recent', label: 'Recent' },
    { id: 'top', label: 'Top' },
  ];

  const getThemeIcon = () => {
    const t = theme();
    if (t === 'light') return '☀';
    if (t === 'dark') return '☾';
    return '◐';
  };

  const handleSitesChange = (sites: Array<{ id: string; name: string; url: string }>) => {
    updateState({ sites: JSON.stringify(sites) });
  };

  // RYM dropdown state
  const [showRYMDropdown, setShowRYMDropdown] = createSignal(false);
  const [rymSearchTerm, setRYMSearchTerm] = createSignal('Psychedelic Folk');
  const [rymYear, setRYMYear] = createSignal(2025);
  const [rymTimeRange, setRYMTimeRange] = createSignal<'year' | 'decade'>(
    'year'
  );

  const formatGenreForURL = (genre: string) => {
    return genre
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[']/g, '')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9-]/g, '');
  };

  const getRYMUrl = () => {
    const genreSlug = formatGenreForURL(rymSearchTerm());
    if (rymTimeRange() === 'year') {
      return `https://rateyourmusic.com/charts/top/album/${rymYear()}/ge:${genreSlug}/`;
    } else {
      const decade = Math.floor(rymYear() / 10) * 10;
      return `https://rateyourmusic.com/charts/top/album/${decade}s/ge:${genreSlug}/`;
    }
  };

  const currentYear = new Date().getFullYear();
  const rymYears = Array.from(
    { length: currentYear - 1949 },
    (_, i) => currentYear - i
  );

  return (
    <div class='flex flex-col h-screen bg-bg'>
      {/* Header */}
      <div class='flex-shrink-0 p-4 border-b border-border'>
        <div class='flex gap-3 justify-between items-center'>
          <UsernameInput
            onSubmit={handleUsernameSubmit}
            initialUsername={username()}
          />

          <div class='flex flex-1 gap-3 justify-end items-center w-full'>
            {/* RYM Dropdown */}
            <div class='relative flex-shrink-0'>
              <button
                onClick={() => setShowRYMDropdown(!showRYMDropdown())}
                class='btn-secondary'
                title='RateYourMusic Charts'>
                RYM Charts
              </button>

              <Show when={showRYMDropdown()}>
                <div class='absolute right-0 z-30 p-3 mt-1 w-80 border shadow-lg bg-bg border-border'>
                  <div class='space-y-3'>
                    {/* Genre Input */}
                    <div>
                      <label class='block mb-1 text-xs text-fg-muted'>
                        Genre
                      </label>
                      <input
                        type='text'
                        value={rymSearchTerm()}
                        onInput={(e) => setRYMSearchTerm(e.currentTarget.value)}
                        placeholder='Search genre...'
                        class='w-full text-xs input'
                      />
                    </div>

                    {/* Time Range & Year */}
                    <div class='flex gap-2'>
                      <div class='flex-1'>
                        <label class='block mb-1 text-xs text-fg-muted'>
                          Range
                        </label>
                        <div class='flex gap-1'>
                          <button
                            onClick={() => setRYMTimeRange('year')}
                            class={`flex-1 px-2 py-1 text-xs ${
                              rymTimeRange() === 'year'
                                ? 'bg-accent text-bg'
                                : 'text-fg-muted hover:text-fg border border-border'
                            }`}>
                            Year
                          </button>
                          <button
                            onClick={() => setRYMTimeRange('decade')}
                            class={`flex-1 px-2 py-1 text-xs ${
                              rymTimeRange() === 'decade'
                                ? 'bg-accent text-bg'
                                : 'text-fg-muted hover:text-fg border border-border'
                            }`}>
                            Decade
                          </button>
                        </div>
                      </div>

                      <div class='flex-1'>
                        <label class='block mb-1 text-xs text-fg-muted'>
                          {rymTimeRange() === 'year' ? 'Year' : 'Decade'}
                        </label>
                        <select
                          value={rymYear()}
                          onChange={(e) =>
                            setRYMYear(parseInt(e.currentTarget.value))
                          }
                          class='w-full text-xs input'>
                          <For each={rymYears}>
                            {(year) => (
                              <option value={year}>
                                {rymTimeRange() === 'decade'
                                  ? `${Math.floor(year / 10) * 10}s`
                                  : year}
                              </option>
                            )}
                          </For>
                        </select>
                      </div>
                    </div>

                    {/* Open Button */}
                    <button
                      onClick={() => {
                        window.open(getRYMUrl(), '_blank');
                        setShowRYMDropdown(false);
                      }}
                      class='py-2 w-full text-xs btn-primary'>
                      Open in RateYourMusic →
                    </button>
                  </div>
                </div>
              </Show>
            </div>

            <button
              onClick={toggleTheme}
              class='flex-shrink-0 p-2 text-lg transition-colors text-fg-subtle hover:text-fg'
              title={`Theme: ${theme()}`}>
              {getThemeIcon()}
            </button>
          </div>
        </div>
      </div>

      <Show when={username()}>
        <ResizableBottom
          initialBottomHeight={300}
          minBottomHeight={150}
          maxBottomHeight={600}
          topPanel={
            <ResizablePanels
              initialLeftWidth={70}
              minLeftWidth={30}
              maxLeftWidth={80}
              leftPanel={
                <div class='flex flex-col h-full'>
                  {/* Sticky Header */}
                  <div class='flex-shrink-0 bg-bg'>
                    {/* Tabs */}
                    <div class='flex border-b border-border'>
                      <For each={tabs}>
                        {(tab) => (
                          <button
                            onClick={() => updateState({ view: tab.id })}
                            class={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                              currentView() === tab.id
                                ? 'border-accent'
                                : 'border-transparent text-fg-muted hover:text-fg'
                            }`}>
                            {tab.label}
                          </button>
                        )}
                      </For>
                    </div>

                    {/* View type selector for recent */}
                    <Show when={currentView() === 'recent'}>
                      <div class='flex gap-1 p-2 border-b border-border'>
                        <For
                          each={
                            [
                              { id: 'tracks', label: 'Tracks' },
                              { id: 'albums', label: 'Albums' },
                              { id: 'artists', label: 'Artists' },
                            ] as { id: RecentViewType; label: string }[]
                          }>
                          {(view) => (
                            <button
                              onClick={() => updateState({ subview: view.id })}
                              class={`px-2 py-1 text-xs whitespace-nowrap ${
                                recentViewType() === view.id
                                  ? 'bg-accent text-bg'
                                  : 'text-fg-muted hover:text-fg'
                              }`}>
                              {view.label}
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>

                    {/* Period selector for top artists */}
                    <Show when={currentView() === 'top'}>
                      <div class='flex overflow-x-auto gap-1 p-2 border-b border-border'>
                        <For
                          each={
                            Object.keys(TIME_PERIOD_LABELS) as TimePeriod[]
                          }>
                          {(p) => (
                            <button
                              onClick={() => updateState({ period: p })}
                              class={`px-2 py-1 text-xs whitespace-nowrap ${
                                period() === p
                                  ? 'bg-accent text-bg'
                                  : 'text-fg-muted hover:text-fg'
                              }`}>
                              {TIME_PERIOD_LABELS[p]}
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>

                  {/* Content */}
                  <div class='overflow-y-auto flex-1'>
                    <Switch>
                      <Match when={currentView() === 'recent'}>
                        <div>
                          <Switch>
                            <Match when={recentViewType() === 'tracks'}>
                              <TrackList
                                tracks={recentTracks.tracks()}
                                isLoading={recentTracks.isLoading()}
                                error={recentTracks.error()}
                                onArtistClick={handleArtistClick}
                              />
                            </Match>
                            <Match when={recentViewType() === 'albums'}>
                              <AlbumList
                                albums={recentAlbums()}
                                tracks={recentTracks.tracks()}
                                isLoading={recentTracks.isLoading()}
                                error={recentTracks.error()}
                                onArtistClick={handleArtistClick}
                              />
                            </Match>
                            <Match when={recentViewType() === 'artists'}>
                              <RecentArtistList
                                artists={recentArtists()}
                                tracks={recentTracks.tracks()}
                                isLoading={recentTracks.isLoading()}
                                error={recentTracks.error()}
                                onArtistClick={handleArtistClick}
                              />
                            </Match>
                          </Switch>
                          <Show
                            when={
                              recentViewType() === 'tracks' &&
                              !recentTracks.isLoading() &&
                              parseInt(recentTracks.currentPage().toString()) <
                                parseInt(recentTracks.totalPages())
                            }>
                            <div class='p-4 text-center border-t border-border'>
                              <button
                                onClick={() => recentTracks.loadMore()}
                                class='text-xs btn'>
                                Load More
                              </button>
                            </div>
                          </Show>
                        </div>
                      </Match>

                      <Match when={currentView() === 'top'}>
                        <div class='p-2'>
                          <ArtistList
                            artists={topArtists.artists()}
                            isLoading={topArtists.isLoading()}
                            error={topArtists.error()}
                            onArtistClick={handleArtistClick}
                            showPlaycount={true}
                          />
                        </div>
                      </Match>
                    </Switch>
                  </div>
                </div>
              }
              rightPanel={
                <div class='flex flex-col h-full'>
                  <div class='flex-shrink-0 p-4 border-b bg-bg border-border'>
                    <h2 class='text-sm font-medium'>Similar Artists</h2>
                    <Show when={selectedArtist()}>
                      <div class='mt-1 text-xs text-fg-muted'>
                        to {selectedArtist()}
                      </div>
                    </Show>
                  </div>
                  <div class='overflow-y-auto flex-1 p-2'>
                    <Show
                      when={selectedArtist()}
                      fallback={
                        <div class='py-8 text-xs text-center text-fg-muted'>
                          Click any artist to see similar artists
                        </div>
                      }>
                      <ArtistList
                        artists={similarArtists.artists()}
                        isLoading={similarArtists.isLoading()}
                        error={similarArtists.error()}
                        onArtistClick={handleArtistClick}
                        showMatch={true}
                      />
                    </Show>
                  </div>
                </div>
              }
            />
          }
          bottomPanel={<SiteViewer sites={musicSites} />}
        />
      </Show>

      <Show when={!username()}>
        <ResizableBottom
          initialBottomHeight={300}
          minBottomHeight={150}
          maxBottomHeight={600}
          topPanel={
            <div class='flex justify-center items-center h-full'>
              <div class='text-xs text-center text-fg-muted'>
                Enter a username to start
              </div>
            </div>
          }
          bottomPanel={<SiteViewer sites={musicSites} />}
        />
      </Show>
    </div>
  );
};

export default App;
