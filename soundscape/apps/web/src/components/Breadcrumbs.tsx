import { Component, For, Show, createSignal } from 'solid-js';
import { useNav } from '../lib/use-nav';
import type { NavView } from '../lib/nav-store';

interface BreadcrumbsProps {
  onRefresh?: () => void;
}

const COLLAPSE_THRESHOLD = 4;

const Breadcrumbs: Component<BreadcrumbsProps> = (props) => {
  const nav = useNav();
  const [showAll, setShowAll] = createSignal(false);

  const trail = () => nav.state().stack.slice(1);
  const isCollapsed = () =>
    !showAll() && nav.state().stack.length > COLLAPSE_THRESHOLD;

  const visibleTrail = (): Array<{ view: NavView; index: number }> => {
    const full = trail().map((view, i) => ({ view, index: i + 1 }));
    if (!isCollapsed()) return full;
    return full.slice(-2);
  };

  const Crumb = (item: { view: NavView; index: number }) => {
    const isCurrent = () => nav.state().index === item.index;
    return (
      <>
        <span class="text-fg-subtle">&rsaquo;</span>
        <Show
          when={!isCurrent()}
          fallback={
            <span class="font-bold text-fg max-w-[220px] truncate">
              {item.view.label}
            </span>
          }
        >
          <button
            onClick={() => nav.goTo(item.index)}
            class="text-fg-muted hover:text-fg max-w-[220px] truncate"
          >
            {item.view.label}
          </button>
        </Show>
        <Show when={isCurrent() && nav.current().restore.type === 'scrape' && props.onRefresh}>
          <button
            onClick={() => props.onRefresh?.()}
            title="Refresh"
            class="text-fg-subtle hover:text-fg"
          >
            &#8635;
          </button>
        </Show>
      </>
    );
  };

  return (
    <div class="flex overflow-hidden gap-1.5 items-center px-3 py-1.5 text-xs border-b border-border bg-bg">
      <button
        onClick={() => nav.home()}
        title="Home"
        class="text-fg-muted hover:text-fg"
      >
        &#8962;
      </button>
      <Show when={isCollapsed()}>
        <span class="text-fg-subtle">&rsaquo;</span>
        <button
          onClick={() => setShowAll(true)}
          title="Show full trail"
          class="text-fg-muted hover:text-fg"
        >
          &hellip;
        </button>
      </Show>
      <For each={visibleTrail()}>{(item) => <Crumb {...item} />}</For>
    </div>
  );
};

export default Breadcrumbs;
