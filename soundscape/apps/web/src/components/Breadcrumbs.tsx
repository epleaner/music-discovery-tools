import { Component, For, Show, createSignal } from 'solid-js';
import { useNav } from '../lib/use-nav';
import type { NavView } from '../lib/nav-store';
import Button from './Button';

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
          <Button
            onClick={() => nav.goTo(item.index)}
            variant="link"
            class="max-w-[220px] truncate"
          >
            {item.view.label}
          </Button>
        </Show>
        <Show when={isCurrent() && nav.current().restore.type === 'item' && props.onRefresh}>
          <Button
            onClick={() => props.onRefresh?.()}
            variant="link"
            title="Refresh"
            aria-label="Refresh"
          >
            &#8635;
          </Button>
        </Show>
      </>
    );
  };

  return (
    <div class="flex overflow-hidden gap-1.5 items-center px-3 py-1.5 text-xs border-b border-border bg-bg">
      <Button
        onClick={() => nav.home()}
        variant="link"
        title="Home"
        aria-label="Home"
      >
        &#8962;
      </Button>
      <Show when={isCollapsed()}>
        <span class="text-fg-subtle">&rsaquo;</span>
        <Button
          onClick={() => setShowAll(true)}
          variant="link"
          title="Show full trail"
          aria-label="Show full trail"
        >
          &hellip;
        </Button>
      </Show>
      <For each={visibleTrail()}>{(item) => <Crumb {...item} />}</For>
    </div>
  );
};

export default Breadcrumbs;
