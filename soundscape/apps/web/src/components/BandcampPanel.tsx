import { Component, Show } from 'solid-js';
import BandcampAlbumView from './BandcampAlbumView.js';

interface BandcampPanelProps {
  bandcampUrl: string;
}

const BandcampPanel: Component<BandcampPanelProps> = (props) => {
  const isAlbum = () => props.bandcampUrl.includes('/album/');

  return (
    <div class="h-full overflow-hidden">
      <Show when={isAlbum()}>
        <BandcampAlbumView
          albumUrl={props.bandcampUrl}
          onTagClick={() => {}}
        />
      </Show>
      <Show when={!isAlbum()}>
        <div class="p-4 text-xs text-fg-muted">
          <div>bandcampUrl: {props.bandcampUrl}</div>
        </div>
      </Show>
    </div>
  );
};

export default BandcampPanel;
