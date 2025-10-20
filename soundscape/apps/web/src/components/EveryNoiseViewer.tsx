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
    <div class='flex flex-shrink-0 gap-2 justify-between items-center'>
      <div class='flex gap-2 items-center'>
        <Show when={props.genre && !props.isLoading}>
          <div class='text-xs'>{props.genre!.genre}</div>
        </Show>
        <a
          href='https://everynoise.com'
          target='_blank'
          rel='noopener noreferrer'
          class='text-xs link'>
          Every Noise at Once
        </a>
        <div class='text-xs text-fg-muted'>
          <Show when={props.isLoading}>◐</Show>
          <Show when={!props.isLoading && !props.genre}>
            No genre data found for {props.artistName}
          </Show>
        </div>
      </div>
      <Show when={props.genre && !props.isLoading}>
        <button
          onClick={handleOpenGenre}
          class='text-xs link'
          title='Open genre map in new tab'>
          Genre Map →
        </button>
      </Show>
    </div>
  );
};

export default EveryNoiseViewer;
