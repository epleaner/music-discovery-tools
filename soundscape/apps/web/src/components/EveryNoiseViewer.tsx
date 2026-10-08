import { Component, Show } from 'solid-js';
import ExternalLink from './ExternalLink';
import type { EveryNoiseGenre } from '@soundscape/types';

interface EveryNoiseViewerProps {
  genre: EveryNoiseGenre | null;
  isLoading: boolean;
  artistName: string;
}

const EveryNoiseViewer: Component<EveryNoiseViewerProps> = (props) => {
  return (
    <div class="toolbar">
      <div class="result-actions min-w-0 items-center">
        <Show when={props.genre && !props.isLoading}>
          <div class="result-meta break-words">{props.genre!.genre}</div>
        </Show>
        <ExternalLink href="https://everynoise.com">
          Every Noise at Once
        </ExternalLink>

        <Show when={props.isLoading}>
          <div class="status" role="status">
            Loading genre…
          </div>
        </Show>
        <Show when={!props.isLoading && !props.genre}>
          <div class="status min-w-0 break-words" role="status">
            No genre data found for {props.artistName}
          </div>
        </Show>
      </div>
      <Show when={props.genre && !props.isLoading}>
        <ExternalLink href={props.genre!.url} title="Open genre map in new tab">
          Genre map
        </ExternalLink>
      </Show>
    </div>
  );
};

export default EveryNoiseViewer;
