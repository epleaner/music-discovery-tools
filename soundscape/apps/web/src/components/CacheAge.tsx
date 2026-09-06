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
      <span class="inline-flex items-center gap-1">
        <span class="text-[10px] text-fg-subtle">last fetched {relativeTime(props.fetchedAt)}</span>
        <Show when={props.onRefresh}>
          <Button
            onClick={() => props.onRefresh?.()}
            variant="link"
            class="text-fg-subtle text-xs ml-1"
            title="Re-scrape"
            aria-label="Re-scrape"
          >
            ↻
          </Button>
        </Show>
      </span>
    </Show>
  );
};

export default CacheAge;
