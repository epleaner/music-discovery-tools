import { Component, Show } from 'solid-js';
import Button from './Button';
import { relativeTime } from '../lib/relative-time';

interface CacheAgeProps {
  fetchedAt?: string | Date | null;
  onRefresh?: () => void;
}

const CacheAge: Component<CacheAgeProps> = (props) => {
  return (
    <Show when={props.fetchedAt}>
      <span class="toolbar">
        <span class="subtle-text">Fetched {relativeTime(props.fetchedAt)}</span>
        <Show when={props.onRefresh}>
          <Button
            onClick={() => props.onRefresh?.()}
            variant="control"
            title="Refresh source data"
            aria-label="Refresh source data"
          >
            Refresh
          </Button>
        </Show>
      </span>
    </Show>
  );
};

export default CacheAge;
