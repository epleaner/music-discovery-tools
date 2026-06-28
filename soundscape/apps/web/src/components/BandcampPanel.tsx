import { Component, Show, createEffect, createSignal } from 'solid-js';
import BandcampAlbumView from './BandcampAlbumView.js';
import BandcampArtistView from './BandcampArtistView.js';
import BandcampTagView from './BandcampTagView.js';
import { guessBandcampUrl } from '../lib/bandcamp-slug.js';

interface BandcampPanelProps {
  bandcampUrl: string;
  bandcampTag: string;
  selectedArtist?: string;
  onAlbumClick: (url: string) => void;
  onUrlChange: (url: string) => void;
  onTagClick: (tag: string) => void;
  onTagClear: () => void;
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

  createEffect(() => {
    props.selectedArtist; // track the source so the effect re-runs on change
    setSlugFailed(false);
  });

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
      {/* Tag view takes highest precedence */}
      <Show when={props.bandcampTag}>
        <BandcampTagView
          tag={props.bandcampTag}
          onAlbumClick={props.onAlbumClick}
          onBack={props.onTagClear}
        />
      </Show>

      <Show when={!props.bandcampTag && isAlbum()}>
        <BandcampAlbumView
          albumUrl={props.bandcampUrl}
          onTagClick={props.onTagClick}
          onAlbumClick={props.onAlbumClick}
        />
      </Show>

      <Show when={!props.bandcampTag && !isAlbum() && artistViewUrl()}>
        <BandcampArtistView
          bandUrl={artistViewUrl()!}
          onAlbumClick={props.onAlbumClick}
          onSlugGuessFailed={handleSlugGuessFailed}
        />
      </Show>

      <Show when={!props.bandcampTag && showManualInput()}>
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
