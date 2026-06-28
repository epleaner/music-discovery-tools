import { Component, Show, createSignal } from 'solid-js';
import BandcampAlbumView from './BandcampAlbumView.js';
import BandcampArtistView from './BandcampArtistView.js';
import { guessBandcampUrl } from '../lib/bandcamp-slug.js';

interface BandcampPanelProps {
  bandcampUrl: string;
  selectedArtist?: string;
  onAlbumClick: (url: string) => void;
  onUrlChange: (url: string) => void;
}

const BandcampPanel: Component<BandcampPanelProps> = (props) => {
  const [manualUrl, setManualUrl] = createSignal('');
  const [slugFailed, setSlugFailed] = createSignal(false);

  const isAlbum = () => props.bandcampUrl.includes('/album/');
  const isArtistUrl = () =>
    /^https?:\/\/[^/]+\.bandcamp\.com\/?$/.test(props.bandcampUrl);

  const guessedUrl = () => {
    const artist = props.selectedArtist;
    if (!artist) return null;
    return guessBandcampUrl(artist);
  };

  const handleSlugGuessFailed = () => {
    setSlugFailed(true);
  };

  const handleManualSubmit = (e: Event) => {
    e.preventDefault();
    const url = manualUrl().trim();
    if (url) props.onUrlChange(url);
  };

  const showManualInput = () =>
    !isAlbum() && !isArtistUrl() && (!props.selectedArtist || slugFailed());

  const artistViewUrl = () => {
    if (isArtistUrl()) return props.bandcampUrl;
    if (props.selectedArtist && !slugFailed()) return guessedUrl();
    return null;
  };

  return (
    <div class="h-full overflow-hidden flex flex-col">
      <Show when={isAlbum()}>
        <BandcampAlbumView
          albumUrl={props.bandcampUrl}
          onTagClick={() => {}}
        />
      </Show>

      <Show when={!isAlbum() && artistViewUrl()}>
        <BandcampArtistView
          bandUrl={artistViewUrl()!}
          onAlbumClick={props.onAlbumClick}
          onSlugGuessFailed={handleSlugGuessFailed}
        />
      </Show>

      <Show when={showManualInput()}>
        <div class="p-4 text-xs">
          <Show when={slugFailed()}>
            <p class="text-fg-muted mb-3">
              Could not find a Bandcamp page for this artist. Paste a Bandcamp URL to continue.
            </p>
          </Show>
          <form onSubmit={handleManualSubmit} class="flex gap-2">
            <input
              type="url"
              placeholder="https://artist.bandcamp.com"
              value={manualUrl()}
              onInput={(e) => setManualUrl(e.currentTarget.value)}
              class="flex-1 input text-xs"
            />
            <button type="submit" class="btn-primary text-xs px-2 py-1">
              Go
            </button>
          </form>
        </div>
      </Show>
    </div>
  );
};

export default BandcampPanel;
