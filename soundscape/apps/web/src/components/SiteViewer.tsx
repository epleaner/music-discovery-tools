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

  return (
    <div
      class='border-t border-border bg-bg flex flex-col'
      style={{ height: '300px' }}>
      {/* Tabs */}
      <div class='flex border-b border-border overflow-x-auto flex-shrink-0'>
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
      <div class='relative flex-1 overflow-hidden'>
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
    </div>
  );
};

export default SiteViewer;
