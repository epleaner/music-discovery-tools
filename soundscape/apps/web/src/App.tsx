import {
  Component,
  Show,
  Switch,
  Match,
  For,
  createMemo,
  createSignal,
  createEffect,
  onMount,
  onCleanup,
} from 'solid-js';
import UsernameInput from './components/UsernameInput';
import TrackList from './components/TrackList';
import ArtistList from './components/ArtistList';
import AlbumList from './components/AlbumList';
import RecentArtistList from './components/RecentArtistList';
import TopTrackList from './components/TopTrackList';
import TopAlbumList from './components/TopAlbumList';
import SiteViewer from './components/SiteViewer';
import ResizablePanels from './components/ResizablePanels';
import ResizableBottom from './components/ResizableBottom';
import EveryNoiseViewer from './components/EveryNoiseViewer';
import WebSocketExample from './components/WebSocketExample';
import GenreSelect from './components/GenreSelect';
import NewsletterPanel from './components/NewsletterPanel';
import BandcampPanel from './components/BandcampPanel';
import {
  buildRightPanelModel,
  resolveRightPanelMode,
} from './lib/app-right-panel';
import { buildAppLayoutModel } from './lib/app-layout';
import {
  createRecentTracksResource,
  createTopArtistsResource,
  createTopTracksResource,
  createTopAlbumsResource,
  createSimilarArtistsResource,
  createEveryNoiseResource,
} from './lib/lastfm-resource';
import {
  TIME_PERIOD_LABELS,
  type TimePeriod,
  type RecentViewType,
  type TopViewType,
} from '@soundscape/types';
import {
  groupTracksByAlbum,
  groupTracksByArtist,
  normalizeCharacters,
} from '@soundscape/utils';
import { useHashState } from './lib/use-hash-state';
import { useTheme } from './lib/use-theme';

type View = 'recent' | 'top' | 'similar';

