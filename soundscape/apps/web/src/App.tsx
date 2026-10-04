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
import PairingScreen from './components/PairingScreen';
import ScrapeSections from './components/ScrapeSections';
import ScrapeTool from './components/ScrapeTool';
import NTSLookup, { type NTSLookupPreset } from './components/NTSLookup';
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
import { getSession, logout, type SessionUser } from './lib/auth';
import type { NTSLookupType } from './lib/nts';

type View = 'recent' | 'top' | 'similar';

interface AppState extends Record<string, string> {
  username: string;
  view: string;
  subview: string;
  topSubview: string;
  period: string;
  sites: string; // JSON-encoded array of sites
}

const Workspace: Component<{
  user: SessionUser | null;
  onConnectRequest: () => void;
  onLogout: () => void;
}> = (props) => {
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
    'history' | 'sites' | 'scrape'
  >('history');
  const [rightPanelTab, setRightPanelTab] = createSignal<'similar' | 'nts'>(
    'similar'
  );
  const [ntsPreset, setNtsPreset] = createSignal<NTSLookupPreset>();

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
  const handleNTSLookup = (query: string, type: NTSLookupType) => {
    setNtsPreset({ query, type });
    setRightPanelTab('nts');
  };

  const tabs: { id: View; label: string }[] = [
    { id: 'recent', label: 'Recent' },
    { id: 'top', label: 'Top' },
  ];
  const selectHistoryView = (view: View) => {
    if (view === 'recent' || view === 'top') {
      const entityType =
        currentView() === 'top'
          ? topViewType()
          : (recentViewType() as RecentViewType);
      updateState({
        view,
        subview: entityType,
        topSubview: entityType,
      });
      return;
    }
    updateState({ view });
  };

  const selectEntityType = (entityType: RecentViewType) => {
    updateState({
      subview: entityType,
      topSubview: entityType,
    });
  };

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
      if (showAccountDropdown() && accountMenuRef?.contains(target) === false) {
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
  const renderConnectNotice = (message: string) => (
    <div class="flex flex-col items-start gap-2 border-t border-border p-3">
      <p class="text-xs text-fg-muted">{message}</p>
      <Button
        onClick={props.onConnectRequest}
        variant="secondary"
        class="text-fg"
      >
        Connect Soundscape
      </Button>
    </div>
  );

  return (
    <div class="flex flex-col h-screen bg-bg">
      {/* Header */}
      <div class="flex-shrink-0 border-b border-border">
        <div class="flex flex-wrap gap-2 justify-between items-center p-3">
          <UsernameInput
            onSubmit={handleUsernameSubmit}
            initialUsername={username()}
          />

          <div class="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
            <Show when={!props.user}>
              <Button
                onClick={props.onConnectRequest}
                variant="secondary"
                class="text-fg"
              >
                Connect Soundscape
              </Button>
            </Show>
            <div class="relative flex-shrink-0" ref={accountMenuRef}>
              <Button
                onClick={() => {
                  setShowAccountDropdown(!showAccountDropdown());
                  setShowColorThemeDropdown(false);
                }}
                variant="secondary"
                class="inline-flex items-center justify-center gap-1 text-fg"
                aria-haspopup="true"
                aria-expanded={showAccountDropdown()}
                aria-controls="account-menu"
              >
                Soundscape Web
                <svg
                  aria-hidden="true"
                  class="h-2.5 w-2.5"
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
                  class="absolute right-0 top-full z-40 mt-1 flex min-w-[200px] flex-col gap-2 border border-border bg-bg p-2 shadow-lg sm:min-w-[220px]"
                >
                  <Show
                    when={props.user}
                    fallback={
                      <div class="border-b border-border px-2 pb-2 text-xs text-fg-muted">
                        Not connected
                      </div>
                    }
                  >
                    <div class="flex items-center justify-between border-b border-border px-2 pb-2">
                      <div class="text-xs font-medium text-fg">
                        Paired session
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
                  </Show>

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
                  active={() => bottomTab() === 'history'}
                >
                  Listening History
                </PanelTab>
                <PanelTab
                  onClick={() => setBottomTab('sites')}
                  active={() => bottomTab() === 'sites'}
                >
                  Sites
                </PanelTab>
                <PanelTab
                  onClick={() => setBottomTab('scrape')}
                  active={() => bottomTab() === 'scrape'}
                >
                  Scrape
                </PanelTab>
              </div>
              <div class="h-full min-h-0 overflow-hidden flex-1">
                <div
                  class="h-full min-h-0"
                  style={{
                    display: bottomTab() === 'history' ? 'block' : 'none',
                  }}
                >
                  <div class="flex h-full min-h-0 flex-col">
                    {/* Sticky Header */}
                    <div class="flex items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-border px-2">
                      <For each={tabs}>
                        {(tab) => (
                          <PanelTab
                            onClick={() => selectHistoryView(tab.id)}
                            active={() => currentView() === tab.id}
                            underline
                          >
                            {tab.label}
                          </PanelTab>
                        )}
                      </For>

                      <Show when={currentView() === 'recent'}>
                        <span
                          class="mx-1 h-6 border-l border-border/50"
                          aria-hidden="true"
                        />
                        <PanelTab
                          onClick={() => selectEntityType('tracks')}
                          active={() => recentViewType() === 'tracks'}
                        >
                          Tracks
                        </PanelTab>
                        <PanelTab
                          onClick={() => selectEntityType('albums')}
                          active={() => recentViewType() === 'albums'}
                        >
                          Albums
                        </PanelTab>
                        <PanelTab
                          onClick={() => selectEntityType('artists')}
                          active={() => recentViewType() === 'artists'}
                        >
                          Artists
                        </PanelTab>
                      </Show>

                      <Show when={currentView() === 'top'}>
                        <span
                          class="mx-1 h-6 border-l border-border/50"
                          aria-hidden="true"
                        />
                        <PanelTab
                          onClick={() => selectEntityType('tracks')}
                          active={() => topViewType() === 'tracks'}
                        >
                          Tracks
                        </PanelTab>
                        <PanelTab
                          onClick={() => selectEntityType('albums')}
                          active={() => topViewType() === 'albums'}
                        >
                          Albums
                        </PanelTab>
                        <PanelTab
                          onClick={() => selectEntityType('artists')}
                          active={() => topViewType() === 'artists'}
                        >
                          Artists
                        </PanelTab>
                        <span
                          class="mx-1 h-6 border-l border-border/50"
                          aria-hidden="true"
                        />
                        <For
                          each={Object.keys(TIME_PERIOD_LABELS) as TimePeriod[]}
                        >
                          {(p) => (
                            <PanelTab
                              onClick={() => updateState({ period: p })}
                              active={() => period() === p}
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
                      </Show>
                    </div>

                    {/* Content */}
                    <div class="min-h-0 flex-1 overflow-y-auto">
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
                                    onNTSLookup={(track) =>
                                      handleNTSLookup(track.name, 'track')
                                    }
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
                                    onArtistRowClick={handleArtistResolveClick}
                                    onNTSLookup={(artistName) =>
                                      handleNTSLookup(artistName, 'artist')
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
                                    onNTSLookup={(artistName) =>
                                      handleNTSLookup(artistName, 'artist')
                                    }
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
                                    onNTSLookup={(track) =>
                                      handleNTSLookup(track.name, 'track')
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
                  <Match when={bottomTab() === 'scrape'}>
                    <Show
                      when={props.user}
                      fallback={renderConnectNotice(
                        'Connect Soundscape to use manual scrape tools.'
                      )}
                    >
                      <ScrapeTool />
                    </Show>
                  </Match>
                </Switch>
              </div>
            </div>
          }
          rightPanel={
            <div class="flex h-full min-h-0 flex-col overflow-hidden">
              <Show when={bottomTab() === 'history'}>
                <div
                  class={`flex h-full min-h-0 flex-col overflow-hidden ${
                    rightPanelTab() === 'nts'
                      ? 'fixed inset-0 z-20 bg-bg sm:static'
                      : ''
                  }`}
                >
                  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div class="flex flex-shrink-0 flex-col border-b border-border bg-bg">
                      <div class="flex min-w-0 flex-wrap items-center gap-x-2 px-2">
                        <PanelTab
                          underline
                          onClick={() => setRightPanelTab('similar')}
                          active={() => rightPanelTab() === 'similar'}
                        >
                          Similar (last.fm)
                        </PanelTab>
                        <PanelTab
                          underline
                          onClick={() => setRightPanelTab('nts')}
                          active={() => rightPanelTab() === 'nts'}
                        >
                          NTS Lookup
                        </PanelTab>
                      </div>
                      <Show
                        when={
                          rightPanelTab() === 'similar' &&
                          rightPanelModel().showSimilarArtists
                        }
                      >
                        <div class="min-w-0 border-t border-border px-2 py-1">
                          <EveryNoiseViewer
                            genre={everyNoiseGenre.genre()}
                            isLoading={everyNoiseGenre.isLoading()}
                            artistName={selectedArtist()}
                          />
                        </div>
                      </Show>
                    </div>
                    <div class="min-h-0 flex-1 overflow-y-auto">
                      <Switch>
                        <Match when={rightPanelTab() === 'similar'}>
                          <Show when={selectedArtist()}>
                            <ArtistList
                              artists={similarArtists.artists()}
                              isLoading={similarArtists.isLoading()}
                              error={similarArtists.error()}
                              onArtistClick={handleArtistClick}
                              onNTSLookup={(artistName) =>
                                handleNTSLookup(artistName, 'artist')
                              }
                              showMatch={true}
                            />
                          </Show>
                        </Match>
                        <Match when={rightPanelTab() === 'nts'}>
                          <NTSLookup preset={ntsPreset()} />
                        </Match>
                      </Switch>
                    </div>
                  </div>
                  <Show when={rightPanelTab() === 'similar'}>
                    <Show
                      when={props.user}
                      fallback={renderConnectNotice(
                        'Connect Soundscape to load RYM and Bandcamp matches.'
                      )}
                    >
                      <ScrapeSections />
                    </Show>
                  </Show>
                </div>
              </Show>
            </div>
          }
        />
      </Show>
    </div>
  );
};

const App: Component = () => {
  const [showPairing, setShowPairing] = createSignal(false);
  const [user, setUser] = createSignal<SessionUser | null>(null);

  onMount(async () => {
    setUser(await getSession());
  });

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  return (
    <>
      <Workspace
        user={user()}
        onConnectRequest={() => setShowPairing(true)}
        onLogout={handleLogout}
      />
      <Show when={showPairing()}>
        <PairingScreen
          onAuthenticated={(authenticated) => {
            setUser(authenticated);
            setShowPairing(false);
          }}
          onCancel={() => setShowPairing(false)}
        />
      </Show>
    </>
  );
};
export default App;
