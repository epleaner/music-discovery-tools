import { Component, Show } from 'solid-js';
import Button from './Button';
import ExternalLink from './ExternalLink';
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
        <ExternalLink
          href='https://everynoise.com'
          class='text-xs link'
        >
          Every Noise at Once
        </ExternalLink>

        <Show when={props.isLoading}>
          <div class='text-xs text-fg-muted animate-spin'>✸</div>
        </Show>
        <Show when={!props.isLoading && !props.genre}>
          <div class='text-xs text-fg-muted'>
            No genre data found for {props.artistName}
          </div>
        </Show>
      </div>
      <Show when={props.genre && !props.isLoading}>
        <Button
          onClick={handleOpenGenre}
          variant="link"
          class='text-xs link pr-2'
          title='Open genre map in new tab'>
          Genre Map →
        </Button>
      </Show>
    </div>
  );
};

export default EveryNoiseViewer;