interface AppState extends Record<string, string> {
  username: string;
  view: string;
  subview: string;
  topSubview: string;
  period: string;
  artist: string;
  rightPanel: string;
  sites: string; // JSON-encoded array of sites
  bandcampUrl: string;
  bandcampTag: string;
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
    username: 'pleanut',
    view: 'recent',
    subview: 'tracks',
    topSubview: 'artists',
    period: '7day',
    artist: '',
    rightPanel: 'similar',
    sites: JSON.stringify(defaultSites),
    bandcampUrl: '',
    bandcampTag: '',
  });

  const { theme, toggleTheme, colorTheme, setColorTheme } = useTheme();

  // Getters for reactive access
  const username = () => state().username;
  const currentView = () => state().view;
  const recentViewType = () => state().subview;
  const topViewType = () => state().topSubview as TopViewType;
  const period = () => state().period as TimePeriod;
  const selectedArtist = () => state().artist;
  const rightPanelMode = () => resolveRightPanelMode(state().rightPanel);
  const sitesString = () => state().sites;
  const bandcampUrl = () => state().bandcampUrl;
  const bandcampTag = () => state().bandcampTag;

  // Parse sites only when the sites string actually changes
  const musicSites = createMemo((prev) => {
    const currentSitesString = sitesString();
    try {
      const parsed = JSON.parse(
        currentSitesString || JSON.stringify(defaultSites)
      );
      // Return previous value if stringified version is the same (deep equality check)
      if (prev && JSON.stringify(prev) === JSON.stringify(parsed)) {
        return prev;
      }
      return parsed;
    } catch {
      return defaultSites;
    }
  });

  // When the selected artist changes while the Bandcamp tab is active, reset
  // bandcampUrl so the panel re-resolves for the new artist.
  createEffect(() => {
    const artist = selectedArtist();
    if (rightPanelMode() === 'bandcamp' && artist) {
      updateState({ bandcampUrl: '' });
    }
  });

  const recentTracks = createRecentTracksResource(username);
  const topArtists = createTopArtistsResource(username, period);
  const topTracks = createTopTracksResource(username, period);
  const topAlbums = createTopAlbumsResource(username, period);
  const similarArtists = createSimilarArtistsResource(selectedArtist);
  const everyNoiseGenre = createEveryNoiseResource(selectedArtist);
  const rightPanelModel = createMemo(() =>
    buildRightPanelModel({
      mode: rightPanelMode(),
      selectedArtist: selectedArtist(),
    })
  );
  const appLayoutModel = createMemo(() => buildAppLayoutModel(username()));

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
      artist: '', // Reset selected artist when username changes
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

  const getThemeRotation = () => {
    const t = theme();
    // Rotate 180deg for dark mode, 0deg for light mode
    if (t === 'dark') return '180deg';
    if (t === 'system') return '90deg';
    return '0deg';
  };

  const handleSitesChange = (
    sites: Array<{ id: string; name: string; url: string }>
  ) => {
    updateState({ sites: JSON.stringify(sites) });
  };

  // RYM dropdown state
  const [showRYMDropdown, setShowRYMDropdown] = createSignal(false);
  const [rymSearchTerm, setRYMSearchTerm] = createSignal<string[]>([]);
  const [rymYear, setRYMYear] = createSignal(2025);
  const [rymTimeRange, setRYMTimeRange] = createSignal<'year' | 'decade'>(
    'year'
  );

  // Color theme dropdown state
  const [showColorThemeDropdown, setShowColorThemeDropdown] =
    createSignal(false);
  // oxlint-disable-next-line no-unassigned-vars
  let colorThemeContainerRef: HTMLDivElement | undefined;

  // WebSocket debug panel state
  const [showWebSocket, setShowWebSocket] = createSignal(false);

  const colorThemes: Array<{ value: string; label: string }> = [
    { value: 'default', label: 'Default' },
    { value: 'blue', label: 'Blue' },
    { value: 'green', label: 'Green' },
    { value: 'purple', label: 'Purple' },
    { value: 'amber', label: 'Amber' },
    { value: 'rose', label: 'Rose' },
    { value: 'slate', label: 'Slate' },
    { value: 'sunset', label: 'Sunset' },
    { value: 'ocean', label: 'Ocean' },
    { value: 'forest', label: 'Forest' },
    { value: 'twilight', label: 'Twilight' },
    { value: 'fire', label: 'Fire' },
  ];

  // Handle click outside for color theme dropdown
  onMount(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        showColorThemeDropdown() &&
        colorThemeContainerRef?.contains(target) === false
      ) {
        setShowColorThemeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    onCleanup(() => {
      document.removeEventListener('mousedown', handleClickOutside);
    });
  });

  const isDarkMode = createMemo(() => {
    const currentTheme = theme();
    if (currentTheme === 'dark') return true;
    if (currentTheme === 'light') return false;
    // system theme - check media query
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const getThemeColor = (themeValue: string): string => {
    const colors: Record<string, string> = {
      default: isDarkMode() ? 'hsl(0, 0%, 98%)' : 'hsl(0, 0%, 9%)',
      blue: 'hsl(210, 70%, 45%)',
      green: 'hsl(142, 60%, 40%)',
      purple: 'hsl(270, 60%, 45%)',
      amber: 'hsl(38, 80%, 45%)',
      rose: 'hsl(350, 60%, 45%)',
      slate: 'hsl(215, 30%, 25%)',
      sunset: 'hsl(340, 70%, 50%)',
      ocean: 'hsl(180, 70%, 45%)',
      forest: 'hsl(30, 50%, 40%)',
      twilight: 'hsl(220, 70%, 50%)',
      fire: 'hsl(25, 80%, 50%)',
    };
    return colors[themeValue] || colors.default;
  };

  const formatGenreForURL = (genre: string) => {
    return normalizeCharacters(genre)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[']/g, '')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9-]/g, '');
  };

  const getRYMUrl = () => {
    const genres = rymSearchTerm();
    // Join multiple genres with commas and URL encode
    const genreSlug = genres.map(formatGenreForURL).join(',');
    const encodedGenreSlug = encodeURIComponent(genreSlug);
    if (rymTimeRange() === 'year') {
      return `https://rateyourmusic.com/charts/top/album/${rymYear()}/ge:${encodedGenreSlug}/`;
    } else {
      const decade = Math.floor(rymYear() / 10) * 10;
      return `https://rateyourmusic.com/charts/top/album/${decade}s/ge:${encodedGenreSlug}/`;
    }
  };

  const currentYear = new Date().getFullYear();
  const rymYears = Array.from(
    { length: currentYear - 1949 },
    (_, i) => currentYear - i
  );

  return (
    <div class="flex flex-col h-screen bg-bg">
      {/* Header */}
      <div class="flex-shrink-0 border-b border-border">
        <div class="flex gap-2 justify-between items-center p-3">
          <UsernameInput
            onSubmit={handleUsernameSubmit}
            initialUsername={username()}
          />

          <div class="flex flex-1 gap-2 justify-end items-center w-full">
            {/* WebSocket Debug Button */}
            <button
              onClick={() => setShowWebSocket(!showWebSocket())}
              class="text-xs btn-secondary"
              title="WebSocket Debug Panel"
            >
              WS {showWebSocket() ? '−' : '+'}
            </button>

            {/* RYM Dropdown */}
            <div class="relative flex-shrink-0">
              <button
                onClick={() => setShowRYMDropdown(!showRYMDropdown())}
                class="btn-secondary"
                title="RateYourMusic Charts"
              >
                RYM Charts
              </button>

              <Show when={showRYMDropdown()}>
                <div class="absolute right-0 z-30 p-2.5 mt-1 w-72 border shadow-lg bg-bg border-border">
                  <div class="space-y-3">
                    {/* Genre Select */}
                    <GenreSelect
                      value={rymSearchTerm()}
                      onValueChange={setRYMSearchTerm}
                    />

                    {/* Time Range & Year */}
                    <div class="flex gap-2">
                      <div class="flex-1">
                        <label class="block mb-1 text-xs text-fg-muted">
                          Range
                        </label>
                        <div class="flex gap-1">
                          <button
                            onClick={() => setRYMTimeRange('year')}
                            class={`flex-1 px-2 py-1 text-xs ${
                              rymTimeRange() === 'year'
                                ? 'bg-accent text-bg'
                                : 'text-fg-muted hover:text-fg border border-border'
                            }`}
                          >
                            Year
                          </button>
                          <button
                            onClick={() => setRYMTimeRange('decade')}
                            class={`flex-1 px-2 py-1 text-xs ${
                              rymTimeRange() === 'decade'
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
                            {rymTimeRange() === 'year' ? 'Year' : 'Decade'}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const randomIndex = Math.floor(
                                Math.random() * rymYears.length
                              );
                              setRYMYear(rymYears[randomIndex]);
                            }}
                            class="text-xs text-fg-muted hover:text-fg px-1"
                            title="Shuffle year/decade"
                          >
                            ↻
                          </button>
                        </div>
                        <select
                          value={rymYear()}
                          onChange={(e) =>
                            setRYMYear(parseInt(e.currentTarget.value))
                          }
                          class="w-full text-xs input"
                        >
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
                      class="py-2 w-full text-xs btn-primary"
                    >
                      Open in RateYourMusic →
                    </button>
                  </div>
                </div>
              </Show>
            </div>

            <div
              class="flex items-center gap-2.5 border border-border btn cursor-pointer py-2.5"
              ref={colorThemeContainerRef}
              onClick={() =>
                setShowColorThemeDropdown(!showColorThemeDropdown())
              }
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTheme();
                }}
                class="flex items-center justify-center flex-shrink-0 transition-all text-fg-subtle hover:text-fg w-3 h-3"
                style={{ transform: `rotate(${getThemeRotation()})` }}
                title={`Theme: ${theme()}`}
              >
                <span class="theme-icon" />
              </button>

              <div class="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowColorThemeDropdown(!showColorThemeDropdown());
                  }}
                  class="flex items-center justify-center flex-shrink-0 text-xs text-fg-subtle hover:text-fg transition-colors"
                  title="Color Theme"
                >
                  <span
                    class="w-2 h-2 rounded-full"
                    style={{
                      'background-color': getThemeColor(colorTheme()),
                    }}
                  ></span>
                </button>

                <Show when={showColorThemeDropdown()}>
                  <div class="absolute right-0 top-full mt-1 bg-bg border border-border rounded z-50 min-w-[120px]">
                    <For each={colorThemes}>
                      {(item) => (
                        <button
                          onClick={() => {
                            setColorTheme(
                              item.value as
                                | 'default'
                                | 'blue'
                                | 'green'
                                | 'purple'
                                | 'amber'
                                | 'rose'
                                | 'slate'
                                | 'sunset'
                                | 'ocean'
                                | 'forest'
                                | 'twilight'
                                | 'fire'
                            );
                            setShowColorThemeDropdown(false);
                          }}
                          class="w-full px-3 py-2 text-xs text-left hover:bg-bg-muted transition-colors flex items-center gap-2"
                          classList={{
                            'bg-bg-muted': colorTheme() === item.value,
                          }}
                        >
                          <span
                            class="w-3 h-3 rounded-full flex-shrink-0 border border-border"
                            style={{
                              'background-color': getThemeColor(item.value),
                            }}
                          ></span>
                          <span>{item.label}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </div>

        {/* WebSocket Debug Panel */}
        <Show when={showWebSocket()}>
          <div class="border-t border-border bg-bg-subtle">
            <WebSocketExample />
          </div>
        </Show>
      </div>

      <Show when={appLayoutModel().showMainLayout}>
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
                <div class="flex flex-col h-full">
                  {/* Sticky Header */}
                  <div class="flex-shrink-0 bg-bg">
                    {/* Tabs */}
                    <div class="flex border-b border-border">
                      <For each={tabs}>
                        {(tab) => (
                          <button
                            onClick={() => updateState({ view: tab.id })}
                            class={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                              currentView() === tab.id
                                ? 'border-accent'
                                : 'border-transparent text-fg-muted hover:text-fg'
                            }`}
                          >
                            {tab.label}
                          </button>
                        )}
                      </For>
                    </div>

                    {/* View type selector for recent */}
                    <Show when={currentView() === 'recent'}>
                      <div class="flex gap-1 p-2 border-b border-border">
                        <For
                          each={
                            [
                              { id: 'tracks', label: 'Tracks' },
                              { id: 'albums', label: 'Albums' },
                              { id: 'artists', label: 'Artists' },
                            ] as { id: RecentViewType; label: string }[]
                          }
                        >
                          {(view) => (
                            <button
                              onClick={() => updateState({ subview: view.id })}
                              class={`px-2 py-1 text-xs whitespace-nowrap ${
                                recentViewType() === view.id
                                  ? 'bg-accent text-bg'
                                  : 'text-fg-muted hover:text-fg'
                              }`}
                            >
                              {view.label}
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>

                    {/* Subview selector for top */}
                    <Show when={currentView() === 'top'}>
                      <div class="flex gap-1 p-2 border-b border-border">
                        <For
                          each={
                            [
                              { id: 'artists', label: 'Artists' },
                              { id: 'tracks', label: 'Tracks' },
                              { id: 'albums', label: 'Albums' },
                            ] as { id: TopViewType; label: string }[]
                          }
                        >
                          {(view) => (
                            <button
                              onClick={() =>
                                updateState({ topSubview: view.id })
                              }
                              class={`px-2 py-1 text-xs whitespace-nowrap ${
                                topViewType() === view.id
                                  ? 'bg-accent text-bg'
                                  : 'text-fg-muted hover:text-fg'
                              }`}
                            >
                              {view.label}
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>

                    {/* Period selector for top */}
                    <Show when={currentView() === 'top'}>
                      <div class="flex overflow-x-auto gap-1 items-center p-2 border-b border-border">
                        <For
                          each={Object.keys(TIME_PERIOD_LABELS) as TimePeriod[]}
                        >
                          {(p) => (
                            <button
                              onClick={() => updateState({ period: p })}
                              class={`px-2 py-1 text-xs whitespace-nowrap ${
                                period() === p
                                  ? 'bg-accent text-bg'
                                  : 'text-fg-muted hover:text-fg'
                              }`}
                            >
                              {TIME_PERIOD_LABELS[p]}
                            </button>
                          )}
                        </For>
                        <Show
                          when={
                            topArtists.isLoading() ||
                            topTracks.isLoading() ||
                            topAlbums.isLoading()
                          }
                        >
                          <div class="ml-1 text-xs animate-spin text-fg-muted">
                            ◐
                          </div>
                        </Show>
                      </div>
                    </Show>
                  </div>

                  {/* Content */}
                  <div class="overflow-y-auto flex-1">
                    <Show when={appLayoutModel().showLibraryEmptyState}>
                      <div class="flex justify-center items-center h-full">
                        <div class="text-xs text-center text-fg-muted">
                          Enter a username to load Last.fm data
                        </div>
                      </div>
                    </Show>

                    <Show when={!appLayoutModel().showLibraryEmptyState}>
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
                                parseInt(
                                  recentTracks.currentPage().toString()
                                ) < parseInt(recentTracks.totalPages())
                              }
                            >
                              <div class="p-4 text-center border-t border-border">
                                <button
                                  onClick={() => recentTracks.loadMore()}
                                  class="text-xs btn"
                                >
                                  Load More
                                </button>
                              </div>
                            </Show>
                          </div>
                        </Match>

                        <Match when={currentView() === 'top'}>
                          <div class="p-2">
                            <Switch>
                              <Match when={topViewType() === 'artists'}>
                                <ArtistList
                                  artists={topArtists.artists()}
                                  isLoading={topArtists.isLoading()}
                                  error={topArtists.error()}
                                  onArtistClick={handleArtistClick}
                                  showPlaycount={true}
                                />
                              </Match>
                              <Match when={topViewType() === 'tracks'}>
                                <TopTrackList
                                  tracks={topTracks.tracks()}
                                  isLoading={topTracks.isLoading()}
                                  error={topTracks.error()}
                                  onArtistClick={handleArtistClick}
                                />
                              </Match>
                              <Match when={topViewType() === 'albums'}>
                                <TopAlbumList
                                  albums={topAlbums.albums()}
                                  isLoading={topAlbums.isLoading()}
                                  error={topAlbums.error()}
                                  onArtistClick={handleArtistClick}
                                />
                              </Match>
                            </Switch>
                          </div>
                        </Match>
                      </Switch>
                    </Show>
                  </div>
                </div>
              }
              rightPanel={
                <div class="flex flex-col h-full">
                  <div class="flex flex-shrink-0 gap-1 p-2 border-b bg-bg border-border">
                    <button
                      onClick={() => updateState({ rightPanel: 'similar' })}
                      class={`px-2 py-1 text-xs whitespace-nowrap ${
                        rightPanelModel().activeMode === 'similar'
                          ? 'bg-accent text-bg'
                          : 'text-fg-muted hover:text-fg'
                      }`}
                    >
                      Similar
                    </button>
                    <button
                      onClick={() => updateState({ rightPanel: 'newsletters' })}
                      class={`px-2 py-1 text-xs whitespace-nowrap ${
                        rightPanelModel().activeMode === 'newsletters'
                          ? 'bg-accent text-bg'
                          : 'text-fg-muted hover:text-fg'
                      }`}
                    >
                      Newsletters
                    </button>
                    <button
                      onClick={() => updateState({ rightPanel: 'bandcamp' })}
                      class={`px-2 py-1 text-xs whitespace-nowrap ${
                        rightPanelModel().activeMode === 'bandcamp'
                          ? 'bg-accent text-bg'
                          : 'text-fg-muted hover:text-fg'
                      }`}
                    >
                      Bandcamp
                    </button>
                  </div>

                  <Show
                    when={
                      rightPanelModel().showSimilarArtists &&
                      rightPanelModel().similarArtistTitle
                    }
                  >
                    <div class="flex flex-shrink-0 justify-between py-2 border-b bg-bg border-border">
                      <div>
                        <h2 class="text-sm font-medium">
                          {rightPanelModel().similarArtistTitle}
                        </h2>
                        <div class="mt-1 text-xs text-fg-muted">
                          Similar Artists
                        </div>
                      </div>
                      <div class="flex-shrink-0">
                        <EveryNoiseViewer
                          genre={everyNoiseGenre.genre()}
                          isLoading={everyNoiseGenre.isLoading()}
                          artistName={selectedArtist()}
                        />
                      </div>
                    </div>
                  </Show>

                  <div class="overflow-y-auto flex-1 min-h-0">
                    <Switch>
                      <Match when={rightPanelModel().showNewsletterPanel}>
                        <NewsletterPanel />
                      </Match>
                      <Match when={rightPanelModel().showBandcampPanel}>
                        <BandcampPanel
                          bandcampUrl={bandcampUrl()}
                          bandcampTag={bandcampTag()}
                          selectedArtist={selectedArtist()}
                          onAlbumClick={(url) => updateState({ bandcampUrl: url, bandcampTag: '' })}
                          onUrlChange={(url) => updateState({ bandcampUrl: url })}
                          onTagClick={(tag) => updateState({ bandcampTag: tag })}
                          onTagClear={() => updateState({ bandcampTag: '' })}
                        />
                      </Match>
                      <Match when={selectedArtist()}>
                        <ArtistList
                          artists={similarArtists.artists()}
                          isLoading={similarArtists.isLoading()}
                          error={similarArtists.error()}
                          onArtistClick={handleArtistClick}
                          showMatch={true}
                        />
                      </Match>
                      <Match when={rightPanelModel().showSimilarArtists}>
                        <div class="py-8 text-xs text-center text-fg-muted">
                          {rightPanelModel().emptyMessage}
                        </div>
                      </Match>
                    </Switch>
                  </div>
                </div>
              }
            />
          }
          bottomPanel={
            <SiteViewer
              sites={musicSites()}
              onSitesChange={handleSitesChange}
            />
          }
        />
      </Show>
    </div>
  );
};

export default App;
