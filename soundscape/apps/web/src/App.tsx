import { Component, Show, Switch, Match, For, createMemo } from 'solid-js';
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
}

const App: Component = () => {
  const [state, updateState] = useHashState<AppState>({
    username: '',
    view: 'recent',
    subview: 'tracks',
    period: '7day',
    artist: '',
  });

  const { theme, toggleTheme } = useTheme();

  // Getters for reactive access
  const username = () => state().username;
  const currentView = () => state().view;
  const recentViewType = () => state().subview;
  const period = () => state().period as TimePeriod;
  const selectedArtist = () => state().artist;

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

  // Music sites configuration
  const musicSites = [
    {
      id: 'secret-ambient',
      name: 'Secret Ambient Club',
      url: 'https://secretambient.club/',
    },
    {
      id: 'blank',
      name: 'Blank',
      url: '',
    },
  ];

  return (
    <div class='h-screen bg-bg flex flex-col'>
      {/* Header */}
      <div class='flex-shrink-0 p-4 border-b border-border'>
        <div class='flex justify-between items-center mb-3'>
          <h1 class='text-base font-medium'>Soundscape</h1>
          <button
            onClick={toggleTheme}
            class='text-sm transition-colors text-fg-subtle hover:text-fg'
            title={`Theme: ${theme()}`}>
            {getThemeIcon()}
          </button>
        </div>
        <UsernameInput
          onSubmit={handleUsernameSubmit}
          initialUsername={username()}
        />
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
                <div
                  class='flex flex-col overflow-hidden'
                  style={{ height: '100%' }}>
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
                  <div class='flex-1 overflow-y-auto'>
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
                <div
                  class='flex flex-col overflow-hidden'
                  style={{ height: '100%' }}>
                  <div class='flex-shrink-0 bg-bg p-4 border-b border-border'>
                    <h2 class='text-sm font-medium'>Similar Artists</h2>
                    <Show when={selectedArtist()}>
                      <div class='mt-1 text-xs text-fg-muted'>
                        to {selectedArtist()}
                      </div>
                    </Show>
                  </div>
                  <div class='flex-1 overflow-y-auto p-2'>
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
            <div class='flex items-center justify-center h-full'>
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
