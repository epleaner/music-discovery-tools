import { Component, createSignal, For, Show } from 'solid-js';

interface Site {
  id: string;
  name: string;
  url: string;
}

interface SiteViewerProps {
  sites: Site[];
  onSitesChange?: (sites: Site[]) => void;
}

const SiteViewer: Component<SiteViewerProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal(0);
  const [isExpanded, setIsExpanded] = createSignal(false);

  return (
    <div class='border-t border-border bg-bg'>
      {/* Header */}
      <div class='flex items-center justify-between px-4 py-2 border-b border-border'>
        <div class='flex items-center gap-2'>
          <button
            onClick={() => setIsExpanded(!isExpanded())}
            class='text-xs text-fg-muted hover:text-fg transition-colors'>
            {isExpanded() ? '▼' : '▶'}
          </button>
          <div class='text-sm font-medium'>Music Sites</div>
        </div>
        <div class='text-xs text-fg-muted'>
          {isExpanded() ? 'Click to collapse' : 'Click to expand'}
        </div>
      </div>

      {/* Tabs and Content */}
      <Show when={isExpanded()}>
        {/* Tabs */}
        <div class='flex border-b border-border overflow-x-auto'>
          <For each={props.sites}>
            {(site, index) => (
              <button
                onClick={() => setActiveTab(index())}
                class={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab() === index()
                    ? 'border-accent'
                    : 'border-transparent text-fg-muted hover:text-fg'
                }`}>
                {site.name}
              </button>
            )}
          </For>
        </div>

        {/* Iframe Content */}
        <div class='relative' style={{ height: '600px' }}>
          <For each={props.sites}>
            {(site, index) => (
              <Show when={activeTab() === index()}>
                <Show
                  when={site.url}
                  fallback={
                    <div class='flex items-center justify-center h-full text-xs text-fg-muted'>
                      No URL configured
                    </div>
                  }>
                  <iframe
                    src={site.url}
                    class='w-full h-full border-0'
                    title={site.name}
                    sandbox='allow-same-origin allow-scripts allow-popups allow-forms'
                  />
                </Show>
              </Show>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default SiteViewer;

