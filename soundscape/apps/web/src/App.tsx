import {
  Component,
  Show,
  Switch,
  Match,
  For,
  createMemo,
  createSignal,
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
import EveryNoiseViewer from './components/EveryNoiseViewer';
import AgentSetup from './components/AgentSetup';
import AuthScreen from './components/AuthScreen';
import ScrapeSections from './components/ScrapeSections';
import RymChartTool from './components/RymChartTool';
import BandcampUrlTool from './components/BandcampUrlTool';
import Breadcrumbs from './components/Breadcrumbs';
import Button from './components/Button';
import PanelTab from './components/PanelTab';
import EmptyState from './components/EmptyState';
import { buildSimilarPanelModel } from './lib/app-right-panel';
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
  type Track,
  type RecentAlbum,
  type RecentArtist,
} from '@soundscape/types';
import { groupTracksByAlbum, groupTracksByArtist } from '@soundscape/utils';
import { useSearchState } from './lib/use-search-state';
import { useNav } from './lib/use-nav';
import { useTheme } from './lib/use-theme';
import { requestScrapeRefresh } from './lib/scrape-jobs';
import { getSession, logout, type AuthUser } from './lib/auth';

type View = 'recent' | 'top' | 'similar';

interface AppState extends Record<string, string> {
  username: string;
  view: string;
  subview: string;
  topSubview: string;
  period: string;
  sites: string; // JSON-encoded array of sites
}

