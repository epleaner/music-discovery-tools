import { Component, createSignal, Show, Switch, Match, For } from 'solid-js';
import UsernameInput from './components/UsernameInput';
import TrackList from './components/TrackList';
import ArtistList from './components/ArtistList';
import {
  createRecentTracksResource,
  createTopArtistsResource,
  createSimilarArtistsResource,
} from './lib/lastfm-resource';
import { TIME_PERIOD_LABELS, type TimePeriod } from '@soundscape/types';

type View = 'recent' | 'top' | 'similar';

const App: Component = () => {
  const [username, setUsername] = createSignal('');
  const [currentView, setCurrentView] = createSignal<View>('recent');
  const [period, setPeriod] = createSignal<TimePeriod>('7day');
  const [selectedArtist, setSelectedArtist] = createSignal('');

  const recentTracks = createRecentTracksResource(username);
  const topArtists = createTopArtistsResource(username, period);
  const similarArtists = createSimilarArtistsResource(selectedArtist);

  const handleUsernameSubmit = (newUsername: string) => {
    setUsername(newUsername);
    setCurrentView('recent');
    recentTracks.reset();
  };

  const handleArtistClick = (artistName: string) => {
    setSelectedArtist(artistName);
    setCurrentView('similar');
  };

  const tabs: { id: View; label: string }[] = [
    { id: 'recent', label: 'Recent Tracks' },
    { id: 'top', label: 'Top Artists' },
    { id: 'similar', label: 'Similar Artists' },
  ];

  return (
    <div class='min-h-screen bg-background text-foreground'>
      <div class='container px-4 py-8 mx-auto max-w-6xl'>
        <header class='mb-8 text-center'>
          <h1 class='mb-2 text-4xl font-bold'>Soundscape</h1>
          <p class='text-lg text-muted-foreground'>
            Explore your Last.fm listening history
          </p>
        </header>

        <div class='mb-8'>
          <UsernameInput
            onSubmit={handleUsernameSubmit}
            initialUsername={username()}
          />
        </div>

        <Show when={username()}>
          <div class='space-y-6'>
            {/* Tabs */}
            <div class='flex gap-2 border-b border-border'>
              <For each={tabs}>
                {(tab) => (
                  <button
                    onClick={() => setCurrentView(tab.id)}
                    class={`px-4 py-2 font-medium transition-colors border-b-2 ${
                      currentView() === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                    disabled={tab.id === 'similar' && !selectedArtist()}>
                    {tab.label}
                    <Show when={tab.id === 'similar' && selectedArtist()}>
                      <span class='ml-2 text-xs'>({selectedArtist()})</span>
                    </Show>
                  </button>
                )}
              </For>
            </div>

            {/* Period selector for top artists */}
            <Show when={currentView() === 'top'}>
              <div class='flex flex-wrap gap-2'>
                <For each={Object.keys(TIME_PERIOD_LABELS) as TimePeriod[]}>
                  {(p) => (
                    <button
                      onClick={() => setPeriod(p)}
                      class={`px-3 py-1 text-sm rounded-lg transition-colors ${
                        period() === p
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}>
                      {TIME_PERIOD_LABELS[p]}
                    </button>
                  )}
                </For>
              </div>
            </Show>

            {/* Content */}
            <Switch>
              <Match when={currentView() === 'recent'}>
                <div class='space-y-4'>
                  <TrackList
                    tracks={recentTracks.tracks()}
                    isLoading={recentTracks.isLoading()}
                    error={recentTracks.error()}
                  />
                  <Show
                    when={
                      !recentTracks.isLoading() &&
                      parseInt(recentTracks.currentPage().toString()) <
                        parseInt(recentTracks.totalPages())
                    }>
                    <div class='text-center'>
                      <button
                        onClick={() => recentTracks.loadMore()}
                        class='px-6 py-2 rounded-lg transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80'>
                        Load More
                      </button>
                    </div>
                  </Show>
                </div>
              </Match>

              <Match when={currentView() === 'top'}>
                <ArtistList
                  artists={topArtists.artists()}
                  isLoading={topArtists.isLoading()}
                  error={topArtists.error()}
                  onArtistClick={handleArtistClick}
                  showPlaycount={true}
                />
              </Match>

              <Match when={currentView() === 'similar'}>
                <Show
                  when={selectedArtist()}
                  fallback={
                    <div class='py-8 text-center text-muted-foreground'>
                      Click on an artist from the Top Artists tab to see similar
                      artists
                    </div>
                  }>
                  <div class='mb-4'>
                    <button
                      onClick={() => setCurrentView('top')}
                      class='text-sm text-primary hover:underline'>
                      ← Back to Top Artists
                    </button>
                  </div>
                  <ArtistList
                    artists={similarArtists.artists()}
                    isLoading={similarArtists.isLoading()}
                    error={similarArtists.error()}
                    onArtistClick={handleArtistClick}
                    showMatch={true}
                  />
                </Show>
              </Match>
            </Switch>
          </div>
        </Show>

        <Show when={!username()}>
          <div class='py-12 text-center text-muted-foreground'>
            Enter a Last.fm username to get started
          </div>
        </Show>
      </div>
    </div>
  );
};

export default App;
