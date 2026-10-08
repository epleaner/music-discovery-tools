import { Component, Show } from 'solid-js';
import ExternalLink from './ExternalLink';
import type { EveryNoiseGenre } from '@soundscape/types';

interface EveryNoiseViewerProps {
  genre: EveryNoiseGenre | null;
  isLoading: boolean;
}

const EveryNoiseViewer: Component<EveryNoiseViewerProps> = (props) => {
  return (
    <div class="toolbar">
      <Show when={props.genre && !props.isLoading}>
        <ExternalLink
          href={props.genre!.url}
          title="Open genre map on Every Noise"
        >
          {props.genre!.genre}
        </ExternalLink>
      </Show>
      <ExternalLink href="https://everynoise.com">Every Noise</ExternalLink>
      <Show when={props.isLoading}>
        <span class="status" role="status">
          Loading genre…
        </span>
      </Show>
      <Show when={!props.isLoading && !props.genre}>
        <span class="status" role="status">
          Genre unavailable
        </span>
      </Show>
    </div>
  );
};

export default EveryNoiseViewer;
