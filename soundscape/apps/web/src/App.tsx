import {
  Component,
  Show,
  Switch,
  Match,
  For,
  createEffect,
  createMemo,
  createSignal,
  onMount,
  onCleanup,
  on,
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
import AgentSetup from './components/AgentSetup';
import PairingScreen from './components/PairingScreen';
import ScrapeSections from './components/ScrapeSections';
import ScrapeTool from './components/ScrapeTool';
import NTSLookup, { type NTSLookupPreset } from './components/NTSLookup';
import Button from './components/Button';
import PanelTab from './components/PanelTab';
import EmptyState from './components/EmptyState';
import Select from './components/Select';
import { buildAppLayoutModel } from './lib/app-layout';
import {
  createRecentTracksResource,
  createTopArtistsResource,
  createTopTracksResource,
  createTopAlbumsResource,
  createSimilarArtistsResource,
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
import { useTheme, type Theme, type ColorTheme } from './lib/use-theme';
import { getSession, logout, type SessionUser } from './lib/auth';
import type { NTSLookupType } from './lib/nts';

type View = 'recent' | 'top';
type FocusView = 'similar' | 'rym' | 'bandcamp';

interface AppState extends Record<string, string> {
  username: string;
  view: string;
  subview: string;
  topSubview: string;
  period: string;
  focus: string;
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
    view: 'top',
    subview: 'tracks',
    topSubview: 'artists',
    period: '7day',
    focus: 'similar',
    sites: JSON.stringify(defaultSites),
  });

  const nav = useNav();

  const [bottomTab, setBottomTab] = createSignal<
    'history' | 'sites' | 'scrape' | 'nts'
  >('history');
  const [ntsPreset, setNtsPreset] = createSignal<NTSLookupPreset>();

  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();

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
  const focusView = (): FocusView => {
    const view = state().focus;
    return view === 'rym' || view === 'bandcamp' ? view : 'similar';
  };
  const focusSource = () => {
    const view = focusView();
    return view === 'similar' ? null : view;
  };
  const focusHeading = createMemo(() => {
    const restore = nav.lastItem()?.restore;
    if (restore?.type !== 'item') return 'Artist focus';
    return restore.album
      ? `${restore.artist} · ${restore.album}`
      : restore.artist;
  });
  const focusTabs: { id: FocusView; label: string }[] = [
    { id: 'similar', label: 'Similar' },
    { id: 'rym', label: 'RYM' },
    { id: 'bandcamp', label: 'Bandcamp' },
  ];
  let focusScroll: HTMLDivElement | undefined;
  createEffect(
    on([() => nav.lastItem()?.id, focusView], () => {
      if (focusScroll) focusScroll.scrollTop = 0;
    })
  );
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
      view: 'top',
      subview: 'tracks',
      ...nav.homeParams,
    });
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
    setBottomTab('nts');
    setNtsPreset({ query, type });
  };

  const tabs: { id: View; label: string }[] = [
    { id: 'top', label: 'Top' },
    { id: 'recent', label: 'Recent' },
  ];
  const selectHistoryView = (view: View) => {
    const entityType =
      currentView() === 'top'
        ? topViewType()
        : (recentViewType() as RecentViewType);
    updateState({
      view,
      subview: entityType,
      topSubview: entityType,
    });
  };

  const selectEntityType = (entityType: RecentViewType) => {
    updateState({
      subview: entityType,
      topSubview: entityType,
    });
  };

  const handleSitesChange = (
    sites: Array<{ id: string; name: string; url: string }>
  ) => {
    updateState({ sites: JSON.stringify(sites) });
  };

  // Top-right account dropdown state
  const [showAccountDropdown, setShowAccountDropdown] = createSignal(false);
  let accountMenuRef: HTMLDivElement | undefined;

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

  onMount(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showAccountDropdown() &&
        !accountMenuRef?.contains(event.target as Node)
      )
        setShowAccountDropdown(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !showAccountDropdown()) return;
      setShowAccountDropdown(false);
      accountMenuRef?.querySelector('button')?.focus();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    });
  });
  const renderConnectNotice = (message: string) => (
    <div class="section-content space-y-4">
      <p class="status">{message}</p>
      <Button onClick={props.onConnectRequest} variant="secondary">
        Connect
      </Button>
    </div>
  );

  return (
    <main class="app-shell">
      <header class="app-header">
        <h1 class="app-wordmark">soundscape</h1>
        <div class="toolbar ml-auto">
          <div class="relative" ref={accountMenuRef}>
            <Button
              onClick={() => setShowAccountDropdown(!showAccountDropdown())}
              aria-expanded={showAccountDropdown()}
              aria-controls="account-settings"
            >
              Account
            </Button>
            <Show when={showAccountDropdown()}>
              <section
                id="account-settings"
                aria-label="Account settings"
                class="menu space-y-5"
              >
                <UsernameInput
                  onSubmit={(value) => {
                    handleUsernameSubmit(value);
                    setShowAccountDropdown(false);
                    accountMenuRef?.querySelector('button')?.focus();
                  }}
                  initialUsername={username()}
                />
                <Show
                  when={props.user}
                  fallback={
                    <Button
                      variant="link"
                      onClick={() => {
                        setShowAccountDropdown(false);
                        accountMenuRef?.querySelector('button')?.focus();
                        props.onConnectRequest();
                      }}
                    >
                      Connect
                    </Button>
                  }
                >
                  <div class="toolbar justify-between">
                    <span class="status">Connected</span>
                    <Button
                      variant="link"
                      onClick={() => {
                        setShowAccountDropdown(false);
                        void props.onLogout();
                      }}
                    >
                      Sign out
                    </Button>
                  </div>
                  <AgentSetup />
                </Show>
                <div class="control-group menu-divider">
                  <label class="field-label" for="appearance">
                    Appearance
                  </label>
                  <Select
                    id="appearance"
                    value={theme()}
                    onChange={(event) =>
                      setTheme(event.currentTarget.value as Theme)
                    }
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </Select>
                </div>
                <div class="control-group">
                  <label class="field-label" for="accent">
                    Accent
                  </label>
                  <Select
                    id="accent"
                    value={colorTheme()}
                    onChange={(event) =>
                      setColorTheme(event.currentTarget.value as ColorTheme)
                    }
                  >
                    <For each={colorThemes}>
                      {(item) => (
                        <option value={item.value}>{item.label}</option>
                      )}
                    </For>
                  </Select>
                </div>
              </section>
            </Show>
          </div>
        </div>
      </header>
      <nav class="workspace-tabs" aria-label="Workspace">
        <PanelTab
          underline
          active={bottomTab() === 'history'}
          onClick={() => setBottomTab('history')}
        >
          History
        </PanelTab>
        <PanelTab
          underline
          active={bottomTab() === 'sites'}
          onClick={() => setBottomTab('sites')}
        >
          Sites
        </PanelTab>
        <PanelTab
          underline
          active={bottomTab() === 'scrape'}
          onClick={() => setBottomTab('scrape')}
        >
          Scrape
        </PanelTab>
        <PanelTab
          underline
          active={bottomTab() === 'nts'}
          onClick={() => setBottomTab('nts')}
        >
          NTS
        </PanelTab>
      </nav>
      <Show when={appLayoutModel().showMainLayout}>
        <ResizablePanels
          initialLeftWidth={65}
          minLeftWidth={30}
          maxLeftWidth={80}
          showRightPanel={bottomTab() === 'history'}
          leftPanel={
            <div class="workspace-panel flex-1">
              <div
                class="workspace-panel flex-1"
                hidden={bottomTab() !== 'history'}
              >
                <nav class="filter-bar" aria-label="Listening history">
                  <For each={tabs}>
                    {(tab) => (
                      <PanelTab
                        underline
                        active={currentView() === tab.id}
                        onClick={() => selectHistoryView(tab.id)}
                      >
                        {tab.label}
                      </PanelTab>
                    )}
                  </For>
                  <span class="filter-divider" aria-hidden="true" />
                  <For
                    each={['tracks', 'albums', 'artists'] as RecentViewType[]}
                  >
                    {(entity) => (
                      <PanelTab
                        underline
                        active={
                          (currentView() === 'top'
                            ? topViewType()
                            : recentViewType()) === entity
                        }
                        onClick={() => selectEntityType(entity)}
                      >
                        {entity === 'tracks'
                          ? 'Tracks'
                          : entity === 'albums'
                            ? 'Albums'
                            : 'Artists'}
                      </PanelTab>
                    )}
                  </For>
                </nav>
                <Show when={currentView() === 'top'}>
                  <nav class="filter-bar" aria-label="Listening period">
                    <For each={Object.keys(TIME_PERIOD_LABELS) as TimePeriod[]}>
                      {(value) => (
                        <PanelTab
                          underline
                          active={period() === value}
                          onClick={() => updateState({ period: value })}
                        >
                          {TIME_PERIOD_LABELS[value]}
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
                      <span class="status" role="status">
                        Loading…
                      </span>
                    </Show>
                  </nav>
                </Show>
                <div class="panel-scroll">
                  <Show when={appLayoutModel().showLibraryEmptyState}>
                    <div class="workspace-empty">
                      <EmptyState>Enter a Last.fm username.</EmptyState>
                    </div>
                  </Show>
                  <Show when={!appLayoutModel().showLibraryEmptyState}>
                    <Switch>
                      <Match when={currentView() === 'recent'}>
                        <Switch>
                          <Match when={recentViewType() === 'tracks'}>
                            <TrackList
                              tracks={recentTracks.tracks()}
                              isLoading={recentTracks.isLoading()}
                              error={recentTracks.error()}
                              onTrackClick={handleTrackResolveClick}
                              onNTSLookup={(query) =>
                                handleNTSLookup(query, 'track')
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
                            recentTracks.currentPage() <
                              parseInt(recentTracks.totalPages())
                          }
                        >
                          <div class="section-content text-center">
                            <Button
                              variant="link"
                              onClick={() => recentTracks.loadMore()}
                            >
                              Load more
                            </Button>
                          </div>
                        </Show>
                      </Match>
                      <Match when={currentView() === 'top'}>
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
                              showPlaycount
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
                              onNTSLookup={(query) =>
                                handleNTSLookup(query, 'track')
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
                      </Match>
                    </Switch>
                  </Show>
                </div>
              </div>
              <div
                class="workspace-panel flex-1"
                hidden={bottomTab() !== 'nts'}
              >
                <NTSLookup preset={ntsPreset()} />
              </div>
              <Switch>
                <Match when={bottomTab() === 'sites'}>
                  <SiteViewer
                    sites={musicSites()}
                    onSitesChange={handleSitesChange}
                  />
                </Match>
                <Match when={bottomTab() === 'scrape'}>
                  <div class="panel-scroll">
                    <Show
                      when={props.user}
                      fallback={renderConnectNotice(
                        'Connect to use scrape tools.'
                      )}
                    >
                      <ScrapeTool />
                    </Show>
                  </div>
                </Match>
              </Switch>
            </div>
          }
          rightPanel={
            <div class="workspace-panel flex-1">
              <div class="workspace-tabs">
                <h2 class="panel-heading flex-1" title={focusHeading()}>
                  <span class="truncate">{focusHeading()}</span>
                </h2>
                <nav class="toolbar" aria-label="Selection history">
                  <Button
                    variant="icon"
                    aria-label="Back"
                    title="Back"
                    disabled={!nav.canGoBack()}
                    onClick={nav.back}
                  >
                    ←
                  </Button>
                  <Button
                    variant="icon"
                    aria-label="Forward"
                    title="Forward"
                    disabled={!nav.canGoForward()}
                    onClick={nav.forward}
                  >
                    →
                  </Button>
                </nav>
              </div>
              <nav class="filter-bar" aria-label="Artist details">
                <For each={focusTabs}>
                  {(tab) => (
                    <PanelTab
                      active={focusView() === tab.id}
                      underline
                      disabled={!selectedArtist()}
                      onClick={() => updateState({ focus: tab.id })}
                    >
                      {tab.label}
                    </PanelTab>
                  )}
                </For>
              </nav>
              <div class="panel-scroll" ref={focusScroll}>
                <Show
                  when={selectedArtist()}
                  fallback={
                    <div class="workspace-empty">
                      <EmptyState>Select a track, album or artist.</EmptyState>
                    </div>
                  }
                >
                  <div id="focus-similar" hidden={focusView() !== 'similar'}>
                    <ArtistList
                      artists={similarArtists.artists()}
                      isLoading={similarArtists.isLoading()}
                      error={similarArtists.error()}
                      onArtistClick={handleArtistClick}
                      onNTSLookup={(artistName) =>
                        handleNTSLookup(artistName, 'artist')
                      }
                      showMatch
                    />
                  </div>
                  <Show
                    when={props.user}
                    fallback={
                      <div hidden={focusView() === 'similar'}>
                        {renderConnectNotice(
                          'Connect for RYM and Bandcamp matches.'
                        )}
                      </div>
                    }
                  >
                    <ScrapeSections activeSource={focusSource()} />
                  </Show>
                </Show>
              </div>
            </div>
          }
        />
      </Show>
    </main>
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
