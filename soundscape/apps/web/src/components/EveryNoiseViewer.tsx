import { Component, Show } from 'solid-js';
import type { EveryNoiseGenre } from '@soundscape/types';

interface EveryNoiseViewerProps {
  genre: EveryNoiseGenre | null;
  isLoading: boolean;
  artistName: string;
}

const EveryNoiseViewer: Component<EveryNoiseViewerProps> = (props) => {
  const handleOpenGenre = () => {
    if (props.genre) {
      window.open(props.genre.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div class='flex flex-col border-t border-border bg-bg'>
      <div class='flex-shrink-0 p-2 border-b border-border'>
        <h3 class='text-xs font-medium'>Every Noise at Once</h3>
      </div>

      <Show when={props.isLoading}>
        <div class='p-2 text-xs text-fg-muted'>Loading genre...</div>
      </Show>

      <Show when={!props.isLoading && !props.genre}>
        <div class='p-2 text-xs text-fg-muted'>
          No genre data found for {props.artistName}
        </div>
      </Show>

      <Show when={props.genre && !props.isLoading}>
        <div class='p-2'>
          <div class='mb-2'>
            <div class='text-xs text-fg-muted'>Genre</div>
            <div class='text-sm'>{props.genre!.genre}</div>
          </div>
          <button
            onClick={handleOpenGenre}
            class='w-full text-xs btn-secondary'
            title='Open genre map in new tab'>
            View Genre Map →
          </button>
        </div>
      </Show>
    </div>
  );
};

export default EveryNoiseViewer;
