import { Component, Show } from 'solid-js';
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
          <button
            onClick={() => props.onRefresh?.()}
            class="text-fg-subtle hover:text-fg text-xs ml-1"
            title="Re-scrape"
          >
            ↻
          </button>
        </Show>
      </span>
    </Show>
  );
};

export default CacheAge;
