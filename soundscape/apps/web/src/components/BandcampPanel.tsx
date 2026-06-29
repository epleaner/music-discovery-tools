import { Component, Show, createSignal } from 'solid-js';
import BandcampAlbumView from './BandcampAlbumView.js';

interface BandcampPanelProps {
  bandcampUrl: string;
  onUrlChange: (url: string) => void;
}

const BandcampPanel: Component<BandcampPanelProps> = (props) => {
  const [manualUrl, setManualUrl] = createSignal('');

  const isAlbum = () => props.bandcampUrl.includes('/album/');

  const handleManualSubmit = (e: Event) => {
    e.preventDefault();
    const url = manualUrl().trim();
    if (url) props.onUrlChange(url);
  };

  return (
    <div class="h-full overflow-hidden flex flex-col">
      <Show when={isAlbum()}>
        <BandcampAlbumView albumUrl={props.bandcampUrl} />
      </Show>

      <Show when={!isAlbum()}>
        <div class="p-4 text-xs">
          <form onSubmit={handleManualSubmit} class="flex gap-2">
            <input
              type="url"
              placeholder="https://artist.bandcamp.com/album/..."
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