const Workspace: Component<{ user: AuthUser; onLogout: () => void }> = (props) => {
  const defaultSites = [
    {
      id: 'secret-ambient',
      name: 'Secret Ambient Club',
      url: 'https://secretambient.club/',
    },
  ];

  const [state, updateState] = useSearchState<AppState>({
    username: 'pleanut',
    view: 'recent',
    subview: 'tracks',
    topSubview: 'artists',
    period: '7day',
    sites: JSON.stringify(defaultSites),
  });

  const nav = useNav();

  const [bottomTab, setBottomTab] = createSignal<
    'history' | 'sites' | 'rym-charts' | 'bandcamp'
  >('history');

  const { theme, toggleTheme, colorTheme, setColorTheme } = useTheme();

  // Getters for reactive access
  const username = () => state().username;
  const currentView = () => state().view;
  const recentViewType = () => state().subview;
  const topViewType = () => state().topSubview as TopViewType;
  const period = () => state().period as TimePeriod;
  const selectedArtist = () => {
    const restore = nav.lastItem()?.restore;
    return restore?.type === 'item' ? restore.artist : '';
  };
  const sitesString = () => state().sites;

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

  const recentTracks = createRecentTracksResource(username);
  const topArtists = createTopArtistsResource(username, period);
  const topTracks = createTopTracksResource(username, period);
  const topAlbums = createTopAlbumsResource(username, period);
  const similarArtists = createSimilarArtistsResource(selectedArtist);
  const everyNoiseGenre = createEveryNoiseResource(selectedArtist);
  const rightPanelModel = createMemo(() =>
    buildSimilarPanelModel({
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
    });
    nav.home();
    recentTracks.reset();
  };

  const handleArtistClick = (artistName: string) => {
    nav.navigateToItem({ artist: artistName, itemKind: 'artist' });
  };

  const handleTrackResolveClick = (track: Track) => {
    const albumName = track.album['#text'] || undefined;
    nav.navigateToItem({
      artist: track.artist['#text'],
      album: albumName,
      itemKind: albumName ? 'album' : 'artist',
    });
  };

  const handleAlbumResolveClick = (album: RecentAlbum) => {
    nav.navigateToItem({
      artist: album.artist,
      album: album.name,
      itemKind: 'album',
    });
  };

  const handleArtistResolveClick = (artist: RecentArtist) => {
    nav.navigateToItem({ artist: artist.name, itemKind: 'artist' });
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

  // Top-right account dropdown state
  const [showAccountDropdown, setShowAccountDropdown] = createSignal(false);
  let accountMenuRef: HTMLDivElement | undefined;

  // Color theme dropdown state
  const [showColorThemeDropdown, setShowColorThemeDropdown] =
    createSignal(false);
  // oxlint-disable-next-line no-unassigned-vars
  let colorThemeContainerRef: HTMLDivElement | undefined;
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

  // Handle clicks outside the account and color theme dropdowns.
  onMount(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        showAccountDropdown() &&
        accountMenuRef?.contains(target) === false
      ) {
        setShowAccountDropdown(false);
        setShowColorThemeDropdown(false);
      }
      if (
        showColorThemeDropdown() &&
        colorThemeContainerRef?.contains(target) === false
      ) {
        setShowColorThemeDropdown(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAccountDropdown(false);
        setShowColorThemeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
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
            <div class="relative flex-shrink-0" ref={accountMenuRef}>
              <Button
                onClick={() => {
                  setShowAccountDropdown(!showAccountDropdown());
                  setShowColorThemeDropdown(false);
                }}
                variant="secondary"
                class="inline-flex items-center justify-center gap-1"
                aria-haspopup="true"
                aria-expanded={showAccountDropdown()}
                aria-controls="account-menu"
              >
                {props.user.username}
                <svg
                  aria-hidden="true"
                  class="h-3 w-3"
                  fill="none"
                  viewBox="0 0 12 12"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m2.5 4.5 3.5 3 3.5-3" />
                </svg>
              </Button>

              <Show when={showAccountDropdown()}>
                <div
                  id="account-menu"
                  class="absolute right-0 top-full z-40 mt-1 flex min-w-[220px] flex-col gap-2 border border-border bg-bg p-2 shadow-lg"
                >
                  <div class="flex items-center justify-between border-b border-border px-2 pb-2">
                    <div class="text-xs font-medium text-fg">
                      {props.user.username}
                    </div>
                    <Button
                      onClick={() => {
                        setShowAccountDropdown(false);
                        void props.onLogout();
                      }}
                      variant="link"
                      class="px-0 text-right"
                    >
                      Sign out
                    </Button>
                  </div>

                  <AgentSetup />

                  <div
                    class="flex items-center justify-between gap-2 border-t border-border px-2 pt-2"
                    ref={colorThemeContainerRef}
                  >
                    <span class="text-xs text-fg-muted">Appearance</span>
                    <div class="flex items-center gap-1">
                      <Button
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          toggleTheme();
                        }}
                        variant="icon"
                        class="flex items-center justify-center flex-shrink-0 transition-all text-fg-subtle hover:text-fg"
                        style={{ transform: `rotate(${getThemeRotation()})` }}
                        aria-label={`Switch theme (currently ${theme()})`}
                        title={`Switch theme (currently ${theme()})`}
                      >
                        <span class="theme-icon w-3 h-3" />
                      </Button>

                      <div class="relative">
                        <Button
                          onClick={(e: MouseEvent) => {
                            e.stopPropagation();
                            setShowColorThemeDropdown(
                              !showColorThemeDropdown()
                            );
                          }}
                          variant="icon"
                          class="flex items-center justify-center flex-shrink-0 text-fg-muted hover:text-fg transition-colors"
                          aria-label="Choose accent color theme"
                          title="Choose accent color theme"
                        >
                          <span
                            class="w-2 h-2 rounded-full"
                            style={{
                              'background-color': getThemeColor(colorTheme()),
                            }}
                          ></span>
                        </Button>

                        <Show when={showColorThemeDropdown()}>
                          <div class="absolute right-0 top-full mt-1 bg-bg border border-border rounded z-50 min-w-[120px]">
                            <For each={colorThemes}>
                              {(item) => (
                                <Button
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
                                  variant="control"
                                  class="px-3 text-left hover:bg-bg-muted transition-colors flex items-center gap-2"
                                  classList={{
                                    'bg-bg-muted': colorTheme() === item.value,
                                  }}
                                >
                                  <span
                                    class="w-3 h-3 rounded-full flex-shrink-0 border border-border"
                                    style={{
                                      'background-color': getThemeColor(
                                        item.value
                                      ),
                                    }}
                                  ></span>
                                  <span>{item.label}</span>
                                </Button>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </div>

      <Breadcrumbs onRefresh={requestScrapeRefresh} />

      <Show when={appLayoutModel().showMainLayout}>
        <ResizablePanels
          initialLeftWidth={70}
          minLeftWidth={30}
          maxLeftWidth={80}
          leftPanel={
            <div class="flex flex-col h-full">
              <div class="relative z-10 flex flex-shrink-0 p-2 panel-tab-row bg-bg">
                <PanelTab
                  onClick={() => setBottomTab('history')}
                  active={bottomTab() === 'history'}
                >
                  Listening History
                </PanelTab>
                <PanelTab
                  onClick={() => setBottomTab('sites')}
                  active={bottomTab() === 'sites'}
                >
                  Sites
                </PanelTab>
                <PanelTab
                  onClick={() => setBottomTab('rym-charts')}
                  active={bottomTab() === 'rym-charts'}
                >
                  RYM
                </PanelTab>
                <PanelTab
                  onClick={() => setBottomTab('bandcamp')}
                  active={bottomTab() === 'bandcamp'}
                >
                  Bandcamp
                </PanelTab>
              </div>
              <div class="overflow-hidden flex-1 min-h-0">
                <div
                  style={{
                    display:
                      bottomTab() === 'history' ? 'block' : 'none',
                  }}>
                    <div class="flex flex-col h-full">
                      {/* Sticky Header */}
                      <div class="flex-shrink-0 bg-bg">
                        {/* Tabs */}
                        <div class="panel-tab-row">
                          <For each={tabs}>
                            {(tab) => (
                              <PanelTab
                                onClick={() => updateState({ view: tab.id })}
                                active={currentView() === tab.id}
                                underline
                              >
                                {tab.label}
                              </PanelTab>
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
                                <PanelTab
                                  onClick={() =>
                                    updateState({ subview: view.id })
                                  }
                                  active={recentViewType() === view.id}
                                >
                                  {view.label}
                                </PanelTab>
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
                                <PanelTab
                                  onClick={() =>
                                    updateState({ topSubview: view.id })
                                  }
                                  active={topViewType() === view.id}
                                >
                                  {view.label}
                                </PanelTab>
                              )}
                            </For>
                          </div>
                        </Show>

                        {/* Period selector for top */}
                        <Show when={currentView() === 'top'}>
                          <div class="flex overflow-x-auto gap-1 items-center p-2 border-b border-border">
                            <For
                              each={
                                Object.keys(TIME_PERIOD_LABELS) as TimePeriod[]
                              }
                            >
                              {(p) => (
                                <PanelTab
                                  onClick={() => updateState({ period: p })}
                                  active={period() === p}
                                >
                                  {TIME_PERIOD_LABELS[p]}
                                </PanelTab>
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
                            <EmptyState class="text-center">
                              Enter a username to load Last.fm data
                            </EmptyState>
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
                                      onTrackClick={handleTrackResolveClick}
                                    />
                                  </Match>
                                  <Match when={recentViewType() === 'albums'}>
                                    <AlbumList
                                      albums={recentAlbums()}
                                      tracks={recentTracks.tracks()}
                                      isLoading={recentTracks.isLoading()}
                                      error={recentTracks.error()}
                                      onAlbumClick={handleAlbumResolveClick}
                                    />
                                  </Match>
                                  <Match when={recentViewType() === 'artists'}>
                                    <RecentArtistList
                                      artists={recentArtists()}
                                      tracks={recentTracks.tracks()}
                                      isLoading={recentTracks.isLoading()}
                                      error={recentTracks.error()}
                                      onArtistRowClick={
                                        handleArtistResolveClick
                                      }
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
                                    <Button
                                      onClick={() => recentTracks.loadMore()}
                                      class="text-xs btn"
                                    >
                                      Load More
                                    </Button>
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
                                      onTrackClick={(track) =>
                                        nav.navigateToItem({
                                          artist: track.artist.name,
                                          itemKind: 'artist',
                                        })
                                      }
                                    />
                                  </Match>
                                  <Match when={topViewType() === 'albums'}>
                                    <TopAlbumList
                                      albums={topAlbums.albums()}
                                      isLoading={topAlbums.isLoading()}
                                      error={topAlbums.error()}
                                      onAlbumClick={(album) =>
                                        nav.navigateToItem({
                                          artist: album.artist.name,
                                          album: album.name,
                                          itemKind: 'album',
                                        })
                                      }
                                    />
                                  </Match>
                                </Switch>
                              </div>
                            </Match>
                          </Switch>
                        </Show>
                      </div>
                    </div>
                </div>
                <Switch>
                  <Match when={bottomTab() === 'sites'}>
                    <SiteViewer
                      sites={musicSites()}
                      onSitesChange={handleSitesChange}
                    />
                  </Match>
                  <Match when={bottomTab() === 'rym-charts'}>
                    <RymChartTool />
                  </Match>
                  <Match when={bottomTab() === 'bandcamp'}>
                    <BandcampUrlTool />
                  </Match>
                </Switch>
              </div>
            </div>
          }
          rightPanel={
            <div class="flex flex-col h-full overflow-y-auto">
              {/* LastFM: Similar section */}
              <div class="flex flex-shrink-0 justify-between items-center py-2 px-3 border-b bg-bg border-border">
                <h2 class="text-xs font-medium text-fg-muted">
                  LastFM: Similar
                </h2>
                <Show when={rightPanelModel().showSimilarArtists}>
                  <div class="flex-shrink-0">
                    <EveryNoiseViewer
                      genre={everyNoiseGenre.genre()}
                      isLoading={everyNoiseGenre.isLoading()}
                      artistName={selectedArtist()}
                    />
                  </div>
                </Show>
              </div>
              <div class="flex-shrink-0">
                <Show
                  when={selectedArtist()}
                  fallback={
                    <EmptyState class="py-8 text-center">
                      {rightPanelModel().emptyMessage}
                    </EmptyState>
                  }
                >
                  <ArtistList
                    artists={similarArtists.artists()}
                    isLoading={similarArtists.isLoading()}
                    error={similarArtists.error()}
                    onArtistClick={handleArtistClick}
                    showMatch={true}
                  />
                </Show>
              </div>

              <ScrapeSections />
            </div>
          }
        />
      </Show>
    </div>
  );
};

const App: Component = () => {
  const [user, setUser] = createSignal<AuthUser | null>(null);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    setUser(await getSession());
    setLoading(false);
  });

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  return (
    <Show
      when={!loading()}
      fallback={
        <div class="flex h-screen items-center justify-center bg-bg text-xs text-fg-muted">
          Loading…
        </div>
      }
    >
      <Show
        when={user()}
        fallback={
          <AuthScreen
            onAuthenticated={(authenticated) => setUser(authenticated)}
          />
        }
      >
        {(authenticated) => (
          <Workspace user={authenticated()} onLogout={handleLogout} />
        )}
      </Show>
    </Show>
  );
};
export default App;
