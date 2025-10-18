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
    { id: 'recent', label: 'Recent' },
    { id: 'top', label: 'Top' },
    { id: 'similar', label: 'Similar' },
  ];

  return (
    <div class='min-h-screen bg-bg'>
      <div class='max-w-2xl mx-auto'>
        {/* Header */}
        <div class='p-4 border-b border-border'>
          <h1 class='mb-3 text-base font-medium'>Soundscape</h1>
          <UsernameInput
            onSubmit={handleUsernameSubmit}
            initialUsername={username()}
          />
        </div>

        <Show when={username()}>
          <div>
            {/* Tabs */}
            <div class='flex border-b border-border'>
              <For each={tabs}>
                {(tab) => (
                  <button
                    onClick={() => setCurrentView(tab.id)}
                    class={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      currentView() === tab.id
                        ? 'border-accent'
                        : 'border-transparent text-fg-muted hover:text-fg'
                    }`}
                    disabled={tab.id === 'similar' && !selectedArtist()}>
                    {tab.label}
                    <Show when={tab.id === 'similar' && selectedArtist()}>
                      <span class='ml-1 text-xs text-fg-subtle'>
                        ({selectedArtist()})
                      </span>
                    </Show>
                  </button>
                )}
              </For>
            </div>

            {/* Period selector for top artists */}
            <Show when={currentView() === 'top'}>
              <div class='flex gap-1 p-2 overflow-x-auto border-b border-border'>
                <For each={Object.keys(TIME_PERIOD_LABELS) as TimePeriod[]}>
                  {(p) => (
                    <button
                      onClick={() => setPeriod(p)}
                      class={`px-2 py-1 text-xs whitespace-nowrap ${
                        period() === p
                          ? 'bg-accent text-white'
                          : 'text-fg-muted hover:text-fg'
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
                <div>
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
                    <div class='p-4 text-center border-t border-border'>
                      <button
                        onClick={() => recentTracks.loadMore()}
                        class='btn text-xs'>
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

              <Match when={currentView() === 'similar'}>
                <Show
                  when={selectedArtist()}
                  fallback={
                    <div class='py-8 text-xs text-center text-fg-muted'>
                      Select an artist to see similar artists
                    </div>
                  }>
                  <div class='p-2'>
                    <button
                      onClick={() => setCurrentView('top')}
                      class='mb-2 text-xs text-fg-muted hover:text-fg'>
                      ← Back
                    </button>
                    <ArtistList
                      artists={similarArtists.artists()}
                      isLoading={similarArtists.isLoading()}
                      error={similarArtists.error()}
                      onArtistClick={handleArtistClick}
                      showMatch={true}
                    />
                  </div>
                </Show>
              </Match>
            </Switch>
          </div>
        </Show>

        <Show when={!username()}>
          <div class='py-12 text-xs text-center text-fg-muted'>
            Enter a username to start
          </div>
        </Show>
      </div>
    </div>
  );
};

export default App;
